// La recomposition d'un schéma par un gabarit du wizard (PKG-B4) : quand le dessin relève d'une structure connue, on en
// lit la structure et la salle la compose au thème, mise en page calculée. Le `cas` du wizard — des colonnes en regard,
// chacune annoncée par son bandeau numéroté et faite d'étapes numérotées (PKG-B4) ; le `tableau` — des couloirs nommés
// sous des phases, les étapes placées dans leurs cases (PKG-B5).
import type { Composition, Dessin, ElementDeDessin, FormeDeDessin, Role, Vignette } from "../pivot/seance-spec";
import { colonnes, numeroDePastille } from "./partition";

type Boite = readonly [number, number, number, number];
const centre = (b: Boite): [number, number] => [b[0] + b[2] / 2, b[1] + b[3] / 2];
const texteDe = (e: ElementDeDessin) => (e.type === "forme" && e.texte
  ? e.texte.paragraphes.map((p) => p.fragments.map((f) => f.texte).join("")).join(" ").replace(/\s+/g, " ").trim() : "");
const estForme = (e: ElementDeDessin): e is FormeDeDessin => e.type === "forme";
const estTrait = (e: FormeDeDessin) => /connector|^line$/i.test(e.geometrie);

/** La manière d'une étape telle que la légende la nomme : son fond, et son bord (plein, en tirets, ou sans). */
function maniere(e: FormeDeDessin): { fond?: Role; bord: "plein" | "tirets" | "aucun" } {
  const bord = !e.trait ? "aucun" : e.trait.tirets ? "tirets" : "plein";
  return { ...(e.fond ? { fond: e.fond } : {}), bord };
}

/** La légende d'un schéma : des échantillons (formes muettes) et leur libellé à droite ; ou un libellé qui est lui-même son échantillon. */
function legende(decor: readonly FormeDeDessin[]): NonNullable<Extract<Composition, { gabarit: "cas" }>["legende"]> {
  // Chaque entrée : son échantillon `e` (l'ordre horizontal) et son libellé `l` (la ligne).
  const out: { e: FormeDeDessin; l: FormeDeDessin; texte: string; maniere: ReturnType<typeof maniere>; forme?: "triangle" }[] = [];
  const libelles = decor.filter((e) => texteDe(e) && !estTrait(e));
  const pris = new Set<FormeDeDessin>();
  for (const s of decor.filter((e) => !texteDe(e) && !estTrait(e) && (e.fond || e.trait) && e.boite[2] < 60 && e.boite[3] < 30)) {
    const [, cy] = centre(s.boite);
    const libelle = libelles
      .filter((l) => !pris.has(l) && l.boite[0] >= s.boite[0] + s.boite[2] - 2 && l.boite[0] - (s.boite[0] + s.boite[2]) <= 14 && Math.abs(centre(l.boite)[1] - cy) <= 10)
      .sort((a, b) => a.boite[0] - b.boite[0])[0];
    if (!libelle) continue;
    pris.add(libelle);
    out.push({ e: s, l: libelle, texte: texteDe(libelle), maniere: maniere(s), ...(s.geometrie === "triangle" ? { forme: "triangle" as const } : {}) });
  }
  // Un libellé encadré, sans échantillon à côté, se montre lui-même (« Actions automatiques » en tirets).
  for (const l of libelles) if (!pris.has(l) && l.trait && l.boite[3] < 30) out.push({ e: l, l, texte: texteDe(l), maniere: maniere(l) });
  // Dans l'ordre de lecture : par ligne de libellés (à 10 points près), puis de gauche à droite.
  const dy = (a: (typeof out)[number], b: (typeof out)[number]) => {
    const d = centre(a.l.boite)[1] - centre(b.l.boite)[1];
    return Math.abs(d) <= 10 ? 0 : d;
  };
  // Un signe isolé (« + ») n'est pas une entrée de légende.
  // Les cases d'abord, puis les signaux (une légende en deux colonnes se lit colonne par colonne).
  return out.filter((x) => x.texte.length > 1)
    .sort((a, b) => Number(!!a.forme) - Number(!!b.forme) || dy(a, b) || a.e.boite[0] - b.e.boite[0]).map((x) => ({ texte: x.texte, ...(x.forme ? { forme: x.forme } : {}), ...x.maniere }));
}

