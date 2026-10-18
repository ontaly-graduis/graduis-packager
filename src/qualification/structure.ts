// L'organisation sémantique d'une diapositive de texte : rangées et colonnes de cadres, intertitres, paragraphes,
// listes (et leurs détails), définitions — lue sur les signaux typographiques du deck (graisse, corps, puces, niveaux,
// deux-points), pas sur leur seule succession.
import type { Boite } from "../ooxml/formes";
import type { Corps as CorpsLu, Paragraphe as ParagrapheLu } from "../ooxml/styles";
import type { Noeud, Structure } from "../pivot/seance-spec";
import type { FormeReleve } from "../releve/releve";
import { ecartBord } from "../releve/geometrie";

/** Seuils de lecture (mesurés sur le premier corpus, 17/10). */
export const SEUILS_STRUCTURE = {
  /** Un intertitre ou un terme : au plus tant de mots. */
  motsTitre: 12,
  motsTerme: 10,
  /** Des paragraphes courts qui se suivent sont une liste qui ne dit pas ses puces. */
  motsItemImplicite: 25,
  /** Un corps plus grand d'autant que le corps courant du cadre fait un intertitre ; plus petit, un détail. */
  titre: 1.2,
  detail: 0.9,
  /** Deux cadres sont dans la même rangée si leurs hauteurs se recouvrent d'autant (de la plus petite). */
  rangee: 0.5,
  /** Deux cadres s'empilent dans une colonne s'ils se recouvrent en largeur d'autant (du plus étroit), de largeurs
   *  comparables, séparés d'au plus `ecartPile` points. */
  pileLargeur: 0.5,
  pileRapport: 0.55,
  ecartPile: 36,
} as const;

interface Ligne {
  readonly texte: string;
  readonly brut: string;
  readonly toutGras: boolean;
  readonly taille: number;
  readonly niveau: number;
  readonly puce: ParagrapheLu["puce"];
}

const mots = (s: string) => s.match(/\S+/gu)?.length ?? 0;

/** Le texte d'un paragraphe, la graisse gardée en `**…**` (espaces hors des marques). */
function enLigne(p: ParagrapheLu): Ligne | null {
  let texte = "";
  let brut = "";
  let gras = 0;
  let tous = 0;
  let taille = 0;
  for (const f of p.fragments) {
    brut += f.texte;
    const t = f.texte;
    if (!t.trim()) {
      texte += t;
      continue;
    }
    tous += t.trim().length;
    taille = Math.max(taille, f.taille);
    if (f.gras) {
      gras += t.trim().length;
      const [, avant, coeur, apres] = t.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
      texte += `${avant}**${coeur}**${apres}`;
    } else texte += t;
  }
  texte = texte.replace(/\*\*\*\*/g, "").replace(/\*\*(\s+)\*\*/g, "$1").replace(/[ \t]+/g, " ").trim();
  if (!brut.trim()) return null;
  return { texte, brut: brut.replace(/\s+/g, " ").trim(), toutGras: tous > 0 && gras === tous, taille, niveau: p.niveau, puce: p.puce };
}

/** Le corps courant d'un cadre : celui qui porte le plus de caractères. */
function corpsCourant(lignes: readonly Ligne[]): number {
  const poids = new Map<number, number>();
  for (const l of lignes) poids.set(l.taille, (poids.get(l.taille) ?? 0) + l.brut.length);
  return [...poids].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
}

const PUCE_SAISIE = /^\s*(?:[>•▪◦‣–-]|\*\*[>•–-]\*\*)\s+/;
const NUMERO_SAISI = /^\s*(?:\*\*)?\d{1,2}[.)](?:\*\*)?\s+/;
const sansPuce = (s: string) => s.replace(PUCE_SAISIE, "").replace(/^\*\*\s*\*\*/, "").trim();

/** Ôte une marque de graisse orpheline (un nombre impair de `**`), au début ou à la fin. */
function equilibre(s: string): string {
  if ((s.match(/\*\*/g)?.length ?? 0) % 2 === 0) return s;
  return s.startsWith("**") ? s.slice(2).trim() : s.endsWith("**") ? s.slice(0, -2).trim() : s.replace("**", "");
}

