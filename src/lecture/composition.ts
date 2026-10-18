// La lecture d'une composition en formes natives (PKG-C3) : bandeaux, phases et couloirs par leur nom, les étapes par
// leur place (la colonne sous laquelle, le couloir dans lequel elles sont posées), leur manière par leur fond et leur
// trait, le signal par le triangle posé sur l'étape. Ce que le client déplace change de case ; ce qu'il réécrit est relu.
import type { Element } from "@xmldom/xmldom";
import { NS, chemin, elementsEnfants, enfant } from "../ooxml/paquet";
import type { Composition, Role, Vignette } from "../pivot/seance-spec";
import { NOMS, numeroDeNom } from "../emission/grammaire";
import { fondDe, lireGroupe, reference, repereDeGroupe, traitDe, type Boite, type LecteurDeDessin, type Repere } from "./dessin";

type Bord = "plein" | "tirets" | "aucun";

interface FormeLue {
  readonly nom: string;
  readonly boite: Boite;
  readonly geometrie: string;
  readonly fond: Role | undefined;
  readonly bord: Bord;
  readonly paragraphes: readonly string[];
  /** Le signal d'une étape groupée avec son triangle. */
  readonly signal?: Role;
}

const centre = (b: Boite): [number, number] => [b[0] + b[2] / 2, b[1] + b[3] / 2];
const dedans = (p: readonly [number, number], b: Boite) => p[0] >= b[0] && p[0] <= b[0] + b[2] && p[1] >= b[1] && p[1] <= b[1] + b[3];

function texteDuParagraphe(p: Element): string {
  return elementsEnfants(p).map((c) => (c.localName === "r" || c.localName === "fld" ? enfant(c, NS.a, "t")?.textContent ?? "" : c.localName === "br" ? "\n" : "")).join("");
}

/** Les formes d'une diapositive (groupes formés dans PowerPoint aplatis), sauf les vignettes, relues à part. */
function formesLues(arbre: Element, l: LecteurDeDessin, repere: Repere = (b) => b): FormeLue[] {
  const out: FormeLue[] = [];
  for (const el of elementsEnfants(arbre)) {
    if (el.namespaceURI !== NS.p) continue;
    const nom = chemin(el, [el.localName === "grpSp" ? "p:nvGrpSpPr" : "p:nvSpPr", "p:cNvPr"])?.getAttribute("name") ?? "";
    if (el.localName === "grpSp") {
      if (nom.startsWith(NOMS.signe) || nom.startsWith(NOMS.illustration) || nom.startsWith(NOMS.schema)) continue;
      const g = repereDeGroupe(el);
      const lues = g ? formesLues(el, l, (b) => repere(g.repere(b))) : [];
      // Une étape et son signal, groupés : la carte, qui porte le signal du triangle.
      if (nom.startsWith(NOMS.etape)) {
        const carte = lues.find((f) => f.nom !== NOMS.signal);
        const signal = lues.find((f) => f.nom === NOMS.signal)?.fond;
        if (carte) out.push({ ...carte, nom: carte.nom.startsWith(NOMS.etape) ? carte.nom : nom, ...(signal ? { signal } : {}) });
        continue;
      }
      out.push(...lues);
      continue;
    }
    if (el.localName !== "sp") continue;
    const spPr = enfant(el, NS.p, "spPr");
    const xfrm = spPr && enfant(spPr, NS.a, "xfrm");
    const off = xfrm && enfant(xfrm, NS.a, "off");
    const ext = xfrm && enfant(xfrm, NS.a, "ext");
    if (!off || !ext) continue;
    const n = (e: Element, a: string) => Number(e.getAttribute(a) || 0);
    // La manière : le fond (rôle), le bord (plein, en tirets, ou sans).
    const ln = spPr ? enfant(spPr, NS.a, "ln") : undefined;
    const trait = traitDe(ln, l, reference(el, "lnRef"));
    const tirets = ln ? enfant(ln, NS.a, "prstDash")?.getAttribute("val") : undefined;
    const txBody = enfant(el, NS.p, "txBody");
    out.push({
      nom,
      boite: repere([n(off, "x"), n(off, "y"), n(ext, "cx"), n(ext, "cy")]),
      geometrie: (spPr && chemin(spPr, ["a:prstGeom"])?.getAttribute("prst")) || "rect",
      fond: fondDe(spPr, el, l),
      bord: !trait ? "aucun" : tirets && tirets !== "solid" ? "tirets" : "plein",
      paragraphes: txBody ? Array.from(txBody.getElementsByTagNameNS(NS.a, "p")).map(texteDuParagraphe) : [],
    });
  }
  return out;
}

function legendeDe(formes: readonly FormeLue[]): Composition["legende"] {
  const libelles = formes.flatMap((f) => { const m = f.nom.match(/^G·légende (\d+)$/); return m ? [{ n: Number(m[1]), f }] : []; });
  if (!libelles.length) return undefined;
  return libelles.sort((a, b) => a.n - b.n).map(({ n, f }) => {
    const e = formes.find((g) => g.nom.startsWith(`${NOMS.legende} ${n} ·`));
    return {
      texte: f.paragraphes.join("\n"),
      ...(e?.geometrie === "triangle" ? { forme: "triangle" as const } : {}),
      ...(e?.fond ? { fond: e.fond } : {}),
      bord: e?.bord ?? "aucun",
    };
  });
}

/** L'indice de la boîte qui contient le point sur un axe (0 : x, 1 : y), la plus proche sinon. */
function rangSur(boites: readonly Boite[], p: number, axe: 0 | 1): number {
  const k = boites.findIndex((b) => p >= b[axe] && p <= b[axe] + b[axe + 2]!);
  if (k >= 0) return k;
  let meilleur = 0;
  boites.forEach((b, i) => { if (Math.abs(b[axe] + b[axe + 2]! / 2 - p) < Math.abs(boites[meilleur]![axe] + boites[meilleur]![axe + 2]! / 2 - p)) meilleur = i; });
  return meilleur;
}

