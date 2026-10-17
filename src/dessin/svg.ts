// Le dessin du pivot rendu en SVG : formes et traits par rôles (classes du thème), textes en HTML (`foreignObject`), images par hash.
import type { Corps, Dessin, FormeDeDessin, TraitDeDessin } from "../pivot/seance-spec";
import { type Point, ligne, longueurDePointe, pointe, recule, tirets, tracer } from "./geometries";

/** Marge autour du cadre, en points (pointes de bulles, épaisseurs de traits). */
const MARGE = 6;
/** Épaisseur minimale d'un trait, en points (un trait « 0 » de PowerPoint reste visible). */
const TRAIT_MIN = 0.5;

const n = (v: number) => String(Math.round(v * 100) / 100);
const echappe = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Applique une homothétie puis une translation aux coordonnées d'un chemin SVG (M, L, C, Q, A, Z). */
export function transformerChemin(d: string, sx: number, sy: number, tx: number, ty: number): string {
  return d.replace(/([MLCQAZ])([^MLCQAZ]*)/g, (_, c: string, args: string) => {
    const v = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    if (c === "Z") return "Z";
    if (c === "A") {
      const out: string[] = [];
      for (let i = 0; i + 6 < v.length + 1; i += 7) {
        out.push(n(v[i]! * Math.abs(sx)), n(v[i + 1]! * Math.abs(sy)), String(v[i + 2]), String(v[i + 3]), String(sx * sy < 0 ? 1 - v[i + 4]! : v[i + 4]), n(v[i + 5]! * sx + tx), n(v[i + 6]! * sy + ty));
      }
      return "A" + out.join(" ");
    }
    return c + v.map((k, i) => n(i % 2 ? k * sy + ty : k * sx + tx)).join(" ");
  });
}

function attributsDeTrait(t: TraitDeDessin | undefined): string {
  if (!t) return ` class="sans-trait"`;
  const l = Math.max(TRAIT_MIN, t.largeur);
  const motif = tirets(t.tirets, l);
  return ` class="s-${t.couleur}" stroke-width="${n(l)}"${motif ? ` stroke-dasharray="${motif}"` : ""}`;
}

function corpsEnHtml(c: Corps, boite: readonly [number, number, number, number], transformation: string, forme?: readonly [number, number, number, number]): string {
  const [x, y, w, h] = boite;
  const [ml, mt, mr, mb] = c.marges;
  let [fx, fy, fw, fh] = [x + ml, y + mt, w - ml - mr, h - mt - mb];
  // Une petite forme (pastille numérotée) n'a pas la place de ses marges : son texte prend toute la forme, centré.
  const corpsMax = Math.max(0, ...c.paragraphes.flatMap((p) => p.fragments.map((f) => f.taille)));
  if (forme && (fw < corpsMax * 1.2 || fh < corpsMax * 1.2)) [fx, fy, fw, fh] = forme;
  fw = Math.max(1, fw);
  fh = Math.max(1, fh);
  const paragraphes = c.paragraphes.map((p) => {
    const fragments = p.fragments.map((f) => {
      const classes = [`c-${f.couleur}`, f.gras ? "g" : "", f.italique ? "i" : "", f.souligne ? "u" : ""].filter(Boolean).join(" ");
      const texte = f.texte ? echappe(f.texte).replace(/\n/g, "<br>") : "​";
      return `<span class="${classes}" style="--t:${n(f.taille)}">${texte}</span>`;
    }).join("");
    return `<p class="al-${p.alignement}">${fragments || "​"}</p>`;
  }).join("");
  return `<foreignObject x="${n(fx)}" y="${n(fy)}" width="${n(fw)}" height="${n(fh)}"${transformation}>`
    + `<div xmlns="http://www.w3.org/1999/xhtml" class="bt a-${c.ancrage}${c.retour === false ? " sans-retour" : ""}"><div class="bt-l">${paragraphes}</div></div></foreignObject>`;
}

