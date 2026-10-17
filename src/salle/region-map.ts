// La `RegionMap` du moteur zones, dérivée des pas d'un bloc — types copiés de graduis-wizard
// `src/effecteur/moteur/experience/contracts.ts` (décision du 17/10, A-2), sous-ensemble utilisé par la salle.
import type { Bloc } from "../pivot/seance-spec";

export type ZoneRole = "act" | "observe";

export interface Zone {
  readonly id: string;
  readonly role: ZoneRole;
  readonly required: boolean;
  /** [x, y, w, h] en % de la capture. */
  readonly rect: readonly [number, number, number, number];
  /** Tag de cohésion, regroupe en étape. */
  readonly step: string;
  readonly consigne: string;
}

export interface RegionMap {
  /** Clé = nom de capture (ici, le hash du média). */
  readonly captures: Readonly<Record<string, ReadonlyArray<Zone>>>;
  readonly pas?: ReadonlyArray<{ readonly id: string; readonly libelle: string }>;
}

/** Les pas d'un bloc en `RegionMap` : une zone d'observation par pas ancré, le pas étant son étape. */
export function regionMap(bloc: Bloc): RegionMap {
  const captures: Record<string, Zone[]> = {};
  for (const p of bloc.pas) {
    if (!p.capture || !p.zone) continue;
    (captures[p.capture] ??= []).push({
      id: `${bloc.id}-p${p.numero}`,
      role: "observe",
      required: false,
      rect: p.zone,
      step: `P${p.numero}`,
      consigne: p.consigne ?? "",
    });
  }
  return { captures, pas: bloc.pas.map((p) => ({ id: `P${p.numero}`, libelle: p.consigne ?? "" })) };
}
