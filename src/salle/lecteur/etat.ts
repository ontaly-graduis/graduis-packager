// La navigation de la salle : une position (bloc, étape) qui avance par dévoilement puis par bloc.
export interface Position {
  readonly bloc: number;
  readonly etape: number;
}

/**
 * La première étape de chaque bloc : un bloc dévoilé s'ouvre sur sa première unité, parue sitôt le titre posé (1) ; un
 * contenu statique sur sa première page (0).
 */
export const premieresEtapes = (etapesDuDevoilement: readonly number[]): number[] => etapesDuDevoilement.map((n) => (n > 0 ? 1 : 0));

/** Avance d'un dévoilement, ou au bloc suivant — sur sa première étape — quand le bloc courant est entièrement dévoilé. */
export function suivant(p: Position, etapes: readonly number[], premieres: readonly number[]): Position {
  if (p.etape < (etapes[p.bloc] ?? 0)) return { bloc: p.bloc, etape: p.etape + 1 };
  return p.bloc + 1 < etapes.length ? { bloc: p.bloc + 1, etape: premieres[p.bloc + 1] ?? 0 } : p;
}

/** Recule d'un dévoilement ; à la première étape d'un bloc, revient au bloc précédent entièrement dévoilé. */
export function precedent(p: Position, etapes: readonly number[], premieres: readonly number[]): Position {
  if (p.etape > (premieres[p.bloc] ?? 0)) return { bloc: p.bloc, etape: p.etape - 1 };
  return p.bloc > 0 ? { bloc: p.bloc - 1, etape: etapes[p.bloc - 1] ?? 0 } : p;
}

export function debut(premieres: readonly number[]): Position {
  return { bloc: 0, etape: premieres[0] ?? 0 };
}

export function fin(etapes: readonly number[]): Position {
  const bloc = Math.max(0, etapes.length - 1);
  return { bloc, etape: etapes[bloc] ?? 0 };
}
