// Les activités que la chaîne propose en sensibilité moyenne (décision du 19/10) : les dérivations sans choix à faire — une
// liste d'étapes clés se joue en rappel avant d'être dévoilée, un schéma partitionné par étapes se remet dans l'ordre, un
// processus se range par sa colonne qui départage. On les garde, ou l'on supprime leur diapositive, dans le PPT d'auteur.
import { DERIVATION, blocsDe, estActivite, type Activite, type Bloc, type Derivation, type SeanceSpec, type Sequence } from "../pivot/seance-spec";
import type { Durees } from "../diagnostic/regles";
import { PROPOSEES, deriver, gesteDe } from "./deriver";

/** L'identifiant d'une activité : `a` et le numéro de sa source ; pris, le premier libre au-delà du plus grand. */
export function idDActivite(source: string, pris: ReadonlySet<string>): string {
  const voulu = `a${source.slice(1)}`;
  if (!pris.has(voulu)) return voulu;
  let n = Math.max(0, ...[...pris].filter((x) => x.startsWith("a")).map((x) => Number(x.slice(1)) || 0));
  while (pris.has(`a${String(n).padStart(3, "0")}`)) n += 1;
  return `a${String(n).padStart(3, "0")}`;
}

/** Les activités qu'un bloc propose, dans l'ordre des dérivations. */
function propositions(b: Bloc, durees: Durees, pris: Set<string>): { place: "avant" | "apres"; activite: Activite }[] {
  return (Object.keys(PROPOSEES) as Derivation[]).filter((d) => DERIVATION[d].source === b.figure && deriver({ derivation: d, derive_de: b.id }, b)).map((d) => {
    const id = idDActivite(b.id, pris);
    pris.add(id);
    return { place: PROPOSEES[d]!, activite: { id, figure: "activite", derivation: d, derive_de: b.id, duree: durees[gesteDe(d)] } };
  });
}

/** Le pivot₀ et les activités proposées, posées avant ou après leur source. */
export function proposerActivites(spec: SeanceSpec, durees: Durees): SeanceSpec {
  const pris = new Set(spec.sequences.flatMap((s) => s.blocs.filter(estActivite).map((a) => a.id)));
  const sequences: Sequence[] = spec.sequences.map((s) => ({
    ...s,
    blocs: s.blocs.flatMap((b) => {
      if (estActivite(b)) return [b];
      const p = propositions(b, durees, pris);
      return [...p.filter((x) => x.place === "avant").map((x) => x.activite), b, ...p.filter((x) => x.place === "apres").map((x) => x.activite)];
    }),
  }));
  return { ...spec, sequences };
}

/** Les sources d'un pivot, par identifiant : une activité s'y résout. */
export const sourcesDe = (spec: SeanceSpec): ReadonlyMap<string, Bloc> => new Map(blocsDe(spec).map((b) => [b.id, b]));
