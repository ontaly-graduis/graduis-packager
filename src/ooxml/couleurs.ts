// Les couleurs DrawingML : couleurs directes, du thème (par la clrMap du masque), système, et leurs modificateurs.
import type { Element } from "@xmldom/xmldom";
import { NS, type Paquet, chemin, elementsEnfants, enfant } from "./paquet";

/** Une couleur résolue : RVB en hex (donnée de relevé, jamais d'interface) et opacité en cent-millièmes. */
export interface Couleur {
  readonly rgb: string;
  readonly alpha?: number;
}

export type Palette = ReadonlyMap<string, string>;

const NOMMEES: Readonly<Record<string, string>> = { black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF", gray: "808080", yellow: "FFFF00" };

/** La palette d'un masque : son `clrScheme`, puis les alias de sa `clrMap` (bg1 → lt1, tx1 → dk1…). */
export function paletteDuMasque(paquet: Paquet, masque: string | undefined): Palette {
  const p = new Map<string, string>();
  if (!masque) return p;
  const theme = paquet.relation(masque, "theme")?.cible;
  const schema = theme ? chemin(paquet.racine(theme), ["a:themeElements", "a:clrScheme"]) : undefined;
  if (schema) {
    for (const e of elementsEnfants(schema)) {
      const c = elementsEnfants(e)[0];
      const v = c?.localName === "srgbClr" ? c.getAttribute("val") : c?.localName === "sysClr" ? c.getAttribute("lastClr") : null;
      if (v && e.localName) p.set(e.localName, v.toUpperCase());
    }
  }
  const carte = chemin(paquet.racine(masque), ["p:clrMap"]);
  for (const alias of ["bg1", "tx1", "bg2", "tx2"]) {
    const cible = carte?.getAttribute(alias);
    const v = cible ? p.get(cible) : undefined;
    if (v) p.set(alias, v);
  }
  return p;
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const srgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function versHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function depuisHsl(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const t = (x: number) => {
    const k = ((x % 1) + 1) % 1;
    return k < 1 / 6 ? p + (q - p) * 6 * k : k < 1 / 2 ? q : k < 2 / 3 ? p + (q - p) * (2 / 3 - k) * 6 : p;
  };
  return [t(h / 360 + 1 / 3), t(h / 360), t(h / 360 - 1 / 3)];
}

const borne = (v: number) => Math.min(1, Math.max(0, v));

/** Une couleur DrawingML (`srgbClr`, `schemeClr`, `sysClr`, `prstClr`) et ses modificateurs, dans l'ordre du document. */
export function lireCouleur(el: Element | undefined, palette: Palette): Couleur | undefined {
  if (!el) return undefined;
  const base = el.localName === "srgbClr" ? el.getAttribute("val")
    : el.localName === "schemeClr" ? palette.get(el.getAttribute("val") ?? "")
      : el.localName === "sysClr" ? el.getAttribute("lastClr")
        : el.localName === "prstClr" ? NOMMEES[el.getAttribute("val") ?? ""] : null;
  if (!base || !/^[0-9a-fA-F]{6}$/.test(base)) return undefined;
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(base.slice(i, i + 2), 16) / 255) as [number, number, number];
  let alpha = 100000;
  for (const m of elementsEnfants(el)) {
    const v = Number(m.getAttribute("val") ?? 0) / 100000;
    if (m.localName === "alpha") alpha = Math.round(v * 100000);
    else if (m.localName === "shade") [r, g, b] = [r, g, b].map((c) => srgb(lin(c) * v)) as [number, number, number];
    else if (m.localName === "tint") [r, g, b] = [r, g, b].map((c) => srgb(1 - (1 - lin(c)) * v)) as [number, number, number];
    else if (m.localName === "lumMod" || m.localName === "lumOff" || m.localName === "satMod") {
      const [h, s, l] = versHsl(r, g, b);
      const [h2, s2, l2] = m.localName === "lumMod" ? [h, s, l * v] : m.localName === "lumOff" ? [h, s, l + v] : [h, borne(s * v), l];
      [r, g, b] = depuisHsl(h2, s2, borne(l2));
    }
  }
  const hex = [r, g, b].map((c) => Math.round(borne(c) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
  return alpha < 100000 ? { rgb: hex, alpha } : { rgb: hex };
}

/** La couleur portée par un élément de remplissage (`solidFill`, premier arrêt d'un `gradFill`, avant-plan d'un `pattFill`). */
export function couleurDeRemplissage(conteneur: Element | undefined, palette: Palette): Couleur | "aucun" | undefined {
  if (!conteneur) return undefined;
  if (enfant(conteneur, NS.a, "noFill")) return "aucun";
  const plein = enfant(conteneur, NS.a, "solidFill");
  if (plein) return lireCouleur(elementsEnfants(plein)[0], palette);
  const degrade = enfant(conteneur, NS.a, "gradFill");
  const arret = degrade ? chemin(degrade, ["a:gsLst", "a:gs"]) : undefined;
  if (arret) return lireCouleur(elementsEnfants(arret)[0], palette);
  const motif = enfant(conteneur, NS.a, "pattFill");
  const avant = motif ? enfant(motif, NS.a, "fgClr") : undefined;
  if (avant) return lireCouleur(elementsEnfants(avant)[0], palette);
  return undefined;
}