/** Le `cas` d'un dessin partitionné en colonnes : chaque colonne a son bandeau numéroté et au moins deux étapes numérotées. */
export function composerCas(d: Dessin): Composition | null {
  if (d.partition?.mode !== "colonnes") return null;
  const formes = d.elements.filter(estForme);
  const cas: Extract<Composition, { gabarit: "cas" }>["cas"] = [];
  for (let pas = 1; pas <= d.partition.pas; pas++) {
    const dans = formes.filter((e) => e.pas === pas);
    const pastilleDeTete = dans.find((e) => e.ordre === 0 && e.marque === "pastille");
    const bandeau = dans.find((e) => e.ordre === 0 && e.marque !== "pastille" && texteDe(e));
    if (!pastilleDeTete || !bandeau) return null;
    const etapes = dans.filter((e) => e.marque === "pastille" && (e.ordre ?? 0) >= 1)
      .map((p) => ({ p, boite: dans.find((e) => e.ordre === p.ordre && e.marque !== "pastille" && texteDe(e)) }))
      .filter((x): x is { p: FormeDeDessin; boite: FormeDeDessin } => !!x.boite)
      .sort((a, b) => (a.p.ordre ?? 0) - (b.p.ordre ?? 0));
    if (etapes.length < 2) return null;
    // Les descriptions : des textes nus de la colonne, à la hauteur d'une étape.
    const prises = new Set<FormeDeDessin>([pastilleDeTete, bandeau, ...etapes.flatMap((x) => [x.p, x.boite])]);
    const descriptions = dans.filter((e) => !prises.has(e) && texteDe(e) && !e.fond && !e.trait);
    const detailDe = (b: FormeDeDessin) => {
      const [, cy] = centre(b.boite);
      const d = descriptions.filter((x) => !prises.has(x) && Math.abs(centre(x.boite)[1] - cy) <= b.boite[3])
        .sort((a, c) => Math.abs(centre(a.boite)[1] - cy) - Math.abs(centre(c.boite)[1] - cy))[0];
      if (d) prises.add(d);
      return d;
    };
    cas.push({
      numero: Number(texteDe(pastilleDeTete)),
      titre: texteDe(bandeau),
      ...(bandeau.fond ? { couleur: bandeau.fond } : {}),
      etapes: etapes.map(({ p, boite }) => {
        const detail = detailDe(boite);
        return { numero: Number(texteDe(p)) || p.ordre!, texte: texteDe(boite), ...(detail ? { detail: texteDe(detail) } : {}), ...maniere(boite) };
      }),
    });
  }
  const leg = legende(formes.filter((e) => !e.pas));
  return { gabarit: "cas", cas: cas.sort((a, b) => a.numero - b.numero), ...(leg.length ? { legende: leg } : {}) };
}

/** Seuils du `tableau` (points, proportions), réglés sur les fiches personae du deck acheteur (17/10). */
export const SEUILS_TABLEAU = {
  /** Un couloir traverse au moins tant de la largeur des phases, et n'a pas plus de tant de leur hauteur. */
  couloirLargeur: 0.8,
  couloirHauteur: 0.25,
  /** Une pastille va à l'étape dont la pointe (ou le centre) est à moins de tant de points. */
  portee: 40,
  /** Une étape est dans la grille : son centre à moins de tant de points de l'étendue des phases et des couloirs. */
  marge: 20,
} as const;

const BULLES = new Set(["wedgeRectCallout", "wedgeRoundRectCallout", "wedgeEllipseCallout"]);