/** « Terme : définition » ; le terme peut être en gras (une ligne toute en gras se lit sans ses marques). */
function definition(l: Ligne): { terme: string; texte: string; grasTerme: boolean } | null {
  const source = l.toutGras ? l.brut : sansPuce(l.texte);
  const m = source.match(/^(\*\*)?([^:*]{2,80}?)\s*(\*\*)?\s*:\s*(?:\*\*\s*\*\*)?\s*(\S[\s\S]*)$/);
  if (!m) return null;
  const terme = m[2]!.trim();
  const texte = equilibre(m[4]!.trim());
  if (mots(terme) > SEUILS_STRUCTURE.motsTerme || mots(texte.replace(/\*\*/g, "")) < 2 || /https?$/i.test(terme)) return null;
  return { terme, texte, grasTerme: !!m[1] };
}

type Unite =
  | { k: "titre"; texte: string; taille: number }
  | { k: "para"; texte: string; court: boolean }
  | { k: "item"; texte: string; numero: boolean; niveau: number }
  | { k: "detail"; texte: string }
  | { k: "def"; terme: string; texte: string; fort: boolean };

function unites(lus: readonly Ligne[]): Unite[] {
  const base = corpsCourant(lus);
  const S = SEUILS_STRUCTURE;
  // Un cadre tout en gras : la graisse y est la manière du cadre, pas un signal ; on la quitte.
  const caracteres = lus.reduce((a, l) => a + l.brut.length, 0);
  const enGras = lus.filter((l) => l.toutGras).reduce((a, l) => a + l.brut.length, 0);
  const lignes = enGras >= 0.8 * caracteres ? lus.map((l) => ({ ...l, texte: l.texte.replace(/\*\*/g, ""), toutGras: false })) : lus;
  const out: Unite[] = [];
  let definitions = 0;
  lignes.forEach((l, i) => {
    const suivante = lignes[i + 1];
    const d = definition(l);
    const plusGrand = base > 0 && l.taille >= base * S.titre;
    const plusPetit = base > 0 && l.taille <= base * S.detail;
    const prec = out[out.length - 1];
    const enListe = PUCE_SAISIE.test(l.texte) || NUMERO_SAISI.test(l.texte) || l.puce === "car" || l.puce === "num" || l.niveau > 0;
    // Des puces « Terme : définition », le terme en gras : des définitions, pas une liste.
    if (enListe && d?.grasTerme) {
      definitions++;
      out.push({ k: "def", terme: d.terme, texte: d.texte, fort: true });
    } else if (enListe && [...out].reverse().find((x) => x.k !== "detail")?.k === "def" && (prec?.k === "def" || prec?.k === "detail")) {
      // Une puce sous une définition la précise.
      out.push({ k: "detail", texte: sansPuce(l.texte) });
    } else if (enListe) {
      const numero = l.puce === "num" || NUMERO_SAISI.test(l.texte);
      if (prec?.k === "item" && l.niveau > prec.niveau) out.push({ k: "detail", texte: sansPuce(l.texte) });
      else out.push({ k: "item", texte: sansPuce(l.texte).replace(NUMERO_SAISI, ""), numero, niveau: l.niveau });
    } else if (plusPetit && (prec?.k === "item" || prec?.k === "detail")) {
      out.push({ k: "detail", texte: l.texte });
    } else if (d && (d.grasTerme || (suivante !== undefined && definition(suivante) !== null) || definitions > 0)) {
      definitions++;
      out.push({ k: "def", terme: d.terme, texte: d.texte, fort: d.grasTerme });
    } else if ((l.toutGras || plusGrand) && mots(l.brut) <= S.motsTitre && suivante) {
      out.push({ k: "titre", texte: l.texte.replace(/\*\*/g, "").replace(/\s*:\s*$/, "").trim(), taille: l.taille });
    } else {
      out.push({ k: "para", texte: l.texte, court: mots(l.brut) <= S.motsItemImplicite && !/[.!?]\s*$/.test(l.brut) });
    }
  });
  // Des « intertitres » qui se suivent au même corps ne titrent rien : ce sont des lignes d'une liste.
  return out.map((x, i) => {
    const voisin = [out[i - 1], out[i + 1]].find((y) => y?.k === "titre" && y.taille === (x as { taille?: number }).taille);
    return x.k === "titre" && voisin ? { k: "para" as const, texte: x.texte, court: true } : x;
  });
}

