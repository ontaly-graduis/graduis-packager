// La partition d'un schéma : l'ordre dans lequel il se dévoile en salle — colonne par colonne (un processus en
// phases), ou étape par étape quand ses pastilles le numérotent (un logigramme). Ce qui n'entre dans aucun pas est le
// décor : il est là dès l'entrée.
import type { Dessin, ElementDeDessin } from "../pivot/seance-spec";

type Boite = readonly [number, number, number, number];

/** Seuils (points, proportions), réglés sur les schémas du premier corpus (17/10). */
export const SEUILS_PARTITION = {
  pastilleMax: 30,
  /** Une colonne couvre au moins tant de la hauteur du schéma et tant de sa surface, et contient au moins trois éléments. */
  colonneHauteur: 0.45,
  colonneSurface: 0.04,
  /** Un élément plus large que tant de fois sa colonne la traverse : il est du décor. */
  traverse: 1.4,
  /** L'en-tête d'une colonne la touche presque : à moins de tant de points au-dessus d'elle. */
  enTete: 24,
  /** Une pastille va à la forme qui la touche, à moins de tant de fois sa taille. */
  porteePastille: 2.5,
} as const;

const centre = (b: Boite): [number, number] => [b[0] + b[2] / 2, b[1] + b[3] / 2];
const dedans = (p: readonly [number, number], b: Boite) => p[0] >= b[0] && p[0] <= b[0] + b[2] && p[1] >= b[1] && p[1] <= b[1] + b[3];
const ecart = (b: Boite, c: Boite) => {
  const dx = Math.max(0, c[0] - (b[0] + b[2]), b[0] - (c[0] + c[2]));
  const dy = Math.max(0, c[1] - (b[1] + b[3]), b[1] - (c[1] + c[3]));
  return Math.hypot(dx, dy);
};
const texteDe = (e: ElementDeDessin) => (e.type === "forme" && e.texte ? e.texte.paragraphes.map((p) => p.fragments.map((f) => f.texte).join("")).join(" ").trim() : "");
const estTrait = (e: ElementDeDessin) => e.type === "forme" && /connector|^line$/i.test(e.geometrie);

/** Une pastille numérotée : une petite forme ronde qui ne porte qu'un numéro. */
export function numeroDePastille(e: ElementDeDessin): number | null {
  if (e.type !== "forme" || !["ellipse", "flowChartConnector"].includes(e.geometrie)) return null;
  if (e.boite[2] > SEUILS_PARTITION.pastilleMax || e.boite[3] > SEUILS_PARTITION.pastilleMax) return null;
  const t = texteDe(e);
  return /^\d{1,2}$/.test(t) ? Number(t) : null;
}

/** Les colonnes d'un schéma : de grandes formes côte à côte, hautes, qui en contiennent d'autres. */
export function colonnes(d: Dessin): Boite[] {
  const S = SEUILS_PARTITION;
  const [, , w, h] = d.cadre;
  const candidates = d.elements
    .filter((e) => e.type === "forme" && !estTrait(e) && e.boite[3] >= S.colonneHauteur * h && e.boite[2] * e.boite[3] >= S.colonneSurface * w * h && e.boite[2] < 0.6 * w)
    .map((e) => e.boite)
    .filter((b) => d.elements.filter((x) => x.boite !== b && dedans(centre(x.boite), b)).length >= 3);
  // Côte à côte : aucune ne recouvre une autre de plus d'un quart de sa largeur.
  const tries = [...candidates].sort((a, b) => a[0] - b[0]);
  const retenues: Boite[] = [];
  for (const b of tries) {
    const chevauche = retenues.some((r) => Math.min(r[0] + r[2], b[0] + b[2]) - Math.max(r[0], b[0]) > 0.25 * Math.min(r[2], b[2]));
    if (!chevauche) retenues.push(b);
  }
  return retenues.length >= 3 ? retenues : [];
}

/** Chaque pastille numérotée et la forme qu'elle annonce : la plus proche (pas la mieux alignée — les processus ne le
 *  sont pas toujours) ; à égalité, une forme pleine (une étape) plutôt qu'une note, puis la plus proche du centre. */
