// Le pivot mis sur papier (PKG-D) : la même mise en salle, à l'état final (tout déplié), redistribuée pour le participant —
// une page de garde, les séquences retenues (intercalaire, blocs, une page « Mes notes »), les annexes (synthèse,
// glossaire). Ce qui ne va pas au papier y est nommé ; ce qui y va se recette sur la couche texte du PDF.
import { verifierSequences, type Figure, type SeanceSpec } from "../pivot/seance-spec";
import { mettreEnSalle, type BlocDeSalle, type DonneesDeSalle, type Habillage } from "../salle/donnees";

const SCHEMA_PAPIER = "graduis/papier@0";

/** Absentes du papier : les écrans d'animation (des moments de la salle, pas un contenu). */
const ABSENTES: ReadonlySet<Figure> = new Set(["ecran-animation"]);
/** Renvoyées en annexe : la synthèse et le glossaire. */
const EN_ANNEXE: ReadonlySet<Figure> = new Set(["synthese", "glossaire"]);

export interface SequenceDePapier {
  readonly id: string;
  readonly numero: number | null;
  readonly titre: string;
  /** La transition qui ouvre la séquence : son intercalaire. */
  readonly intercalaire: BlocDeSalle | null;
  readonly blocs: readonly BlocDeSalle[];
}

export interface DonneesDePapier {
  readonly schema: typeof SCHEMA_PAPIER;
  readonly source: DonneesDeSalle["source"];
  /** Le titre du support (celui de la couverture) et ce qu'il couvre, quand il n'est qu'un extrait. */
  readonly titre: string;
  readonly extrait: string | null;
  readonly couverture: BlocDeSalle | null;
  readonly sequences: readonly SequenceDePapier[];
  readonly annexes: readonly BlocDeSalle[];
}

/**
 * Le pivot sur papier : la mise en salle au dévoilement « écran » (rien n'est caché), toutes séquences (la couverture et
 * les numéros en dépendent), puis les séquences retenues. Le glossaire va toujours en annexe ; une synthèse, si sa séquence
 * est retenue.
 */
export function mettreSurPapier(spec: SeanceSpec, px: (media: string) => readonly [number, number] | null, retenues?: readonly string[], habillage: Habillage = {}): DonneesDePapier {
  if (retenues) verifierSequences(spec, retenues);
  const salle = mettreEnSalle(spec, { devoilement: "ecran" }, px, undefined, habillage);
  const tous = salle.sequences.flatMap((s) => s.blocs);
  const couverture = tous.find((b) => b.figure === "couverture") ?? null;
  const sequences: SequenceDePapier[] = [];
  const annexes: BlocDeSalle[] = [];
  for (const s of salle.sequences) {
    const retenue = !retenues || retenues.includes(s.id);
    for (const b of s.blocs) if (b.figure === "glossaire" || (retenue && b.figure === "synthese")) annexes.push(b);
    if (!retenue) continue;
    const intercalaire = s.blocs.find((b) => b.figure === "transition") ?? null;
    const blocs = s.blocs.filter((b) => b !== intercalaire && b !== couverture && !ABSENTES.has(b.figure) && !EN_ANNEXE.has(b.figure));
    if (intercalaire || blocs.length) sequences.push({ id: s.id, numero: s.numero, titre: s.titre, intercalaire, blocs });
  }
  const extrait = retenues ? sequences.map((s) => (s.numero !== null ? `Séquence ${s.numero} · ${s.titre}` : s.titre)).join(" — ") : null;
  // Le titre du support : celui de la couverture, sinon sa première ligne (comme la salle la compose).
  const titre = [couverture?.titre ?? "", ...(couverture?.lignes ?? [])].find(Boolean) ?? salle.source.nom.replace(/\.pptx?$/i, "");
  return { schema: SCHEMA_PAPIER, source: salle.source, titre, extrait, couverture, sequences, annexes };
}

/**
 * Les textes qu'un bloc met sur le papier : son titre, ses lignes (celles d'un schéma sont les textes de son dessin ou de sa
 * composition, PKG-C3), ses tableaux, ses consignes.
 */
export function textesDuBloc(b: BlocDeSalle): string[] {
  return [b.titre ?? "", ...b.lignes, ...b.tableaux.flat(2), ...(b.regionMap?.pas ?? []).map((p) => p.libelle)];
}

/**
 * L'oracle de la recette : chaque ligne de texte que le papier doit porter, dans l'ordre du document. Ce que la salle
 * reformule (l'invitation d'une mise en pratique, le numéro saisi d'une transition) l'est déjà dans ses lignes.
 */
export function textesAttendus(d: DonneesDePapier): string[] {
  const blocs = [
    ...(d.couverture ? [d.couverture] : []),
    ...d.sequences.flatMap((s) => [...(s.intercalaire ? [s.intercalaire] : []), ...s.blocs]),
    ...d.annexes,
  ];
  return blocs.flatMap(textesDuBloc).flatMap((t) => t.split("\n")).map((l) => l.trim()).filter((l) => l !== "");
}
