// Les signaux du relevé : captures, pastilles, zones, textes — et la géométrie qui les relie.
import { NATURES_TEXTE, type Boite, type Forme } from "../ooxml/formes";

export const POUCE = 914400;

/** Seuils du relevé, repris de `scripts/releve_pptx.py` (mesure du 17/10). */
export const SEUILS = {
  pastilleMax: 0.72 * POUCE,
  zoneGap: 0.5 * POUCE,
  consigneDist: 1.6 * POUCE,
  captureMin: 0.25,
  texteMin: 8,
  dense: 90,
} as const;

export function texteDe(f: Forme): string {
  return (f.texte ?? []).join("\n").trim();
}

export function aCadreTexte(f: Forme): boolean {
  return NATURES_TEXTE.has(f.nature);
}

export function estCapture(f: Forme, largeurDiapo: number): boolean {
  return f.nature === "image" && f.boite[2] > largeurDiapo * SEUILS.captureMin;
}

export function estPastille(f: Forme): boolean {
  return (f.nature === "forme" || f.nature === "texte") && /^\d{1,2}$/.test(texteDe(f))
    && f.boite[2] < SEUILS.pastilleMax && f.boite[3] < SEUILS.pastilleMax;
}

export function estZone(f: Forme): boolean {
  return f.nature === "forme" && !texteDe(f) && f.sansRemplissage === true;
}

export function estTexte(f: Forme): boolean {
  return aCadreTexte(f) && texteDe(f).length > SEUILS.texteMin;
}

export function centre(b: Boite): readonly [number, number] {
  return [b[0] + b[2] / 2, b[1] + b[3] / 2];
}

export function dedans(b: Boite, c: Boite): boolean {
  const [x, y] = centre(b);
  return c[0] <= x && x <= c[0] + c[2] && c[1] <= y && y <= c[1] + c[3];
}

/** Distance du centre de `b` au bord du rectangle `r` (0 si dedans). */
export function ecartBord(b: Boite, r: Boite): number {
  const [x, y] = centre(b);
  const dx = Math.max(r[0] - x, 0, x - (r[0] + r[2]));
  const dy = Math.max(r[1] - y, 0, y - (r[1] + r[3]));
  return Math.hypot(dx, dy);
}

export function distanceCentres(a: Boite, b: Boite): number {
  const [ax, ay] = centre(a);
  const [bx, by] = centre(b);
  return Math.hypot(ax - bx, ay - by);
}