/** Le point qu'une bulle désigne (sa pointe), sinon le centre de la forme. */
function pointe(e: FormeDeDessin): [number, number] {
  const [cx, cy] = centre(e.boite);
  if (!BULLES.has(e.geometrie)) return [cx, cy];
  const a1 = e.ajustements?.["adj1"] ?? -20833;
  const a2 = e.ajustements?.["adj2"] ?? 62500;
  return [cx + (a1 / 100000) * e.boite[2], cy + (a2 / 100000) * e.boite[3]];
}

/** Une vignette : des éléments repris tels quels, sans pas ni ordre (ils ne se jouent pas), dans leur cadre commun. */
function vignette(elements: readonly ElementDeDessin[]): Vignette {
  const x0 = Math.min(...elements.map((e) => e.boite[0]));
  const y0 = Math.min(...elements.map((e) => e.boite[1]));
  const x1 = Math.max(...elements.map((e) => e.boite[0] + e.boite[2]));
  const y1 = Math.max(...elements.map((e) => e.boite[1] + e.boite[3]));
  return {
    cadre: [x0, y0, x1 - x0, y1 - y0],
    elements: elements.map((e) => {
      const { pas: _p, ...r } = e as ElementDeDessin & { pas?: number; ordre?: number; marque?: string };
      const { ordre: _o, marque: _m, ...sans } = r as typeof r & { ordre?: number; marque?: string };
      return sans as ElementDeDessin;
    }),
  };
}

/**
 * Le `tableau` d'un dessin en couloirs : au moins trois phases (de hautes colonnes titrées) et trois couloirs (de longues
 * bandes nommées qui les traversent) ; les étapes (les bulles et cadres de texte de la grille) se placent par le point
 * qu'elles désignent — la pastille qui les numérote, sinon leur pointe : le couloir qui le contient, la phase qui le
 * contient. Leur numéro est celui de leur pastille ; leur signal, le triangle posé dessus (le plus haut, s'ils s'empilent).
 */
