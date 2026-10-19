// Les dérivations sans invention (spec v1 § 5.3, P10) : d'un bloc source, le contenu d'une activité — choisi, ordonné ou
// mélangé, jamais écrit. Le même calcul à la salle, au papier, au PPT d'auteur et à sa lecture : l'activité pointe (I-PKG-12).
import { DERIVATION, type Activite, type Bloc, type Derivation, type Geste, type Structure } from "../pivot/seance-spec";
import { texteDeCorps } from "../pivot/textes";

type Rect = readonly [number, number, number, number];

/**
 * Le contenu d'une activité, par geste. `presentation` : l'ordre dans lequel les éléments se montrent, mélangés — à la
 * position k (numérotée k + 1 en salle, sur papier et dans le PPT), l'élément d'indice `presentation[k]`.
 */
export type ContenuDActivite =
  | { readonly geste: "rappel"; readonly items: readonly string[] }
  | { readonly geste: "classement"; readonly items: readonly string[]; readonly presentation: readonly number[] }
  | {
    readonly geste: "categorisation";
    /** L'en-tête de la colonne qui range (« Acteur », « Outil »). */
    readonly intitule: string;
    readonly categories: readonly string[];
    readonly cartes: readonly { readonly texte: string; readonly categorie: number }[];
    readonly presentation: readonly number[];
  }
  | { readonly geste: "selection-sur-image"; readonly pas: readonly { readonly numero: number; readonly consigne: string; readonly capture: string; readonly zone: Rect }[] };

/** Un texte du pivot, sans ses marques de graisse ni ses espaces en trop : rien n'y change que sa mise en forme. */
const net = (s: string) => s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

/** Les lignes à restituer d'un texte organisé : ses paragraphes, ses éléments de liste, ses définitions (pas ses intertitres). */
function lignesDeStructure(s: Structure): string[] {
  return s.rangees.flatMap((r) => r.colonnes.flatMap((c) => c.noeuds.flatMap((n) => {
    switch (n.type) {
      case "titre": return [];
      case "paragraphe": return [n.texte];
      case "liste": return n.items.map((i) => i.texte);
      case "definitions": return n.entrees.map((e) => `${e.terme} : ${e.texte}`);
    }
  }))).map(net).filter(Boolean);
}

/** Un mélange déterministe (FNV-1a, puis un générateur congruentiel) : jamais l'ordre juste, qui ne serait pas un exercice. */
export function melange(n: number, graine: string): number[] {
  let h = 0x811c9dc5;
  for (const c of graine) h = Math.imul(h ^ c.codePointAt(0)!, 0x01000193) >>> 0;
  const suivant = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 0x100000000; };
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(suivant() * (i + 1));
    [p[i], p[j]] = [p[j]!, p[i]!];
  }
  return n > 1 && p.every((x, i) => x === i) ? [...p.slice(1), p[0]!] : p;
}

/** Le libellé d'un pas d'un schéma partitionné : le texte des formes que sa pastille annonce. */
function libellesDePas(b: Bloc): string[] | null {
  const d = b.dessin;
  if (!d?.partition || d.partition.mode !== "etapes") return null;
  const libelles: string[] = [];
  for (let k = 1; k <= d.partition.pas; k++) {
    const textes = d.elements.flatMap((e) => (e.type === "forme" && e.pas === k && e.ordre !== undefined && !e.marque && e.texte ? [net(texteDeCorps(e.texte))] : []));
    const libelle = textes.filter(Boolean).join(" ");
    if (!libelle) return null;
    libelles.push(libelle);
  }
  return libelles;
}

/** Au moins trois éléments pour un ordre, une catégorisation ; une colonne qui range n'en garde pas plus des trois quarts. */
const MINIMUM = 3;
const PART_MAX = 0.75;
const CATEGORIES_MAX = 6;

/**
 * Les colonnes d'un tableau de processus : celle des étapes (son en-tête le dit, sinon la première de texte), et celle qui les
 * range le mieux — de deux à six valeurs, aucune n'en prenant plus des trois quarts, la plus équilibrée, la plus à gauche.
 */