/** Les unités d'un cadre en nœuds : listes et définitions regroupées, paragraphes courts en liste implicite. */
function noeuds(u: readonly Unite[]): Noeud[] {
  const out: Noeud[] = [];
  for (let i = 0; i < u.length; i++) {
    const x = u[i]!;
    const dernier = out[out.length - 1];
    if (x.k === "titre") out.push({ type: "titre", texte: x.texte });
    else if (x.k === "def") {
      if (dernier?.type === "definitions") dernier.entrees.push({ terme: x.terme, texte: x.texte });
      else out.push({ type: "definitions", entrees: [{ terme: x.terme, texte: x.texte }] });
    } else if (x.k === "item") {
      if (dernier?.type === "liste" && (dernier.numerotee === true) === x.numero) dernier.items.push({ texte: x.texte });
      else out.push({ type: "liste", ...(x.numero ? { numerotee: true as const } : {}), items: [{ texte: x.texte }] });
    } else if (x.k === "detail") {
      const porteur = dernier?.type === "liste" ? dernier.items[dernier.items.length - 1] : dernier?.type === "definitions" ? dernier.entrees[dernier.entrees.length - 1] : undefined;
      if (porteur) porteur.details = [...(porteur.details ?? []), x.texte];
      else out.push({ type: "paragraphe", texte: x.texte });
    } else {
      // Deux paragraphes courts ou plus, sans ponctuation finale : une liste qui ne dit pas ses puces.
      let j = i;
      while (u[j]?.k === "para" && (u[j] as { court: boolean }).court) j++;
      if (j - i >= 2) {
        out.push({ type: "liste", items: u.slice(i, j).map((p) => ({ texte: (p as { texte: string }).texte })) });
        i = j - 1;
      } else out.push({ type: "paragraphe", texte: x.texte });
    }
  }
  // Une définition isolée, au terme non gras, redevient un paragraphe.
  return out.map((n) => (n.type === "definitions" && n.entrees.length === 1 && !n.entrees[0]!.details && !u.some((x) => x.k === "def" && x.fort) ? { type: "paragraphe" as const, texte: `${n.entrees[0]!.terme} : ${n.entrees[0]!.texte}` } : n));
}

const recouvre = (a: Boite, b: Boite) => {
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
  return h / Math.max(1, Math.min(a[3], b[3]));
};

const POINT = 12700;

/**
 * Les indications numérales priment : quand des pastilles 1…N annoncent chacune un cadre (le plus proche, pas le mieux
 * aligné — les étapes clés ne le sont pas toujours), le texte est une liste numérotée dans l'ordre des numéros.
 */
function listeNumerotee(lus: readonly { f: FormeReleve; lignes: Ligne[] }[], pastilles: readonly FormeReleve[]): Structure | null {
  const numeros = pastilles.map((p) => ({ p, n: Number((p.texte ?? []).join("").trim()) })).filter((x) => Number.isInteger(x.n) && x.n > 0);
  const tries = [...numeros].sort((a, b) => a.n - b.n);
  if (tries.length < 2 || !tries.every((x, i) => x.n === i + 1) || tries.length !== lus.length) return null;
  const pris = new Set<number>();
  const items: { texte: string; details?: string[] }[] = [];
  for (const { p } of tries) {
    const proche = lus.map((x, i) => ({ i, d: ecartBord(p.boite, x.f.boite) })).filter((c) => !pris.has(c.i)).sort((a, b) => a.d - b.d)[0];
    if (!proche || proche.d > 4 * Math.max(p.boite[2], p.boite[3])) return null;
    pris.add(proche.i);
    // Un cadre tout en gras : la graisse est sa manière, pas une emphase.
    const [premiere, ...reste] = lus[proche.i]!.lignes.map((l) => (l.toutGras ? l.texte.replace(/\*\*/g, "") : l.texte));
    items.push({ texte: premiere ?? "", ...(reste.length ? { details: reste } : {}) });
  }
  return { rangees: [{ colonnes: [{ noeuds: [{ type: "liste", numerotee: true, items }] }] }] };
}

