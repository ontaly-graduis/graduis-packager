// La navigation de la salle : une position (bloc, étape) qui avance par dévoilement puis par bloc.
export interface Position {
  readonly bloc: number;
  readonly etape: number;
}

/** Avance d'un dévoilement, ou au bloc suivant quand le bloc courant est entièrement dévoilé. */
export function suivant(p: Position, etapes: readonly number[]): Position {
  if (p.etape < (etapes[p.bloc] ?? 0)) return { bloc: p.bloc, etape: p.etape + 1 };
  return p.bloc + 1 < etapes.length ? { bloc: p.bloc + 1, etape: 0 } : p;
}

/** Recule d'un dévoilement ; au début d'un bloc, revient au bloc précédent entièrement dévoilé. */
export function precedent(p: Position, etapes: readonly number[]): Position {
  if (p.etape > 0) return { bloc: p.bloc, etape: p.etape - 1 };
  return p.bloc > 0 ? { bloc: p.bloc - 1, etape: etapes[p.bloc - 1] ?? 0 } : p;
}

export function debut(): Position {
  return { bloc: 0, etape: 0 };
}

export function fin(etapes: readonly number[]): Position {
  const bloc = Math.max(0, etapes.length - 1);
  return { bloc, etape: etapes[bloc] ?? 0 };
}