export interface CompositionLue {
  readonly composition: Composition;
  readonly ecarts: readonly string[];
}

/** La composition posée sur une diapositive, si elle en porte une ; `tableaux` = les tableaux posés à côté des vignettes. */
export function lireComposition(arbre: Element, tableaux: readonly Element[], l: LecteurDeDessin): CompositionLue | null {
  const formes = formesLues(arbre, l);
  const ecarts: string[] = [];
  const etapes = formes.filter((f) => f.nom === NOMS.etape || f.nom.startsWith(`${NOMS.etape} `));
  const legende = legendeDe(formes);
  const groupes = elementsEnfants(arbre).filter((e) => e.localName === "grpSp");
  const nomDuGroupe = (g: Element) => chemin(g, ["p:nvGrpSpPr", "p:cNvPr"])?.getAttribute("name") ?? "";
  const vignette = (g: Element): Vignette => {
    const proprietaire = nomDuGroupe(g).replace(/^G·/, "");
    return lireGroupe(g, tableaux.filter((t) => (chemin(t, ["p:nvGraphicFramePr", "p:cNvPr"])?.getAttribute("name") ?? "").startsWith(`${NOMS.grille} · ${proprietaire} ·`)), l);
  };

  const bandeaux = formes.filter((f) => numeroDeNom(f.nom, NOMS.cas) !== undefined).sort((a, b) => a.boite[0] - b.boite[0]);
  if (bandeaux.length) {
    const colonnes = bandeaux.map((b) => [b.boite[0], b.boite[1], b.boite[2], b.boite[3]] as Boite);
    const parCas = bandeaux.map(() => [] as FormeLue[]);
    for (const e of etapes) parCas[rangSur(colonnes, centre(e.boite)[0], 0)]!.push(e);
    const composition: Composition = {
      gabarit: "cas",
      cas: bandeaux.map((b, i) => ({
        numero: numeroDeNom(b.nom, NOMS.cas)!,
        titre: b.paragraphes.join("\n"),
        ...(b.fond ? { couleur: b.fond } : {}),
        etapes: parCas[i]!.sort((x, y) => x.boite[1] - y.boite[1]).map((e, j) => {
          const [texte = "", ...detail] = e.paragraphes;
          const numero = numeroDeNom(e.nom, NOMS.etape);
          if (numero === undefined) ecarts.push(`une étape sans numéro (« ${texte.slice(0, 40)} ») : numérotée ${j + 1}`);
          return { numero: numero ?? j + 1, texte, ...(detail.length ? { detail: detail.join("\n") } : {}), ...(e.fond ? { fond: e.fond } : {}), bord: e.bord };
        }),
      })),
      ...(legende ? { legende } : {}),
    };
    return { composition, ecarts };
  }

  const phases = formes.filter((f) => numeroDeNom(f.nom, NOMS.phase) !== undefined).sort((a, b) => a.boite[0] - b.boite[0]);
  if (!phases.length) return null;
  const couloirs = formes.filter((f) => numeroDeNom(f.nom, NOMS.couloir) !== undefined).sort((a, b) => a.boite[1] - b.boite[1]);
  const signes = groupes.filter((g) => nomDuGroupe(g).startsWith(`${NOMS.signe} `));
  const illustration = groupes.find((g) => nomDuGroupe(g) === NOMS.illustration);
  const signaux = formes.filter((f) => f.nom === NOMS.signal);
  const signalDe = new Map<FormeLue, Role>(etapes.flatMap((e) => (e.signal ? [[e, e.signal] as const] : [])));
  // Un triangle détaché de son étape (groupe défait) : à l'étape sur laquelle il est posé, la plus proche sinon.
  for (const s of signaux) {
    const c = centre(s.boite);
    const e = etapes.find((x) => dedans(c, x.boite))
      ?? [...etapes].sort((a, b) => Math.hypot(centre(a.boite)[0] - c[0], centre(a.boite)[1] - c[1]) - Math.hypot(centre(b.boite)[0] - c[0], centre(b.boite)[1] - c[1]))[0];
    if (e && s.fond) signalDe.set(e, s.fond);
  }
  const placeDu = (g: Element) => repereDeGroupe(g)?.place;
  const composition: Composition = {
    gabarit: "tableau",
    colonnes: phases.map((p) => ({ titre: p.paragraphes.join("\n"), ...(p.fond ? { couleur: p.fond } : {}) })),
    lignes: couloirs.map((c) => {
      const signe = signes.find((g) => { const p = placeDu(g); return p ? dedans(centre(p), c.boite) : false; });
      return { titre: c.paragraphes.join("\n"), ...(signe ? { signe: vignette(signe) } : {}) };
    }),
    etapes: etapes.map((e) => {
      const [cx, cy] = centre(e.boite);
      const numero = numeroDeNom(e.nom, NOMS.etape);
      const signal = signalDe.get(e);
      return {
        ligne: rangSur(couloirs.map((c) => c.boite), cy, 1), colonne: rangSur(phases.map((p) => p.boite), cx, 0),
        ...(numero !== undefined ? { numero } : {}), texte: e.paragraphes.join("\n"),
        ...(signal ? { signal } : {}), ...(e.fond ? { fond: e.fond } : {}), bord: e.bord,
      };
    }),
    ...(illustration ? { illustration: vignette(illustration) } : {}),
    ...(legende ? { legende } : {}),
  };
  return { composition, ecarts };
}
