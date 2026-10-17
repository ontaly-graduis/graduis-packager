// L'harmonisation des couleurs : chaque couleur du deck (opacité composée sur le blanc) va à un rôle du thème, par famille de teinte et ton.
import type { Couleur } from "../ooxml/couleurs";
import type { Role } from "../pivot/seance-spec";

/** Seuils de la projection (OKLab : clarté L de 0 à 1, chroma C). Réglés sur les schémas du deck Boost acheteur (17/10). */
export const SEUILS_ROLES = {
  /** En deçà de cette saturation (TSL) ou de ce chroma, la couleur est un gris. */
  saturationNeutre: 0.15,
  chromaNeutre: 0.012,
  /** Gris très clair : papier ; gris très sombre : encre. */
  papier: 0.97,
  encre: 0.3,
  /** Ton fort sous cette clarté, ou sous `fortVif` si le chroma dépasse `vif` ; ton pâle au-dessus de `pale` si peu saturé. */
  fort: 0.66,
  fortVif: 0.78,
  vif: 0.15,
  pale: 0.85,
  chromaPale: 0.1,
  /** Deux couleurs d'un schéma se fondent si leur écart OKLab est en deçà et, colorées toutes deux, si leurs teintes sont proches. */
  fusion: 0.12,
  teinteFusion: 30,
} as const;

/** Familles par teinte TSL, en degrés : [début, fin, famille]. */
const TEINTES: readonly (readonly [number, number, string])[] = [
  [0, 15, "rouge"], [15, 65, "ambre"], [65, 165, "vert"], [165, 200, "ciel"], [200, 300, "marine"], [300, 360, "rouge"],
];

/** Les rôles sombres (texte clair dessus) ; tous les autres sont clairs (texte sombre dessus). */
export const ROLES_SOMBRES: ReadonlySet<Role> = new Set(["marine-fort", "marine-moyen", "vert-fort", "ambre-fort", "rouge-fort", "gris-fort", "encre"]);

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function rvb(c: Couleur): [number, number, number] {
  const a = (c.alpha ?? 100000) / 100000;
  return [0, 2, 4].map((i) => (parseInt(c.rgb.slice(i, i + 2), 16) / 255) * a + (1 - a)) as [number, number, number];
}

/** OKLab (Björn Ottosson, 2020) : clarté, axes a et b, chroma perceptifs. */
export function oklab(c: Couleur): { L: number; a: number; b: number; C: number } {
  const [r, g, b] = rvb(c).map(lin) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, a: A, b: B, C: Math.hypot(A, B) };
}

function teinteEtSaturation(c: Couleur): { h: number; s: number } {
  const [r, g, b] = rvb(c);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return { h: 0, s: 0 };
  const d = max - min;
  const l = (max + min) / 2;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s };
}

export function roleDe(c: Couleur): Role {
  const S = SEUILS_ROLES;
  const { L, C } = oklab(c);
  const { h, s } = teinteEtSaturation(c);
  if (s < S.saturationNeutre || C < S.chromaNeutre) {
    if (L >= S.papier) return "papier";
    if (L < S.encre) return "encre";
    return L < S.fort ? "gris-fort" : L < S.pale ? "gris-moyen" : "gris-pale";
  }
  const famille = TEINTES.find(([a, b]) => h >= a && h < b)?.[2] ?? "rouge";
  const ton = L < S.fort || (C >= S.vif && L < S.fortVif) ? "fort" : L >= S.pale && C < S.chromaPale ? "pale" : "moyen";
  return `${famille}-${ton}` as Role;
}

/** Le rôle d'un texte posé sur un fond : il garde sa famille s'il contraste, sinon passe à l'encre marine ou au papier. */
export function roleDeTexte(texte: Role, fond: Role | undefined): Role {
  if (!fond) return texte;
  const fondSombre = ROLES_SOMBRES.has(fond);
  if (fondSombre === ROLES_SOMBRES.has(texte)) return fondSombre ? "papier" : "marine-fort";
  return texte;
}

/** La clé d'une couleur d'origine : RVB, et l'opacité en pour-cent si elle n'est pas pleine. */
export const cleDeCouleur = (c: Couleur) => c.rgb + (c.alpha !== undefined && c.alpha < 100000 ? `/${Math.round(c.alpha / 1000)}` : "");

