// L'écart à la source (spec v1 § 2.2, I-PKG-19) : ce que la chaîne a inventé ou déplacé (relevé → pivot₀), borné par la
// sensibilité du procédé ; ce que la revue a porté dans le PPT (pivot₀ → pivot lu), compté, jamais bloquant.
import type { Bloc, SeanceSpec } from "../pivot/seance-spec";
import type { DiapositiveReleve, Releve } from "../releve/releve";

export const SCHEMA_ECART = "graduis/ecart@0";

/** Le mot : une suite de lettres ou de chiffres, après NFKC et minuscules (la normalisation de la recette du papier). */
const mots = (s: string): string[] => s.normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Le texte d'un bloc : titre, inventaire (qui dérive déjà structure, composition et dessin), cellules, consignes, légendes, notes. */
const texteDuBloc = (b: Bloc): string[] =>
  [b.titre ?? "", ...b.textes, ...b.tableaux.flat(2), ...b.pas.map((p) => p.consigne ?? ""), ...b.visuels.map((v) => v.legende ?? ""), b.notes];

/** Le texte d'une diapositive d'origine : ses formes, leurs cellules, ses notes, les textes propres de sa disposition. */
function texteDeLaDiapositive(d: DiapositiveReleve): string[] {
  const t: string[] = [];
  for (const f of [...d.formes, ...(d.heritees ?? [])]) {
    t.push(...(f.texte ?? []));
    for (const l of f.lignes ?? []) t.push(...l);
  }
  return [...t, d.notes];
}

export interface MotInvente {
  readonly bloc: string;
  readonly diapo: number;
  readonly mot: string;
}

export interface Mesure {
  /** Les mots du pivot (chaque mot distinct, bloc par bloc). */
  readonly mots: number;
  /** Les mots d'un bloc absents de sa propre diapositive d'origine. */
  readonly inventes: readonly MotInvente[];
  /** Les blocs qui viennent avant un bloc d'une diapositive antérieure (la suite des sources n'est plus croissante). */
  readonly inversions: number;
  /** Les diapositives d'origine sans bloc. */
  readonly retirees: readonly number[];
  /** Les blocs dont la diapositive d'origine n'est pas au relevé, ou y est déjà prise. */
  readonly ajoutes: readonly string[];
  readonly dupliques: readonly string[];
  /** La part des mots d'origine que le pivot garde (à l'écran, en notes, sur papier). */
  readonly conserve: number;
}

function mesure(releve: Releve, spec: SeanceSpec): Mesure {
  const sources = new Map(releve.diapositives.map((d) => [d.n, new Set(texteDeLaDiapositive(d).flatMap(mots))]));
  const gardes = new Map<number, Set<string>>();
  const inventes: MotInvente[] = [];
  const [ajoutes, dupliques]: [string[], string[]] = [[], []];
  let [total, inversions, precedente] = [0, 0, 0];
  for (const b of spec.sequences.flatMap((s) => s.blocs)) {
    const n = b.source.diapo;
    const source = sources.get(n);
    if (!source) ajoutes.push(b.id);
    else if (gardes.has(n)) dupliques.push(b.id);
    if (n < precedente) inversions += 1;
    precedente = n;
    const vus = new Set(texteDuBloc(b).flatMap(mots));
    total += vus.size;
    const garde = gardes.get(n) ?? new Set<string>();
    for (const m of vus) {
      garde.add(m);
      if (!source?.has(m)) inventes.push({ bloc: b.id, diapo: n, mot: m });
    }
    gardes.set(n, garde);
  }
  let [origine, gardees] = [0, 0];
  for (const [n, s] of sources) {
    origine += s.size;
    for (const m of s) if (gardes.get(n)?.has(m)) gardees += 1;
  }
  return {
    mots: total, inventes, inversions,
    retirees: releve.diapositives.filter((d) => !gardes.has(d.n)).map((d) => d.n),
    ajoutes, dupliques,
    conserve: origine ? Math.round((gardees / origine) * 1000) / 1000 : 1,
  };
}

export type Sensibilite = "minimale";

export interface Ecart {
  readonly schema: typeof SCHEMA_ECART;
  readonly sensibilite: Sensibilite;
  /** Relevé → pivot₀ : ce que la chaîne a fait. Les bornes de la sensibilité portent sur elle. */
  readonly chaine: Mesure;
  /** Relevé → pivot livré, ce que la chaîne a déjà fait mis à part : ce que la revue a porté dans le PPT, accepté. */
  readonly revue: Mesure;
  /** Les bornes franchies : chacune arrête la livraison (I-PKG-19, G-1). */
  readonly franchies: readonly string[];
}

/**
 * L'écart d'une livraison. La minimale borne la chaîne : 0 mot inventé (l'habillage naît au rendu, jamais au pivot), un ordre
 * identique. La durée est sans objet tant que le pivot n'en porte pas (`seance-spec@1`).
 */
export function ecartDeLivraison(releve: Releve, pivot0: SeanceSpec, livre: SeanceSpec, sensibilite: Sensibilite): Ecart {
  const chaine = mesure(releve, pivot0);
  const total = mesure(releve, livre);
  const parLaChaine = new Set(chaine.inventes.map((m) => `${m.diapo}\u0000${m.mot}`));
  const revue = { ...total, inventes: total.inventes.filter((m) => !parLaChaine.has(`${m.diapo}\u0000${m.mot}`)) };
  const franchies: string[] = [];
  if (sensibilite === "minimale") {
    if (chaine.inventes.length) franchies.push(`${chaine.inventes.length} mot(s) inventé(s) par la chaîne (minimale : aucun) : ${chaine.inventes.slice(0, 8).map((m) => `${m.bloc} « ${m.mot} »`).join(", ")}`);
    if (chaine.inversions) franchies.push(`${chaine.inversions} bloc(s) déplacé(s) par la chaîne (minimale : ordre identique)`);
  }
  return { schema: SCHEMA_ECART, sensibilite, chaine, revue, franchies };
}