function apparier(elements: readonly ElementDeDessin[]): { pastille: number; forme: number | null; n: number }[] {
  const S = SEUILS_PARTITION;
  const pastilles = elements.map((e, i) => ({ i, n: numeroDePastille(e) })).filter((x): x is { i: number; n: number } => x.n !== null);
  const formes = elements.map((e, i) => ({ e, i })).filter(({ e, i }) => e.type === "forme" && !estTrait(e) && !pastilles.some((p) => p.i === i) && texteDe(e));
  const prises = new Set<number>();
  // Les pastilles les plus proches d'une forme se servent d'abord.
  const candidats = pastilles.map((p) => {
    const b = elements[p.i]!.boite;
    const c0 = centre(b);
    const tries = formes
      .map((f) => ({ f: f.i, d: ecart(b, f.e.boite), plein: f.e.type === "forme" && f.e.fond ? 0 : 1, dc: Math.hypot(centre(f.e.boite)[0] - c0[0], centre(f.e.boite)[1] - c0[1]) }))
      .filter((x) => x.d <= S.porteePastille * Math.max(b[2], b[3]))
      .sort((a, c) => Math.floor(a.d / 4) - Math.floor(c.d / 4) || a.plein - c.plein || a.dc - c.dc);
    return { p, tries };
  }).sort((a, b) => (a.tries[0]?.d ?? 1e9) - (b.tries[0]?.d ?? 1e9));
  const out: { pastille: number; forme: number | null; n: number }[] = [];
  for (const { p, tries } of candidats) {
    const f = tries.find((x) => !prises.has(x.f));
    if (f) prises.add(f.f);
    out.push({ pastille: p.i, forme: f?.f ?? null, n: p.n });
  }
  return out.sort((a, b) => a.pastille - b.pastille);
}

/**
 * Pose le pas de chaque élément ; rend le dessin inchangé s'il n'a ni colonnes ni étapes numérotées. Les indications
 * numérales priment : une forme suit la pastille qui l'annonce (pas son alignement), les colonnes se rangent par le numéro
 * de leur en-tête quand elles en portent un, et dans un pas les éléments paraissent dans l'ordre de leurs numéros.
 */
