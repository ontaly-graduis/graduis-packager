// L'écart à la source (spec v1 § 2.2, I-PKG-19) : ce que la chaîne a inventé ou déplacé (relevé → pivot₀), borné par la
// sensibilité du procédé ; ce que la revue a porté dans le PPT (pivot₀ → pivot lu), compté, jamais bloquant.
import { blocsDe, estActivite, type Activite, type Bloc, type Derivation, type SeanceSpec } from "../pivot/seance-spec";
import type { DiapositiveReleve, Releve } from "../releve/releve";
import { deriver, textesDuContenu } from "../activites/deriver";
import type { Sensibilite } from "../procede/procede";

const SCHEMA_ECART = "graduis/ecart@1";

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

interface MotInvente {
  readonly bloc: string;
  readonly diapo: number;
  readonly mot: string;
}

/** Une activité du pivot : ce qu'elle dérive, sa durée, et les mots de son contenu absents de sa source (cible : zéro). */
interface ActiviteMesuree {
  readonly id: string;
  readonly derivation: Derivation;
  readonly derive_de: string;
  readonly duree: number;
  readonly inventes: readonly string[];
}

interface Mesure {
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
  /** Les séquences qui viennent avant une séquence d'une diapositive antérieure (l'ordre des séquences, borne de la moyenne). */
  readonly inversionsDeSequences: number;
  /** Les activités dérivées et leurs minutes (la durée de la séance et sa borne viennent avec le déroulé, ACT-2). */
  readonly activites: readonly ActiviteMesuree[];
  readonly minutes: number;
}

/** Les mots qu'une activité montre sans les tenir de sa source : zéro par construction, mesuré quand même. */
function activiteMesuree(a: Activite, sources: ReadonlyMap<string, Bloc>): ActiviteMesuree {
  const source = sources.get(a.derive_de);
  const contenu = source ? deriver(a, source) : null;
  const tenus = new Set(source ? texteDuBloc(source).flatMap(mots) : []);
  const inventes = [...new Set((contenu ? textesDuContenu(contenu) : []).flatMap(mots))].filter((m) => !tenus.has(m));
  return { id: a.id, derivation: a.derivation, derive_de: a.derive_de, duree: a.duree, inventes };
}

function mesure(releve: Releve, spec: SeanceSpec): Mesure {
  const sources = new Map(releve.diapositives.map((d) => [d.n, new Set(texteDeLaDiapositive(d).flatMap(mots))]));
  const gardes = new Map<number, Set<string>>();
  const inventes: MotInvente[] = [];
  const [ajoutes, dupliques]: [string[], string[]] = [[], []];
  let [total, inversions, precedente] = [0, 0, 0];
  for (const b of blocsDe(spec)) {
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
  const premieres = spec.sequences.map((q) => blocsDe(q)[0]?.source.diapo ?? 0);
  const parId = new Map(blocsDe(spec).map((b) => [b.id, b]));
  const activites = spec.sequences.flatMap((q) => q.blocs.filter(estActivite)).map((a) => activiteMesuree(a, parId));
  return {
    mots: total, inventes, inversions,
    retirees: releve.diapositives.filter((d) => !gardes.has(d.n)).map((d) => d.n),
    ajoutes, dupliques,
    conserve: origine ? Math.round((gardees / origine) * 1000) / 1000 : 1,
    inversionsDeSequences: premieres.filter((n, i) => i > 0 && n < premieres[i - 1]!).length,
    activites,
    minutes: activites.reduce((n, a) => n + a.duree, 0),
  };
}

export interface Ecart {
  readonly schema: typeof SCHEMA_ECART;
  readonly sensibilite: Sensibilite;
  /** Relevé → pivot₀ : ce que la chaîne a fait. Les bornes de la sensibilité portent sur elle. */
  readonly chaine: Mesure;
  /** Relevé → pivot livré, ce que la chaîne a déjà fait mis à part : ce que la revue a porté dans le PPT, accepté. */
  readonly revue: Mesure;
  /** Les activités du pivot livré (celles de la chaîne que la revue a gardées, et les siennes), et leurs minutes. */
  readonly livrees: { readonly activites: readonly ActiviteMesuree[]; readonly minutes: number };
  /** Les bornes franchies : chacune arrête la livraison (I-PKG-19, G-1). */
  readonly franchies: readonly string[];
}

/**
 * L'écart d'une livraison. Les bornes portent sur la chaîne (ce que la revue porte dans le PPT est accepté, compté), sauf ce
 * qui tient au contrat de la sensibilité. La minimale : 0 mot inventé (l'habillage naît au rendu, jamais au pivot), un ordre
 * des blocs identique, aucune activité dérivée. La moyenne : 0 mot inventé, les activités comprises ; l'ordre des séquences
 * identique (des activités s'insèrent). Les minutes des activités se comptent ; la durée de la séance, sa borne, viennent avec
 * le déroulé (ACT-2).
 */
export function ecartDeLivraison(releve: Releve, pivot0: SeanceSpec, livre: SeanceSpec, sensibilite: Sensibilite): Ecart {
  const chaine = mesure(releve, pivot0);
  const total = mesure(releve, livre);
  const parLaChaine = new Set(chaine.inventes.map((m) => `${m.diapo}\u0000${m.mot}`));
  const deLaChaine = new Set(chaine.activites.map((a) => a.id));
  const ajoutees = total.activites.filter((a) => !deLaChaine.has(a.id));
  const revue = {
    ...total,
    inventes: total.inventes.filter((m) => !parLaChaine.has(`${m.diapo}\u0000${m.mot}`)),
    activites: ajoutees,
    minutes: ajoutees.reduce((n, a) => n + a.duree, 0),
  };
  const franchies: string[] = [];
  if (chaine.inventes.length) franchies.push(`${chaine.inventes.length} mot(s) inventé(s) par la chaîne (${sensibilite} : aucun) : ${chaine.inventes.slice(0, 8).map((m) => `${m.bloc} « ${m.mot} »`).join(", ")}`);
  if (sensibilite === "minimale") {
    if (chaine.inversions) franchies.push(`${chaine.inversions} bloc(s) déplacé(s) par la chaîne (minimale : ordre identique)`);
    if (total.activites.length) franchies.push(`${total.activites.length} activité(s) dérivée(s) dans une séance en minimale, qui n'en admet aucune : ${total.activites.map((a) => a.id).join(", ")}`);
  } else {
    const inventees = total.activites.filter((a) => a.inventes.length);
    if (inventees.length) franchies.push(`des activités montrent des mots que leur source ne porte pas (moyenne : aucun) : ${inventees.map((a) => `${a.id} « ${a.inventes.slice(0, 4).join(" ")} »`).join(", ")}`);
    if (chaine.inversionsDeSequences) franchies.push(`${chaine.inversionsDeSequences} séquence(s) déplacée(s) par la chaîne (moyenne : ordre des séquences identique)`);
  }
  return { schema: SCHEMA_ECART, sensibilite, chaine, revue, livrees: { activites: total.activites, minutes: total.minutes }, franchies };
}
