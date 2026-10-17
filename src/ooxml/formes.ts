// Aplatit l'arbre de formes d'une diapositive : boîtes absolues (groupes, espaces réservés hérités), textes, images.
import type { Element } from "@xmldom/xmldom";
import { NS, type Paquet, chemin, elementsEnfants, enfant, enfants, entier, paragraphes } from "./paquet";

/** [x, y, largeur, hauteur] en EMU, entiers. */
export type Boite = readonly [number, number, number, number];

export type Nature = "espace" | "texte" | "forme" | "libre" | "autre" | "image" | "tableau" | "graphique" | "trait";

/** Les natures qui portent un cadre de texte (les `p:sp`). */
export const NATURES_TEXTE: ReadonlySet<Nature> = new Set(["espace", "texte", "forme", "libre", "autre"]);

export interface Forme {
  readonly id: number;
  readonly nom: string;
  readonly nature: Nature;
  readonly boite: Boite;
  readonly geometrie?: string;
  readonly sansRemplissage?: true;
  readonly espace?: { readonly type: string; readonly idx: number };
  readonly texte?: readonly string[];
  /** Chemin de partie de l'image (le relevé le remplace par son hash). */
  readonly media?: string;
  /** Rognage `a:srcRect` en millièmes de pour-cent : gauche, haut, droite, bas. */
  readonly rognage?: readonly [number, number, number, number];
  /** Id du groupe racine qui contient la forme. */
  readonly groupe?: number;
  /** Dernier segment de l'URI `graphicData` d'un cadre graphique non tableau. */
  readonly graphique?: string;
  /** Les cellules d'un tableau, ligne par ligne (paragraphes d'une cellule joints par « \n »). */
  readonly lignes?: readonly (readonly string[])[];
}

interface Espace {
  readonly type: string;
  readonly idx: number;
}

/** Ce qu'il faut à l'aplatissement : la boîte héritée d'un espace réservé, la cible d'une image. */
export interface Contexte {
  readonly heritage: (espace: Espace) => Boite | undefined;
  readonly media: (rId: string) => string | undefined;
}

type Transformation = (b: Boite) => Boite;

const IDENTITE: Transformation = (b) => b;

function boiteXfrm(xfrm: Element | undefined): Boite | undefined {
  if (!xfrm) return undefined;
  const off = enfant(xfrm, NS.a, "off");
  const ext = enfant(xfrm, NS.a, "ext");
  if (!off || !ext) return undefined;
  return [entier(off, "x") ?? 0, entier(off, "y") ?? 0, entier(ext, "cx") ?? 0, entier(ext, "cy") ?? 0];
}

function arrondie(b: Boite): Boite {
  return [Math.round(b[0]), Math.round(b[1]), Math.round(b[2]), Math.round(b[3])];
}

function espaceDe(nvPr: Element | undefined): Espace | undefined {
  const ph = nvPr ? enfant(nvPr, NS.p, "ph") : undefined;
  if (!ph) return undefined;
  return { type: ph.getAttribute("type") || "obj", idx: entier(ph, "idx") ?? 0 };
}

function identite(nv: Element | undefined): { id: number; nom: string } {
  const c = nv ? enfant(nv, NS.p, "cNvPr") : undefined;
  return { id: entier(c, "id") ?? 0, nom: c?.getAttribute("name") ?? "" };
}