function forme(e: FormeDeDessin): string {
  const [x, y, w, h] = e.boite;
  const [cx, cy] = [x + w / 2, y + h / 2];
  const rotation = e.rotation ? `rotate(${n(e.rotation)} ${n(cx)} ${n(cy)})` : "";
  const [sx, sy] = [e.retournement?.includes("h") ? -1 : 1, e.retournement?.includes("v") ? -1 : 1];
  const miroir = sx < 0 || sy < 0 ? `translate(${n(cx)} ${n(cy)}) scale(${sx} ${sy}) translate(${n(-cx)} ${n(-cy)})` : "";
  const tf = [rotation, miroir].filter(Boolean).join(" ");
  const fond = e.fond ? `f-${e.fond}` : "sans-fond";
  const trait = attributsDeTrait(e.trait).replace(/^ class="([^"]*)"/, ` class="${fond} $1"`);
  const parties: string[] = [];
  let zoneTexte: readonly [number, number, number, number] = [x, y, w, h];
  if (e.geometrie === "libre" && e.chemins) {
    for (const c of e.chemins) {
      const d = transformerChemin(c.d, w / (c.largeur || 1), h / (c.hauteur || 1), x, y);
      const cl = (c.remplir === false ? "sans-fond " : `${fond} `) + (c.tracer === false || !e.trait ? "sans-trait" : `s-${e.trait.couleur}`);
      const largeur = e.trait && c.tracer !== false ? ` stroke-width="${n(Math.max(TRAIT_MIN, e.trait.largeur))}"` : "";
      parties.push(`<path d="${d}" class="${cl}"${largeur}/>`);
    }
  } else {
    const t = tracer(e.geometrie, x, y, w, h, e.ajustements);
    if (t.points) {
      let pts: Point[] = [...t.points];
      const tr = e.trait;
      if (tr) {
        const lg = longueurDePointe(Math.max(TRAIT_MIN, tr.largeur));
        const k = pts.length - 1;
        if (tr.debut) pts[0] = recule(pts[0]!, pts[1]!, lg * 0.6);
        if (tr.fin) pts[k] = recule(pts[k]!, pts[k - 1]!, lg * 0.6);
        parties.push(`<path d="${ligne(pts)}" fill="none"${attributsDeTrait(tr)}/>`);
        const l = Math.max(TRAIT_MIN, tr.largeur);
        if (tr.debut) parties.push(`<path d="${pointe(tr.debut, t.points[0]!, t.points[1]!, l)}" class="f-${tr.couleur}"/>`);
        if (tr.fin) parties.push(`<path d="${pointe(tr.fin, t.points[k]!, t.points[k - 1]!, l)}" class="f-${tr.couleur}"/>`);
      }
    } else {
      parties.push(`<path d="${t.d}"${trait}/>`);
      if (t.traits && e.trait) parties.push(`<path d="${t.traits}" fill="none"${attributsDeTrait(e.trait)}/>`);
    }
    if (t.texte) zoneTexte = [x + t.texte[0], y + t.texte[1], t.texte[2], t.texte[3]];
  }
  const dessin = tf ? `<g transform="${tf}">${parties.join("")}</g>` : parties.join("");
  const texte = e.texte ? corpsEnHtml(e.texte, zoneTexte, rotation ? ` transform="${rotation}"` : "", e.boite) : "";
  return dessin + texte;
}

/** Le SVG d'un dessin ; `prefixe` rend uniques les identifiants (découpes d'images) dans le document. */
export function dessinEnSvg(d: Dessin, prefixe: string): string {
  const [x0, y0, w0, h0] = d.cadre;
  const parties: string[] = [];
  d.elements.forEach((e, i) => {
    if (e.type === "forme") {
      parties.push(forme(e));
      return;
    }
    const [x, y, w, h] = e.boite;
    if (e.type === "image") {
      const [l, t, r, b] = (e.rognage ?? [0, 0, 0, 0]).map((v) => v / 100000) as [number, number, number, number];
      const W = w / Math.max(0.01, 1 - l - r);
      const H = h / Math.max(0.01, 1 - t - b);
      const id = `${prefixe}-d${i}`;
      const decoupe = e.geometrie ? tracer(e.geometrie, x, y, w, h).d : `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`;
      parties.push(`<clipPath id="${id}"><path d="${decoupe}"/></clipPath>`
        + `<image clip-path="url(#${id})" data-media="${echappe(e.media)}" x="${n(x - l * W)}" y="${n(y - t * H)}" width="${n(W)}" height="${n(H)}" preserveAspectRatio="none"/>`);
      return;
    }
    const somme = e.hauteurs.reduce((a, v) => a + v, 0) || 1;
    const hauteurs = e.hauteurs.map((v) => (v * h) / somme);
    const debutsX = e.colonnes.map((_, k) => x + e.colonnes.slice(0, k).reduce((a, v) => a + v, 0));
    let cy = y;
    e.cellules.forEach((ligneDeCellules, r) => {
      const hh = hauteurs[r] ?? 0;
      ligneDeCellules.forEach((c, k) => {
        const cx = debutsX[k] ?? x;
        const cw = e.colonnes[k] ?? 0;
        if (c.fond) parties.push(`<rect x="${n(cx)}" y="${n(cy)}" width="${n(cw)}" height="${n(hh)}" class="f-${c.fond}"/>`);
        const cotes: [Point, Point][] = [[[cx, cy], [cx + cw, cy]], [[cx + cw, cy], [cx + cw, cy + hh]], [[cx, cy + hh], [cx + cw, cy + hh]], [[cx, cy], [cx, cy + hh]]];
        c.bords.forEach((t, j) => {
          if (t) parties.push(`<path d="${ligne(cotes[j]!)}" fill="none"${attributsDeTrait(t)}/>`);
        });
        if (c.texte.paragraphes.some((p) => p.fragments.some((f) => f.texte.trim()))) parties.push(corpsEnHtml(c.texte, [cx, cy, cw, hh], ""));
      });
      cy += hh;
    });
  });
  const vb = [x0 - MARGE, y0 - MARGE, w0 + 2 * MARGE, h0 + 2 * MARGE].map(n).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" class="dessin" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${parties.join("")}</svg>`;
}