/** Deux cadres qui s'empilent : même colonne, largeurs comparables, l'un sous l'autre. */
function sEmpilent(haut: Boite, bas: Boite): boolean {
  const S = SEUILS_STRUCTURE;
  const commun = Math.min(haut[0] + haut[2], bas[0] + bas[2]) - Math.max(haut[0], bas[0]);
  const etroit = Math.min(haut[2], bas[2]);
  const ecart = bas[1] - (haut[1] + haut[3]);
  return commun >= S.pileLargeur * etroit && etroit / Math.max(haut[2], bas[2]) >= S.pileRapport && ecart <= S.ecartPile * POINT && ecart > -0.5 * Math.min(haut[3], bas[3]);
}

const union = (bs: readonly Boite[]): Boite => {
  const x0 = Math.min(...bs.map((b) => b[0]));
  const y0 = Math.min(...bs.map((b) => b[1]));
  return [x0, y0, Math.max(...bs.map((b) => b[0] + b[2])) - x0, Math.max(...bs.map((b) => b[1] + b[3])) - y0];
};

/**
 * La structure d'un ensemble de cadres de texte. Les cadres s'empilent d'abord en colonnes (une fiche faite de plusieurs
 * cadres), puis les colonnes se rangent en rangées de haut en bas, de gauche à droite dans une rangée.
 */
export function structurer(cadres: readonly FormeReleve[], images: readonly FormeReleve[] = [], pastilles: readonly FormeReleve[] = []): Structure | null {
  const lus = cadres
    .map((f) => ({ f, lignes: (f.style?.corps as CorpsLu | undefined)?.paragraphes.map(enLigne).filter((l): l is Ligne => l !== null) ?? [], image: undefined as string | undefined }))
    .filter((x) => x.lignes.length);
  if (!lus.length) return null;
  const numerotee = listeNumerotee(lus, pastilles);
  if (numerotee) return numerotee;
  // Une image (un portrait, l'icône d'un rôle) va au cadre qui la touche : elle l'illustre.
  for (const im of images) {
    if (!im.media) continue;
    const portee = 1.2 * Math.max(im.boite[2], im.boite[3]);
    const proche = lus.map((x) => ({ x, d: ecartBord(im.boite, x.f.boite) })).filter((c) => c.d <= portee).sort((a, b) => a.d - b.d)[0];
    if (proche && !proche.x.image) proche.x.image = im.media;
  }
  const tries = [...lus].sort((a, b) => a.f.boite[1] - b.f.boite[1] || a.f.boite[0] - b.f.boite[0]);
  const piles: (typeof lus)[] = [];
  for (const x of tries) {
    // Une fiche n'a qu'une image : un cadre illustré ne rejoint pas une pile déjà illustrée.
    const p = piles.find((g) => sEmpilent(g[g.length - 1]!.f.boite, x.f.boite) && !(x.image && g.some((y) => y.image)));
    if (p) p.push(x);
    else piles.push([x]);
  }
  const rangees: (typeof piles)[] = [];
  for (const p of piles) {
    const b = union(p.map((x) => x.f.boite));
    const r = rangees.find((g) => g.some((q) => recouvre(b, union(q.map((x) => x.f.boite))) >= SEUILS_STRUCTURE.rangee));
    if (r) r.push(p);
    else rangees.push([p]);
  }
  return {
    rangees: rangees.map((r) => ({
      colonnes: [...r].sort((a, b) => a[0]!.f.boite[0] - b[0]!.f.boite[0]).map((p) => ({
        ...(p.find((x) => x.image) ? { visuel: p.find((x) => x.image)!.image! } : {}),
        noeuds: p.flatMap((x, i) => {
        // Une fiche faite de cadres : le premier, d'une ligne courte, la titre.
        const seule = x.lignes.length === 1 ? x.lignes[0]! : undefined;
        if (i === 0 && p.length > 1 && seule && mots(seule.brut) <= 8) return [{ type: "titre" as const, texte: seule.brut.replace(/\s*:\s*$/, "") }];
        return noeuds(unites(x.lignes));
      }),
      })),
    })),
  };
}