/** Aplatit un `p:spTree` (ou un `p:grpSp`) en formes à boîte absolue, dans l'ordre du document. */
export function aplatir(arbre: Element, ctx: Contexte, tf: Transformation = IDENTITE, groupe?: number): Forme[] {
  const out: Forme[] = [];
  for (const el of elementsEnfants(arbre)) {
    if (el.namespaceURI !== NS.p) continue;
    const dansGroupe = groupe === undefined ? {} : { groupe };
    if (el.localName === "grpSp") {
      const { id } = identite(enfant(el, NS.p, "nvGrpSpPr"));
      const xfrm = chemin(el, ["p:grpSpPr", "a:xfrm"]);
      const off = xfrm && enfant(xfrm, NS.a, "off");
      const ext = xfrm && enfant(xfrm, NS.a, "ext");
      const chOff = xfrm && enfant(xfrm, NS.a, "chOff");
      const chExt = xfrm && enfant(xfrm, NS.a, "chExt");
      if (!off || !ext || !chOff || !chExt) continue;
      const [ox, oy, ex, ey] = [entier(off, "x") ?? 0, entier(off, "y") ?? 0, entier(ext, "cx") ?? 0, entier(ext, "cy") ?? 0];
      const [cx, cy] = [entier(chOff, "x") ?? 0, entier(chOff, "y") ?? 0];
      const [cex, cey] = [entier(chExt, "cx") || 1, entier(chExt, "cy") || 1];
      const sx = ex / cex;
      const sy = ey / cey;
      const enfantTf: Transformation = (b) => tf([ox + (b[0] - cx) * sx, oy + (b[1] - cy) * sy, b[2] * sx, b[3] * sy]);
      out.push(...aplatir(el, ctx, enfantTf, groupe ?? id));
      continue;
    }
    if (el.localName === "sp") {
      const nv = enfant(el, NS.p, "nvSpPr");
      const { id, nom } = identite(nv);
      const espace = espaceDe(nv ? enfant(nv, NS.p, "nvPr") : undefined);
      const spPr = enfant(el, NS.p, "spPr");
      const boite = boiteXfrm(spPr && enfant(spPr, NS.a, "xfrm")) ?? (espace ? ctx.heritage(espace) : undefined);
      if (!boite) continue;
      const prst = spPr && enfant(spPr, NS.a, "prstGeom");
      const libre = spPr && enfant(spPr, NS.a, "custGeom");
      const txBox = chemin(el, ["p:nvSpPr", "p:cNvSpPr"])?.getAttribute("txBox") === "1";
      const nature: Nature = espace ? "espace" : libre ? "libre" : prst && !txBox ? "forme" : txBox ? "texte" : "autre";
      const corps = enfant(el, NS.p, "txBody");
      out.push({
        id, nom, nature, boite: arrondie(tf(boite)),
        ...(prst ? { geometrie: prst.getAttribute("prst") ?? "" } : {}),
        ...(spPr && enfant(spPr, NS.a, "noFill") ? { sansRemplissage: true as const } : {}),
        ...(espace ? { espace } : {}),
        texte: corps ? paragraphes(corps) : [],
        ...dansGroupe,
      });
      continue;
    }
    if (el.localName === "pic") {
      const nv = enfant(el, NS.p, "nvPicPr");
      const { id, nom } = identite(nv);
      const espace = espaceDe(nv ? enfant(nv, NS.p, "nvPr") : undefined);
      const boite = boiteXfrm(chemin(el, ["p:spPr", "a:xfrm"])) ?? (espace ? ctx.heritage(espace) : undefined);
      if (!boite) continue;
      const blipFill = enfant(el, NS.p, "blipFill");
      const blip = blipFill && enfant(blipFill, NS.a, "blip");
      const media = blip ? ctx.media(blip.getAttributeNS(NS.r, "embed") ?? "") : undefined;
      const src = blipFill && enfant(blipFill, NS.a, "srcRect");
      const rognage = src ? ([entier(src, "l") ?? 0, entier(src, "t") ?? 0, entier(src, "r") ?? 0, entier(src, "b") ?? 0] as const) : undefined;
      out.push({
        id, nom, nature: "image", boite: arrondie(tf(boite)),
        ...(espace ? { espace } : {}),
        ...(media ? { media } : {}),
        ...(rognage && rognage.some((v) => v !== 0) ? { rognage } : {}),
        ...dansGroupe,
      });
      continue;
    }
    if (el.localName === "graphicFrame") {
      const { id, nom } = identite(enfant(el, NS.p, "nvGraphicFramePr"));
      const boite = boiteXfrm(enfant(el, NS.p, "xfrm"));
      if (!boite) continue;
      const donnees = chemin(el, ["a:graphic", "a:graphicData"]);
      const uri = donnees?.getAttribute("uri") ?? "";
      const tbl = donnees && enfant(donnees, NS.a, "tbl");
      if (tbl) {
        const lignes = enfants(tbl, NS.a, "tr").map((tr) =>
          enfants(tr, NS.a, "tc").map((tc) => {
            const corps = enfant(tc, NS.a, "txBody");
            return corps ? paragraphes(corps).join("\n").trim() : "";
          }),
        );
        out.push({ id, nom, nature: "tableau", boite: arrondie(tf(boite)), lignes, ...dansGroupe });
      } else {
        out.push({ id, nom, nature: "graphique", boite: arrondie(tf(boite)), graphique: uri.split("/").pop() ?? "", ...dansGroupe });
      }
      continue;
    }
    if (el.localName === "cxnSp") {
      const { id, nom } = identite(enfant(el, NS.p, "nvCxnSpPr"));
      const boite = boiteXfrm(chemin(el, ["p:spPr", "a:xfrm"]));
      if (boite) out.push({ id, nom, nature: "trait", boite: arrondie(tf(boite)), ...dansGroupe });
    }
  }
  return out;
}

