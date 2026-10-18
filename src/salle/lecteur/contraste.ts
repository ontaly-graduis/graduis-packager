// Le contraste des pictogrammes sur leur aplat : mesuré au navigateur (le rôle au thème, l'icône à ses pixels), corrigé dans la famille.
import type { Role } from "../../pivot/seance-spec";

/** Les tons d'une famille, du plus soutenu au plus pâle (ceux du pivot ; repris ici pour ne pas embarquer zod au lecteur). */
type Ton<R> = R extends `${string}-${infer T}` ? T : never;
const TONS = ["fort", "moyen", "pale"] as const satisfies readonly Ton<Role>[];
/** Le seuil WCAG des éléments graphiques (1.4.11) : 3:1. */
const SEUIL = 3;
const COTE = 48;

/** Le rapport de contraste WCAG de deux luminances relatives. */
const rapport = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const lineaire = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (r: number, g: number, b: number) => 0.2126 * lineaire(r) + 0.7152 * lineaire(g) + 0.0722 * lineaire(b);

/**
 * L'aplat d'une icône de luminance donnée : son rôle s'il la porte à 3:1 ; sinon le ton de sa famille le plus proche qui
 * y parvient ; sinon le plus contrasté de la famille. Le papier et l'encre restent ce qu'ils sont.
 */
export function fondLisible(role: Role, icone: number, luminanceDe: (r: Role) => number): Role {
  const contraste = (r: Role) => rapport(luminanceDe(r), icone);
  if (!(contraste(role) < SEUIL)) return role;
  const [famille, ton] = role.split("-");
  const rang = TONS.findIndex((t) => t === ton);
  if (rang < 0) return role;
  const tons = TONS.map((t, i) => ({ r: `${famille}-${t}` as Role, distance: Math.abs(i - rang), c: contraste(`${famille}-${t}` as Role) }))
    .filter((x) => Number.isFinite(x.c));
  const proche = tons.filter((x) => x.c >= SEUIL).sort((a, b) => a.distance - b.distance || b.c - a.c)[0];
  return (proche ?? tons.sort((a, b) => b.c - a.c)[0])?.r ?? role;
}

/** La luminance moyenne des pixels opaques d'une icône, mesurée une fois par source ; `null` si elle ne se lit pas. */
const icones = new Map<string, Promise<number | null>>();

function luminanceDIcone(img: HTMLImageElement): Promise<number | null> {
  let mesure = icones.get(img.src);
  if (!mesure) {
    mesure = img.decode().then(() => {
      const toile = img.ownerDocument.createElement("canvas");
      toile.width = COTE;
      toile.height = COTE;
      const g = toile.getContext("2d", { willReadFrequently: true });
      if (!g) return null;
      g.drawImage(img, 0, 0, COTE, COTE);
      const px = g.getImageData(0, 0, COTE, COTE).data;
      let n = 0;
      let somme = 0;
      for (let k = 0; k < px.length; k += 4) {
        if (px[k + 3]! <= 200) continue;
        n += 1;
        somme += luminance(px[k]! / 255, px[k + 1]! / 255, px[k + 2]! / 255);
      }
      return n ? somme / n : null;
    }).catch(() => null);
    icones.set(img.src, mesure);
  }
  return mesure;
}

/** La luminance d'un rôle au thème, lue sur une sonde : `rgb(…)`, ou `color(srgb …)` pour un mélange (color-mix). */
const roles = new Map<string, number>();

function luminanceDeRole(doc: Document, role: Role): number {
  const connue = roles.get(role);
  if (connue !== undefined) return connue;
  const sonde = doc.createElement("span");
  sonde.style.background = `var(--dessin-${role})`;
  doc.body.append(sonde);
  const c = doc.defaultView?.getComputedStyle(sonde).backgroundColor ?? "";
  sonde.remove();
  const rgb = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(c);
  const srgb = /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)/.exec(c);
  const l = rgb ? luminance(Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255)
    : srgb ? luminance(Number(srgb[1]), Number(srgb[2]), Number(srgb[3])) : Number.NaN;
  roles.set(role, l);
  return l;
}

/** Rend lisibles les aplats d'une diapositive rendue (`[data-fond]` : l'aplat lui-même, ou le disque de son icône). */
export function contraster(racine: Element): void {
  racine.querySelectorAll<HTMLElement>("[data-fond]").forEach((aplat) => {
    const img = aplat.tagName === "IMG" ? (aplat as HTMLImageElement) : aplat.querySelector("img");
    const role = aplat.dataset.fond as Role;
    if (!img?.src) return;
    void luminanceDIcone(img).then((l) => {
      if (l === null || !aplat.isConnected) return;
      const fond = fondLisible(role, l, (r) => luminanceDeRole(aplat.ownerDocument, r));
      if (fond !== role) aplat.style.background = `var(--dessin-${fond})`;
    });
  });
}