export function composerTableau(d: Dessin): Composition | null {
  const S = SEUILS_TABLEAU;
  const cols = colonnes(d);
  if (cols.length < 3) return null;
  const formes = d.elements.filter(estForme);
  const memeBoite = (a: readonly number[], b: readonly number[]) => a.every((v, i) => v === b[i]);
  const formesDeColonne = cols.map((c) => formes.find((e) => memeBoite(e.boite, c))!);
  const gauche = Math.min(...cols.map((c) => c[0]));
  const droite = Math.max(...cols.map((c) => c[0] + c[2]));
  const haut = Math.min(...cols.map((c) => c[1]));
  const bas = Math.max(...cols.map((c) => c[1] + c[3]));
  const hauteur = bas - haut;
  const couloirs = formes
    .filter((e) => !formesDeColonne.includes(e) && texteDe(e) && !BULLES.has(e.geometrie) && !estTrait(e)
      && e.boite[2] >= S.couloirLargeur * (droite - gauche) && e.boite[3] <= S.couloirHauteur * hauteur
      && e.boite[0] <= gauche && e.boite[0] + e.boite[2] >= droite - 0.2 * (droite - gauche))
    .sort((a, b) => a.boite[1] - b.boite[1]);
  if (couloirs.length < 3) return null;
  // L'étendue de la grille : les phases et les couloirs.
  const gx0 = Math.min(gauche, ...couloirs.map((c) => c.boite[0])) - S.marge;
  const gx1 = Math.max(droite, ...couloirs.map((c) => c.boite[0] + c.boite[2])) + S.marge;
  const gy0 = haut - S.marge;
  const gy1 = bas + S.marge;
  const dansLaGrille = (e: ElementDeDessin) => { const [x, y] = centre(e.boite); return x >= gx0 && x <= gx1 && y >= gy0 && y <= gy1; };

  const pastilles = formes.filter((e) => numeroDePastille(e) !== null && dansLaGrille(e));
  const triangles = formes.filter((e) => e.geometrie === "triangle" && e.fond && dansLaGrille(e));
  const taches = formes.filter((e) => texteDe(e) && dansLaGrille(e) && !formesDeColonne.includes(e) && !couloirs.includes(e)
    && !pastilles.includes(e) && !estTrait(e) && e.boite[0] >= gauche - S.marge);
  if (taches.length < cols.length) return null;

  // Chaque pastille et l'étape qu'elle numérote : les plus proches d'abord.
  const paires = taches.flatMap((t) => pastilles.map((p) => ({ t, p, d: Math.hypot(pointe(t)[0] - centre(p.boite)[0], pointe(t)[1] - centre(p.boite)[1]) })))
    .filter((x) => x.d <= S.portee).sort((a, b) => a.d - b.d);
  const pastilleDe = new Map<FormeDeDessin, FormeDeDessin>();
  const prises = new Set<FormeDeDessin>();
  for (const { t, p } of paires) if (!pastilleDe.has(t) && !prises.has(p)) { pastilleDe.set(t, p); prises.add(p); }
  if (pastilleDe.size < 2) return null;

  const plusProche = (v: number, bornes: readonly (readonly [number, number])[]) => {
    const k = bornes.findIndex(([a, b]) => v >= a && v <= b);
    if (k >= 0) return k;
    return bornes.map(([a, b], i) => ({ i, d: Math.min(Math.abs(v - a), Math.abs(v - b)) })).sort((x, y) => x.d - y.d)[0]!.i;
  };
  const bornesX = cols.map((c) => [c[0], c[0] + c[2]] as const);
  const bornesY = couloirs.map((c) => [c.boite[1], c.boite[1] + c.boite[3]] as const);
  const etapes = taches.map((t) => {
    const p = pastilleDe.get(t);
    const [x, y] = p ? centre(p.boite) : pointe(t);
    const signal = triangles.filter((g) => {
      const [gx, gy] = centre(g.boite);
      return gx >= t.boite[0] && gx <= t.boite[0] + t.boite[2] && gy >= t.boite[1] && gy <= t.boite[1] + t.boite[3];
    }).at(-1);
    return {
      ligne: plusProche(y, bornesY),
      colonne: plusProche(x, bornesX),
      ...(p ? { numero: numeroDePastille(p)! } : {}),
      texte: texteDe(t),
      ...(signal?.fond ? { signal: signal.fond } : {}),
      ...maniere(t),
      y: t.boite[1],
    };
  }).sort((a, b) => a.colonne - b.colonne || (a.numero ?? 99) - (b.numero ?? 99) || a.y - b.y)
    .map(({ y: _y, ...e }) => e);

  // Le signe d'un couloir : ce qui est dessiné à sa gauche, à sa hauteur (une icône, souvent faite de plusieurs chemins).
  const centresY = couloirs.map((c) => centre(c.boite)[1]);
  const ecartY = Math.min(...centresY.slice(1).map((v, i) => v - centresY[i]!));
  const signes = couloirs.map(() => [] as ElementDeDessin[]);
  for (const e of d.elements) {
    if (e.type === "forme" && (texteDe(e) || estTrait(e))) continue;
    if (e.boite[0] + e.boite[2] > Math.min(...couloirs.map((c) => c.boite[0])) + 2) continue;
    const [, cy] = centre(e.boite);
    const k = centresY.map((v, i) => ({ i, d: Math.abs(v - cy) })).sort((a, b) => a.d - b.d)[0]!;
    if (k.d <= ecartY / 2) signes[k.i]!.push(e);
  }
  // L'illustration : une image hors de la grille (le portrait du persona).
  const images = d.elements.filter((e) => e.type === "image" && !dansLaGrille(e));
  const decor = formes.filter((e) => !dansLaGrille(e));
  const leg = legende(decor);
  return {
    gabarit: "tableau",
    colonnes: formesDeColonne.map((f) => ({ titre: texteDe(f), ...(f.fond ?? f.trait?.couleur ? { couleur: (f.fond ?? f.trait!.couleur) } : {}) })),
    lignes: couloirs.map((c, i) => ({ titre: texteDe(c), ...(signes[i]!.length ? { signe: vignette(signes[i]!) } : {}) })),
    etapes,
    ...(images.length === 1 ? { illustration: vignette(images) } : {}),
    ...(leg.length ? { legende: leg } : {}),
  };
}