export function partitionner(d: Dessin): Dessin {
  const S = SEUILS_PARTITION;
  const elements = d.elements.map((e) => ({ ...e }));
  const pose = (i: number, pas: number) => { (elements[i] as { pas?: number }).pas = pas; };
  const range = (i: number, ordre: number) => { (elements[i] as { ordre?: number }).ordre = ordre; };
  const paires = apparier(elements);
  const cols = colonnes(d);
  if (cols.length) {
    // Un élément enclos dans une forme du décor (le cadre d'une légende) est du décor.
    // (Sauf l'en-tête lui-même : la pastille posée sur le bandeau d'une colonne est de la colonne.)
    const proche = (b: Boite) => cols.some((c) => centre(b)[1] < c[1] && c[1] - (b[1] + b[3]) <= S.enTete && centre(b)[0] >= c[0] && centre(b)[0] <= c[0] + c[2]);
    const enclos = (b: Boite) => d.elements.some((x) => x.boite !== b && !cols.includes(x.boite) && x.boite[2] * x.boite[3] > b[2] * b[3] * 2
      && dedans(centre(b), x.boite) && !cols.some((c) => dedans(centre(x.boite), c)) && !proche(x.boite));
    const colonneDe = (e: ElementDeDessin): number => {
      const [cx, cy] = centre(e.boite);
      const k = cols.findIndex((c) => cx >= c[0] && cx <= c[0] + c[2]);
      const c = cols[k];
      if (!c || e.boite[2] > S.traverse * c[2]) return -1;
      // Dans la colonne, ou juste au-dessus d'elle (son en-tête) ; pas au-dessous, ni dans un cadre du décor.
      const dansLaColonne = cy >= c[1] && cy <= c[1] + c[3];
      const enTete = cy < c[1] && c[1] - (e.boite[1] + e.boite[3]) <= S.enTete && !enclos(e.boite);
      return dansLaColonne || enTete ? k : -1;
    };
    const k = elements.map(colonneDe);
    // Une pastille et la forme qu'elle annonce vont ensemble, dans la colonne de la forme (la plus grande des deux, la plus
    // sûre : une pastille posée au bord d'un bandeau déborde souvent sur la colonne voisine) ; à défaut, de la pastille.
    for (const p of paires) {
      if (p.forme === null) continue;
      const j = k[p.forme]! >= 0 ? k[p.forme]! : k[p.pastille]!;
      k[p.forme] = j;
      k[p.pastille] = j;
    }
    // L'en-tête numéroté d'une colonne : la pastille dont la forme est au-dessus de la colonne (son bandeau).
    const entetes = cols.map((c, j) => paires.filter((p) => k[p.pastille] === j && p.forme !== null && centre(elements[p.forme]!.boite)[1] < c[1])
      .sort((a, b) => elements[a.pastille]!.boite[1] - elements[b.pastille]!.boite[1])[0]);
    const numerotees = entetes.every((e) => e) && new Set(entetes.map((e) => e!.n)).size === cols.length
      && entetes.every((e) => e!.n >= 1 && e!.n <= cols.length);
    const pasDeColonne = (j: number) => (numerotees ? entetes[j]!.n : j + 1);
    k.forEach((j, i) => { if (j >= 0) pose(i, pasDeColonne(j)); });
    for (const p of paires) {
      const enTete = entetes.some((e) => e?.pastille === p.pastille);
      range(p.pastille, enTete ? 0 : p.n);
      if (p.forme !== null) range(p.forme, enTete ? 0 : p.n);
    }
    return { ...d, elements, partition: { mode: "colonnes", pas: cols.length } };
  }
  // Des pastilles numérotées 1…N, chacune une fois : un pas par numéro.
  const numeros = paires.map((p) => p.n).sort((a, b) => a - b);
  const suite = numeros.length >= 3 && numeros.every((n, i) => n === i + 1);
  if (!suite) return d;
  for (const p of paires) {
    pose(p.pastille, p.n);
    range(p.pastille, 0);
    if (p.forme !== null && !(elements[p.forme] as { pas?: number }).pas) {
      pose(p.forme, p.n);
      range(p.forme, 0);
    }
  }
  // Les traits suivent le flux : un trait qui part d'une forme d'un pas en est ; la forme où il arrive, si elle n'a pas
  // de pas (une décision, un renvoi), en est aussi. Un libellé collé à un trait (« Oui », « Non ») suit ce trait.
  const pasDe = (i: number) => (elements[i] as { pas?: number }).pas;
  const bouts = (e: ElementDeDessin): { de: [number, number]; vers: [number, number] } => {
    const [x, y, w, h] = e.boite;
    const r = e.type === "forme" ? e.retournement ?? "" : "";
    const a: [number, number] = [r.includes("h") ? x + w : x, r.includes("v") ? y + h : y];
    const b: [number, number] = [r.includes("h") ? x : x + w, r.includes("v") ? y : y + h];
    const inverse = e.type === "forme" && !!e.trait?.debut && !e.trait.fin;
    return inverse ? { de: b, vers: a } : { de: a, vers: b };
  };
  const formeAu = (p: [number, number], sauf: number) => elements
    .map((x, j) => ({ j, d: ecart([p[0], p[1], 0, 0], x.boite) }))
    .filter(({ j }) => j !== sauf && !estTrait(elements[j]!) && elements[j]!.boite[2] * elements[j]!.boite[3] < 0.2 * d.cadre[2] * d.cadre[3])
    .sort((a, b) => a.d - b.d)[0];
  for (let tour = 0; tour < 12; tour++) {
    let change = false;
    elements.forEach((e, i) => {
      if (!estTrait(e) || pasDe(i)) return;
      const { de, vers } = bouts(e);
      const source = formeAu(de, i);
      if (!source || source.d > 12 || !pasDe(source.j)) return;
      pose(i, pasDe(source.j)!);
      change = true;
      const cible = formeAu(vers, i);
      if (cible && cible.d <= 12 && !pasDe(cible.j) && numeroDePastille(elements[cible.j]!) === null) pose(cible.j, pasDe(source.j)!);
    });
    // Un libellé collé à un trait (« Oui », « Non ») suit ce trait.
    elements.forEach((e, i) => {
      if (pasDe(i) || e.type !== "forme" || estTrait(e) || e.fond || !texteDe(e) || texteDe(e).split(/\s+/).length > 3) return;
      const trait = elements.map((x, j) => ({ j, d: ecart(e.boite, x.boite) })).filter(({ j }) => estTrait(elements[j]!) && pasDe(j)).sort((a, b) => a.d - b.d)[0];
      if (trait && trait.d <= 12) { pose(i, pasDe(trait.j)!); change = true; }
    });
    // Une forme qui porte le texte d'un pas (le losange d'une décision et son libellé) est de ce pas, et réciproquement.
    elements.forEach((e, i) => {
      if (pasDe(i) || estTrait(e)) return;
      const porte = elements.findIndex((x, j) => j !== i && pasDe(j) && !estTrait(x) && (dedans(centre(x.boite), e.boite) || dedans(centre(e.boite), x.boite)) && x.boite[2] * x.boite[3] < 0.2 * d.cadre[2] * d.cadre[3]);
      if (porte >= 0 && e.boite[2] * e.boite[3] < 0.2 * d.cadre[2] * d.cadre[3]) { pose(i, pasDe(porte)!); change = true; }
    });
    if (!change) break;
  }
  // Un trait resté sans pas qui arrive à une forme d'un pas en est (le retour d'une boucle, la jonction).
  elements.forEach((e, i) => {
    if (!estTrait(e) || pasDe(i)) return;
    const cible = formeAu(bouts(e).vers, i);
    if (cible && cible.d <= 12 && pasDe(cible.j)) pose(i, pasDe(cible.j)!);
  });
  return { ...d, elements, partition: { mode: "etapes", pas: numeros.length } };
}