/** Deux nuances d'une même couleur : proches en OKLab et, si toutes deux sont colorées, de teintes voisines. */
function semblables(x: Couleur, y: Couleur): boolean {
  const [p, q] = [oklab(x), oklab(y)];
  if (Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b) > SEUILS_ROLES.fusion) return false;
  const [u, v] = [teinteEtSaturation(x), teinteEtSaturation(y)];
  if (u.s < SEUILS_ROLES.saturationNeutre || v.s < SEUILS_ROLES.saturationNeutre) return true;
  const d = Math.abs(u.h - v.h) % 360;
  return Math.min(d, 360 - d) <= SEUILS_ROLES.teinteFusion;
}

export interface Projection {
  /** Couleur d'origine (clé) → rôle. */
  readonly roles: ReadonlyMap<string, Role>;
  /** Les rôles qui reçoivent plusieurs couleurs d'origine, et lesquelles. */
  readonly fusions: readonly { readonly role: Role; readonly origines: readonly string[]; readonly distinctes: boolean }[];
}

const TONS_ORDONNES = ["fort", "moyen", "pale"] as const;

/** Les affectations croissantes de `k` groupes (du plus sombre au plus clair) aux trois tons. */
function affectations(k: number): number[][] {
  const out: number[][] = [];
  const suite = (debut: number, reste: number, acc: number[]) => {
    if (!reste) return void out.push(acc);
    for (let t = debut; t <= 3 - reste; t++) suite(t + 1, reste - 1, [...acc, t]);
  };
  suite(0, k, []);
  return out;
}

/**
 * La projection des couleurs d'un schéma. Des nuances d'une même couleur (écart OKLab sous `fusion`, teintes voisines) se
 * fondent : c'est l'harmonisation. Dans une famille, les groupes nettement distincts prennent des tons distincts, rangés du plus sombre au
 * plus clair et au plus près de leur ton naturel, pour qu'une légende garde ses distinctions ; au-delà de trois groupes, ils
 * gardent leur ton naturel et le rapport signale la confusion. Le papier et l'encre n'ont pas de tons : tout y fond.
 */
export function projeter(couleurs: readonly Couleur[]): Projection {
  const usages = new Map<string, { c: Couleur; n: number }>();
  for (const c of couleurs) {
    const k = cleDeCouleur(c);
    usages.set(k, { c, n: (usages.get(k)?.n ?? 0) + 1 });
  }
  const ordre = [...usages].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
  const roles = new Map<string, Role>();
  const distinctes = new Set<Role>();
  const familles = new Map<string, { rep: Couleur; ton: number; cles: string[]; n: number }[]>();
  for (const [k, { c, n }] of ordre) {
    const naturel = roleDe(c);
    const [famille, ton] = naturel.split("-") as [string, string | undefined];
    if (!ton) {
      roles.set(k, naturel);
      continue;
    }
    const groupes = familles.get(famille) ?? [];
    const g = groupes.find((x) => semblables(c, x.rep));
    if (g) {
      g.cles.push(k);
      g.n += n;
    } else groupes.push({ rep: c, ton: TONS_ORDONNES.indexOf(ton as (typeof TONS_ORDONNES)[number]), cles: [k], n });
    familles.set(famille, groupes);
  }
  for (const [famille, groupes] of familles) {
    const tries = [...groupes].sort((a, b) => oklab(a.rep).L - oklab(b.rep).L);
    let tons = tries.map((g) => g.ton);
    if (tries.length <= 3) {
      // Le groupe le plus employé s'écarte le moins de son ton naturel.
      const cout = (a: number[]) => a.reduce((s, t, i) => s + tries[i]!.n * Math.abs(t - tries[i]!.ton), 0);
      tons = affectations(tries.length).reduce((m, a) => (cout(a) < cout(m) ? a : m));
    }
    tries.forEach((g, i) => {
      const role = `${famille}-${TONS_ORDONNES[tons[i]!]}` as Role;
      if (tons.filter((t) => t === tons[i]).length > 1) distinctes.add(role);
      for (const k of g.cles) roles.set(k, role);
    });
  }
  const parRole = new Map<Role, string[]>();
  for (const [k, r] of roles) parRole.set(r, [...(parRole.get(r) ?? []), k]);
  const fusions = [...parRole].filter(([, v]) => v.length > 1).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([role, v]) => ({ role, origines: [...v].sort(), distinctes: distinctes.has(role) }));
  return { roles, fusions };
}