/** Une harmonisation : la manière ou le signal d'une étape, ramené à ce que la légende nomme (pour le rapport). */
export interface Harmonisation {
  readonly texte: string;
  readonly quoi: "maniere" | "signal";
  readonly de: string;
  readonly vers: string;
}

/** La distance entre deux rôles : leur famille (les neutres — gris, papier, encre — à mi-chemin), puis leur clarté. */
function distanceDeRoles(a: Role | undefined, b: Role | undefined): number {
  const lire = (r: Role | undefined): [string, number] => {
    if (!r || r === "papier") return ["neutre", 3];
    if (r === "encre") return ["neutre", -1];
    const [famille, ton] = r.split("-") as [string, string];
    return [famille === "gris" ? "neutre" : famille, ton === "fort" ? 0 : ton === "moyen" ? 1 : 2];
  };
  const [fa, ca] = lire(a);
  const [fb, cb] = lire(b);
  return (fa === fb ? 0 : fa === "neutre" || fb === "neutre" ? 0.5 : 1) + 0.25 * Math.abs(ca - cb);
}

const decrire = (x: { fond?: string | undefined; bord: string }) =>
  `${x.fond ?? "sans fond"}, ${x.bord === "aucun" ? "sans bord" : x.bord === "tirets" ? "en tirets" : "bord plein"}`;

/**
 * L'harmonisation d'un tableau sur sa légende (décision de David, 17/10) : une étape d'une manière que la légende ne nomme
 * pas prend la manière nommée la plus proche — le bord d'abord (il dit qui agit : en tirets, un tiers), puis le fond ; un
 * signal d'une couleur que la légende ne nomme pas prend le signal nommé le plus proche. Sans légende, rien ne change.
 */
export function harmoniser(c: Composition): { composition: Composition; harmonisations: Harmonisation[] } {
  if (c.gabarit !== "tableau" || !c.legende?.length) return { composition: c, harmonisations: [] };
  const manieres = c.legende.filter((l) => !l.forme);
  const signaux = c.legende.filter((l) => l.forme === "triangle" && l.fond).map((l) => l.fond!);
  const harmonisations: Harmonisation[] = [];
  const etapes = c.etapes.map((e) => {
    let r = e;
    if (manieres.length && !manieres.some((m) => m.fond === e.fond && m.bord === e.bord)) {
      const m = [...manieres].sort((a, b) => (Number(a.bord !== e.bord) * 2 + distanceDeRoles(a.fond, e.fond)) - (Number(b.bord !== e.bord) * 2 + distanceDeRoles(b.fond, e.fond)))[0]!;
      const { fond: _f, ...sans } = r;
      r = { ...sans, ...(m.fond ? { fond: m.fond } : {}), bord: m.bord };
      harmonisations.push({ texte: e.texte, quoi: "maniere", de: decrire(e), vers: decrire(m) });
    }
    if (e.signal && signaux.length && !signaux.includes(e.signal)) {
      const v = [...signaux].sort((a, b) => distanceDeRoles(a, e.signal) - distanceDeRoles(b, e.signal))[0]!;
      r = { ...r, signal: v };
      harmonisations.push({ texte: e.texte, quoi: "signal", de: e.signal, vers: v });
    }
    return r;
  });
  return { composition: { ...c, etapes }, harmonisations };
}