interface TableEspaces {
  readonly parIdx: ReadonlyMap<number, { readonly type: string; readonly boite: Boite | undefined }>;
  readonly parType: ReadonlyMap<string, Boite | undefined>;
}

function tableEspaces(paquet: Paquet, partie: string | undefined): TableEspaces {
  const parIdx = new Map<number, { type: string; boite: Boite | undefined }>();
  const parType = new Map<string, Boite | undefined>();
  const arbre = partie ? chemin(paquet.racine(partie), ["p:cSld", "p:spTree"]) : undefined;
  if (arbre) {
    for (const el of elementsEnfants(arbre)) {
      const nv = el.localName === "sp" ? enfant(el, NS.p, "nvSpPr") : el.localName === "pic" ? enfant(el, NS.p, "nvPicPr") : undefined;
      const espace = espaceDe(nv ? enfant(nv, NS.p, "nvPr") : undefined);
      if (!espace) continue;
      const boite = boiteXfrm(chemin(el, ["p:spPr", "a:xfrm"]));
      if (!parIdx.has(espace.idx)) parIdx.set(espace.idx, { type: espace.type, boite });
      if (!parType.has(espace.type)) parType.set(espace.type, boite);
    }
  }
  return { parIdx, parType };
}

/** Le type d'espace du masque dont hérite un espace de disposition (règle de python-pptx). */
function typeDeMasque(type: string): string {
  if (type === "title" || type === "ctrTitle") return "title";
  if (type === "dt" || type === "ftr" || type === "sldNum") return type;
  return "body";
}

/** Les formes aplaties d'une diapositive, espaces réservés résolus par la disposition puis le masque. */
export function formesDeDiapositive(paquet: Paquet, diapo: string): Forme[] {
  const disposition = paquet.disposition(diapo)?.chemin;
  const masque = disposition ? paquet.masqueDe(disposition) : undefined;
  const dDisposition = tableEspaces(paquet, disposition);
  const dMasque = tableEspaces(paquet, masque);
  const medias = new Map(paquet.relations(diapo).filter((r) => r.type === "image").map((r) => [r.id, r.cible]));
  const arbre = chemin(paquet.racine(diapo), ["p:cSld", "p:spTree"]);
  if (!arbre) return [];
  return aplatir(arbre, {
    heritage: ({ idx }) => {
      const base = dDisposition.parIdx.get(idx);
      if (!base) return undefined;
      return base.boite ?? dMasque.parType.get(typeDeMasque(base.type));
    },
    media: (rId) => medias.get(rId),
  });
}
