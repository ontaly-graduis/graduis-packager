// Lecture d'un paquet PPTX : parties, relations, diapositives ordonnées, disposition, notes.
import { unzipSync, strFromU8 } from "fflate";
import { DOMParser, type Document, type Element } from "@xmldom/xmldom";
import { posix } from "node:path";

export const NS = {
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
} as const;

export interface Relation {
  readonly id: string;
  /** Dernier segment de l'URI de type : `slideLayout`, `notesSlide`, `image`, `hyperlink`… */
  readonly type: string;
  /** Chemin de partie résolu, ou URL telle quelle si la relation est externe. */
  readonly cible: string;
  readonly externe: boolean;
}

export interface DiapositiveDuPaquet {
  readonly n: number;
  readonly chemin: string;
  readonly masquee: boolean;
}

/** Les éléments enfants directs de `el` au nom qualifié (ns, local). */
export function enfants(el: Element, ns: string, local: string): Element[] {
  const out: Element[] = [];
  for (let c = el.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 1) {
      const e = c as Element;
      if (e.namespaceURI === ns && e.localName === local) out.push(e);
    }
  }
  return out;
}

export function enfant(el: Element, ns: string, local: string): Element | undefined {
  return enfants(el, ns, local)[0];
}

/** Tous les éléments enfants directs (sans filtre de nom). */
export function elementsEnfants(el: Element): Element[] {
  const out: Element[] = [];
  for (let c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) out.push(c as Element);
  return out;
}

/** Suit un chemin d'enfants directs, ex. `chemin(sp, ["p:nvSpPr", "p:nvPr", "p:ph"])`. */
export function chemin(el: Element, etapes: readonly string[]): Element | undefined {
  let cur: Element | undefined = el;
  for (const etape of etapes) {
    if (!cur) return undefined;
    const [prefixe, local] = etape.split(":") as [keyof typeof NS, string];
    cur = enfant(cur, NS[prefixe], local);
  }
  return cur;
}

export function entier(el: Element | undefined, attr: string): number | null {
  const v = el?.getAttribute(attr);
  return v === null || v === undefined || v === "" ? null : Number.parseInt(v, 10);
}

export class Paquet {
  private readonly parties: Record<string, Uint8Array>;
  private readonly documents = new Map<string, Document>();

  constructor(octets: Uint8Array) {
    this.parties = unzipSync(octets);
  }

  octets(partie: string): Uint8Array | undefined {
    return this.parties[partie];
  }

  racine(partie: string): Element {
    let doc = this.documents.get(partie);
    if (!doc) {
      const o = this.parties[partie];
      if (!o) throw new Error(`partie absente du paquet : ${partie}`);
      doc = new DOMParser().parseFromString(strFromU8(o), "text/xml");
      this.documents.set(partie, doc);
    }
    const r = doc.documentElement;
    if (!r) throw new Error(`partie sans racine : ${partie}`);
    return r;
  }

  relations(partie: string): Relation[] {
    const dossier = posix.dirname(partie);
    const rels = posix.join(dossier, "_rels", posix.basename(partie) + ".rels");
    if (!this.parties[rels]) return [];
    return enfants(this.racine(rels), NS.rel, "Relationship").map((e) => {
      const externe = e.getAttribute("TargetMode") === "External";
      const cible = e.getAttribute("Target") ?? "";
      return {
        id: e.getAttribute("Id") ?? "",
        type: (e.getAttribute("Type") ?? "").split("/").pop() ?? "",
        cible: externe ? cible : posix.normalize(cible.startsWith("/") ? cible.slice(1) : posix.join(dossier, cible)),
        externe,
      };
    });
  }

  relation(partie: string, type: string): Relation | undefined {
    return this.relations(partie).find((r) => r.type === type);
  }

  taille(): { largeur: number; hauteur: number } {
    const sz = chemin(this.racine("ppt/presentation.xml"), ["p:sldSz"]);
    return { largeur: entier(sz, "cx") ?? 0, hauteur: entier(sz, "cy") ?? 0 };
  }

  nombreDeMasques(): number {
    const liste = chemin(this.racine("ppt/presentation.xml"), ["p:sldMasterIdLst"]);
    return liste ? enfants(liste, NS.p, "sldMasterId").length : 0;
  }

  diapositives(): DiapositiveDuPaquet[] {
    const pres = "ppt/presentation.xml";
    const rels = new Map(this.relations(pres).map((r) => [r.id, r.cible]));
    const liste = chemin(this.racine(pres), ["p:sldIdLst"]);
    if (!liste) return [];
    return enfants(liste, NS.p, "sldId").map((e, i) => {
      const cible = rels.get(e.getAttributeNS(NS.r, "id") ?? "");
      if (!cible) throw new Error(`diapositive ${i + 1} sans relation`);
      return { n: i + 1, chemin: cible, masquee: this.racine(cible).getAttribute("show") === "0" };
    });
  }

  /** Le nom de la disposition d'une diapositive (`p:cSld@name` de son slideLayout). */
  disposition(diapo: string): { chemin: string; nom: string } | undefined {
    const rel = this.relation(diapo, "slideLayout");
    if (!rel) return undefined;
    return { chemin: rel.cible, nom: chemin(this.racine(rel.cible), ["p:cSld"])?.getAttribute("name") ?? "" };
  }

  masqueDe(disposition: string): string | undefined {
    return this.relation(disposition, "slideMaster")?.cible;
  }

  /** Le texte des notes : l'espace réservé `body` de la page de notes, paragraphes joints par « \n ». */
  notes(diapo: string): string {
    const rel = this.relation(diapo, "notesSlide");
    if (!rel) return "";
    const arbre = chemin(this.racine(rel.cible), ["p:cSld", "p:spTree"]);
    if (!arbre) return "";
    for (const sp of enfants(arbre, NS.p, "sp")) {
      const ph = chemin(sp, ["p:nvSpPr", "p:nvPr", "p:ph"]);
      if (ph?.getAttribute("type") === "body") {
        const corps = chemin(sp, ["p:txBody"]);
        return corps ? paragraphes(corps).join("\n").trim() : "";
      }
    }
    return "";
  }
}

/** Les paragraphes d'un `txBody` : runs, champs et sauts de ligne. */
export function paragraphes(txBody: Element): string[] {
  return enfants(txBody, NS.a, "p").map((p) => {
    let t = "";
    for (const c of elementsEnfants(p)) {
      if (c.namespaceURI !== NS.a) continue;
      if (c.localName === "r" || c.localName === "fld") t += enfant(c, NS.a, "t")?.textContent ?? "";
      else if (c.localName === "br") t += "\n";
    }
    return t;
  });
}