function colonnesDeProcessus(t: readonly (readonly string[])[]): { etapes: number; range: number } | null {
  const [entete, ...corps] = t;
  if (!entete || corps.length < MINIMUM) return null;
  const cellule = (l: readonly string[], j: number) => net(l[j] ?? "");
  const numerique = (j: number) => corps.every((l) => /^[\d.\s#-]*$/.test(cellule(l, j)));
  const colonnes = entete.map((_, j) => j).filter((j) => !numerique(j));
  const etapes = colonnes.find((j) => /^(é|e)tapes?$|activit|t[âa]che|action/i.test(net(entete[j] ?? ""))) ?? colonnes[0];
  if (etapes === undefined) return null;
  let meilleure: { j: number; part: number } | null = null;
  for (const j of colonnes.filter((x) => x !== etapes)) {
    const valeurs = corps.map((l) => cellule(l, j)).filter(Boolean);
    if (valeurs.length < corps.length) continue;
    const comptes = new Map<string, number>();
    for (const v of valeurs) comptes.set(v, (comptes.get(v) ?? 0) + 1);
    const part = Math.max(...comptes.values()) / valeurs.length;
    if (comptes.size < 2 || comptes.size > CATEGORIES_MAX || part > PART_MAX) continue;
    if (!meilleure || part < meilleure.part) meilleure = { j, part };
  }
  return meilleure ? { etapes, range: meilleure.j } : null;
}

/** Le contenu d'une activité, ou `null` quand la source ne s'y prête pas (la dérivation n'invente rien pour combler). */
export function deriver(a: Pick<Activite, "derivation" | "derive_de">, source: Bloc): ContenuDActivite | null {
  if (DERIVATION[a.derivation].source !== source.figure) return null;
  const graine = `${a.derive_de}·${a.derivation}`;
  switch (a.derivation) {
    case "rappel": {
      const items = source.structure ? lignesDeStructure(source.structure) : source.textes.flatMap((t) => t.split("\n")).map(net).filter(Boolean);
      return items.length >= 2 ? { geste: "rappel", items } : null;
    }
    case "etapes-a-replacer": {
      const items = libellesDePas(source);
      return items && items.length >= MINIMUM ? { geste: "classement", items, presentation: melange(items.length, graine) } : null;
    }
    case "ordre-des-pas": {
      const pas = [...source.pas].sort((x, y) => x.numero - y.numero);
      const items = pas.map((p) => net(p.consigne ?? ""));
      return items.length >= MINIMUM && items.every(Boolean) ? { geste: "classement", items, presentation: melange(items.length, graine) } : null;
    }
    case "qui-fait-quoi": {
      const t = source.tableaux[0];
      const c = t ? colonnesDeProcessus(t) : null;
      if (!t || !c) return null;
      const lignes = t.slice(1).map((l) => ({ texte: net(l[c.etapes] ?? ""), valeur: net(l[c.range] ?? "") })).filter((l) => l.texte);
      const categories = [...new Set(lignes.map((l) => l.valeur))];
      const cartes = lignes.map((l) => ({ texte: l.texte, categorie: categories.indexOf(l.valeur) }));
      return { geste: "categorisation", intitule: net(t[0]![c.range] ?? ""), categories, cartes, presentation: melange(cartes.length, graine) };
    }
    case "ou-cliquez-vous": {
      const pas = [...source.pas].sort((x, y) => x.numero - y.numero).flatMap((p) => (p.capture && p.zone && p.consigne?.trim() ? [{ numero: p.numero, consigne: net(p.consigne), capture: p.capture, zone: p.zone }] : []));
      return pas.length ? { geste: "selection-sur-image", pas } : null;
    }
  }
}

/** Le geste d'une activité. */
export const gesteDe = (d: Derivation): Geste => DERIVATION[d].geste;

/** Ce qu'une activité tient de sa source : chaque texte qu'elle montre (l'écart en compte les mots, la recette les lignes). */
export function textesDuContenu(c: ContenuDActivite): string[] {
  switch (c.geste) {
    case "rappel": case "classement": return [...c.items];
    case "categorisation": return [c.intitule, ...c.categories, ...c.cartes.map((k) => k.texte)];
    case "selection-sur-image": return c.pas.map((p) => p.consigne);
  }
}

/** Le corrigé, en lignes : les notes du PPT, ce que voit le présentateur. */
export function corrige(c: ContenuDActivite): string[] {
  switch (c.geste) {
    case "rappel": case "classement": return c.items.map((t, i) => `${i + 1}. ${t}`);
    case "categorisation": return c.categories.map((k, i) => `${k} : ${c.cartes.filter((x) => x.categorie === i).map((x) => x.texte).join(" ; ")}`);
    case "selection-sur-image": return c.pas.map((p) => `${p.numero}. ${p.consigne}`);
  }
}

/** Les dérivations que la chaîne propose d'elle-même, sans choix à faire, et où : avant ou après leur source (décision du 19/10). */
export const PROPOSEES: Readonly<Partial<Record<Derivation, "avant" | "apres">>> = { rappel: "avant", "etapes-a-replacer": "apres", "qui-fait-quoi": "apres" };

/** La dérivation qu'un geste tire d'une figure source, quand elle existe : une activité ajoutée à la main se lit ainsi. */
export function derivationDe(geste: Geste, figure: Bloc["figure"]): Derivation | undefined {
  return (Object.keys(DERIVATION) as Derivation[]).find((d) => DERIVATION[d].geste === geste && DERIVATION[d].source === figure);
}
