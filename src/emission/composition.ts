// Une composition (PKG-B4, B5) en formes natives éditables (PKG-C3) : le gabarit `cas` en bandeaux et étapes, le gabarit
// `tableau` en phases, couloirs et étapes posées dans leurs cases. Ce qui se relit est nommé (G·cas n, G·étape n, G·phase n,
// G·couloir n, G·signal, G·légende n) ; la place d'une étape dit sa case ; sa manière (fond, bord) se lit dans ses couleurs
// et son trait. Les vignettes (signes des couloirs, illustration) sont des dessins en groupes.
import type { Composition, Role } from "../pivot/seance-spec";
import { ROLES_SOMBRES } from "../qualification/roles";
import type { Region } from "./gabarit";
import { NOMS, couleurDeRole } from "./grammaire";
import { groupeXml, placer, remplissage, type ContexteDeDessin } from "./dessin";
import { x } from "./xml";

type Bord = "plein" | "tirets" | "aucun";
type EntreeDeLegende = NonNullable<Composition["legende"]>[number];

const ECART = 109728;
const PETIT = 45720;
const LEGENDE = 320040;

/** Le trait d'une manière : plein, en tirets (un tiers, un envoi), ou sans. */
export function bordXml(b: Bord): string {
  if (b === "aucun") return "<a:ln><a:noFill/></a:ln>";
  return `<a:ln w="12700"><a:solidFill>${couleurDeRole("marine-fort")}</a:solidFill>${b === "tirets" ? '<a:prstDash val="dash"/>' : ""}</a:ln>`;
}

const encreSur = (fond: Role | undefined): Role => (fond && ROLES_SOMBRES.has(fond) ? "papier" : "encre");

interface Ligne { readonly texte: string; readonly taille: number; readonly gras?: boolean; readonly italique?: boolean }

/** Des paragraphes de texte simple, un « \n » en saut de ligne. */
function paragraphes(lignes: readonly Ligne[], couleur: Role, algn: "l" | "ctr"): string {
  return lignes.map((l) => {
    const rPr = `<a:rPr lang="fr-FR" sz="${l.taille}"${l.gras ? ' b="1"' : ""}${l.italique ? ' i="1"' : ""} dirty="0"><a:solidFill>${couleurDeRole(couleur)}</a:solidFill></a:rPr>`;
    const corps = l.texte.split("\n").map((m, i) => (i ? `<a:br>${rPr}</a:br>` : "") + (m ? `<a:r>${rPr}<a:t>${x(m)}</a:t></a:r>` : "")).join("");
    return `<a:p><a:pPr algn="${algn}"/>${corps}${l.texte === "" ? rPr.replace("a:rPr", "a:endParaRPr").replace("</a:rPr>", "</a:endParaRPr>") : ""}</a:p>`;
  }).join("");
}

interface Boite {
  readonly nom: string;
  readonly b: Region;
  readonly geometrie?: string;
  readonly fond?: Role | undefined;
  readonly bord?: Bord;
  readonly lignes?: readonly Ligne[];
  readonly algn?: "l" | "ctr";
  readonly ancre?: "t" | "ctr";
  readonly marges?: readonly [number, number, number, number];
}

function boiteXml(o: Boite, ctx: ContexteDeDessin): string {
  const [l, t, r, b] = o.marges ?? [PETIT, PETIT, PETIT, PETIT];
  const corps = o.lignes
    ? `<p:txBody><a:bodyPr wrap="square" lIns="${l}" tIns="${t}" rIns="${r}" bIns="${b}" anchor="${o.ancre ?? "ctr"}" rtlCol="0"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paragraphes(o.lignes, encreSur(o.fond), o.algn ?? "ctr")}</p:txBody>`
    : "";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${ctx.id()}" name="${x(o.nom)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr><a:xfrm><a:off x="${Math.round(o.b[0])}" y="${Math.round(o.b[1])}"/><a:ext cx="${Math.round(o.b[2])}" cy="${Math.round(o.b[3])}"/></a:xfrm>`
    + `<a:prstGeom prst="${o.geometrie ?? "rect"}"><a:avLst/></a:prstGeom>${remplissage(o.fond)}${bordXml(o.bord ?? "aucun")}</p:spPr>${corps}</p:sp>`;
}

/** La légende : une rangée d'entrées, chacune un échantillon (case ou triangle à sa manière) et son libellé. */
function legendeXml(entrees: readonly EntreeDeLegende[], r: Region, ctx: ContexteDeDessin): string[] {
  const largeur = r[2] / entrees.length;
  const cote = 201168;
  return entrees.flatMap((e, i) => {
    const x0 = r[0] + i * largeur;
    const y0 = r[1] + (r[3] - cote) / 2;
    const forme = e.forme === "triangle" ? "triangle" : "case";
    return [
      boiteXml({ nom: `${NOMS.legende} ${i + 1} · ${forme}`, b: [x0, y0, cote, cote], geometrie: forme === "triangle" ? "triangle" : "rect", fond: e.fond, bord: e.bord }, ctx),
      boiteXml({ nom: `${NOMS.legende} ${i + 1}`, b: [x0 + cote + PETIT, r[1], largeur - cote - 2 * PETIT, r[3]], lignes: [{ texte: e.texte, taille: 900 }], algn: "l", marges: [PETIT, 0, 0, 0] }, ctx),
    ];
  });
}

function casXml(c: Extract<Composition, { gabarit: "cas" }>, r: Region, ctx: ContexteDeDessin): string[] {
  const n = Math.max(1, c.cas.length);
  const legende = c.legende?.length ? LEGENDE + ECART : 0;
  const cw = (r[2] - ECART * (n - 1)) / n;
  const bh = 457200;
  const y0 = r[1] + bh + ECART;
  const zone = r[3] - bh - ECART - legende;
  const m = Math.max(1, ...c.cas.map((k) => k.etapes.length));
  const ecart = 73152;
  const sh = Math.min(640080, (zone - ecart * (m - 1)) / m);
  const out: string[] = [];
  c.cas.forEach((k, i) => {
    const x0 = r[0] + i * (cw + ECART);
    out.push(boiteXml({ nom: `${NOMS.cas} ${k.numero}`, b: [x0, r[1], cw, bh], fond: k.couleur, lignes: [{ texte: k.titre, taille: 1200, gras: true }] }, ctx));
    k.etapes.forEach((e, j) => {
      const lignes: Ligne[] = [{ texte: e.texte, taille: 1050 }, ...(e.detail !== undefined ? e.detail.split("\n").map((t) => ({ texte: t, taille: 900, italique: true })) : [])];
      out.push(boiteXml({ nom: `${NOMS.etape} ${e.numero}`, b: [x0, y0 + j * (sh + ecart), cw, sh], geometrie: "roundRect", fond: e.fond, bord: e.bord, lignes }, ctx));
    });
  });
  if (c.legende?.length) out.push(...legendeXml(c.legende, [r[0], r[1] + r[3] - LEGENDE, r[2], LEGENDE], ctx));
  return out;
}

function tableauXml(t: Extract<Composition, { gabarit: "tableau" }>, r: Region, ctx: ContexteDeDessin): string[] {
  const n = Math.max(1, t.colonnes.length);
  const m = Math.max(1, t.lignes.length);
  const legende = t.legende?.length ? LEGENDE + ECART : 0;
  const hh = 457200;
  const c0 = 1463040;
  const pw = (r[2] - c0) / n;
  const lh = (r[3] - hh - legende) / m;
  const out: string[] = [];
  // Le décor : une bande sur deux, sous les étapes (jamais relu).
  t.lignes.forEach((_, i) => {
    if (i % 2 === 0) out.push(boiteXml({ nom: NOMS.decor, b: [r[0] + c0, r[1] + hh + i * lh, r[2] - c0, lh], fond: "gris-pale" }, ctx));
  });
  // Les couloirs : leur nom, leur signe à gauche.
  const cote = Math.min(lh - 2 * PETIT, 411480);
  t.lignes.forEach((l, i) => {
    const y = r[1] + hh + i * lh;
    out.push(boiteXml({ nom: `${NOMS.couloir} ${i + 1}`, b: [r[0], y, c0, lh], fond: "gris-pale", lignes: [{ texte: l.titre, taille: 900, gras: true }], algn: "l", marges: [l.signe ? cote + 2 * PETIT : PETIT, PETIT, PETIT, PETIT] }, ctx));
    if (l.signe) out.push(...groupeXml(`${NOMS.signe} ${i + 1}`, `signe ${i + 1}`, l.signe, placer(l.signe.cadre, [r[0] + PETIT, y + (lh - cote) / 2, cote, cote], true).place, ctx));
  });
  // Les phases, à leur couleur.
  t.colonnes.forEach((k, j) => {
    out.push(boiteXml({ nom: `${NOMS.phase} ${j + 1}`, b: [r[0] + c0 + j * pw, r[1], pw, hh], fond: k.couleur, lignes: [{ texte: k.titre, taille: 1000, gras: true }] }, ctx));
  });
  // Le coin : l'illustration.
  if (t.illustration) out.push(...groupeXml(NOMS.illustration, "illustration", t.illustration, placer(t.illustration.cadre, [r[0] + PETIT, r[1] + PETIT, c0 - 2 * PETIT, hh - 2 * PETIT], true).place, ctx));
  // Les étapes, côte à côte dans leur case, dans l'ordre du pivot ; une étape à signal est un groupe (la carte et son
  // triangle au coin), si bien qu'on la déplace d'un geste.
  const parCase = new Map<string, number[]>();
  t.etapes.forEach((e, k) => { const cle = `${e.ligne}:${e.colonne}`; parCase.set(cle, [...(parCase.get(cle) ?? []), k]); });
  t.etapes.forEach((e, k) => {
    const voisines = parCase.get(`${e.ligne}:${e.colonne}`)!;
    const q = voisines.length;
    const rang = voisines.indexOf(k);
    const w = (pw - PETIT * (q + 1)) / q;
    const b: Region = [r[0] + c0 + e.colonne * pw + PETIT + rang * (w + PETIT), r[1] + hh + e.ligne * lh + PETIT, w, lh - 2 * PETIT];
    const nom = e.numero !== undefined ? `${NOMS.etape} ${e.numero}` : NOMS.etape;
    const carte = boiteXml({ nom, b, geometrie: "roundRect", fond: e.fond, bord: e.bord, lignes: [{ texte: e.texte, taille: 800 }], marges: [PETIT, 18288, PETIT, 18288] }, ctx);
    if (!e.signal) { out.push(carte); return; }
    const s = 128016;
    const tb: Region = [b[0] + b[2] - 0.7 * s, b[1] - 0.3 * s, s, s];
    const signal = boiteXml({ nom: NOMS.signal, b: tb, geometrie: "triangle", fond: e.signal }, ctx);
    const [x0, y0] = [Math.round(Math.min(b[0], tb[0])), Math.round(Math.min(b[1], tb[1]))];
    const [x1, y1] = [Math.round(Math.max(b[0] + b[2], tb[0] + tb[2])), Math.round(Math.max(b[1] + b[3], tb[1] + tb[3]))];
    const repere = `<a:off x="${x0}" y="${y0}"/><a:ext cx="${x1 - x0}" cy="${y1 - y0}"/>`;
    out.push(`<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${ctx.id()}" name="${x(nom)}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>`
      + `<p:grpSpPr><a:xfrm>${repere}${repere.replace("a:off", "a:chOff").replace("a:ext", "a:chExt")}</a:xfrm></p:grpSpPr>${carte}${signal}</p:grpSp>`);
  });
  if (t.legende?.length) out.push(...legendeXml(t.legende, [r[0], r[1] + r[3] - LEGENDE, r[2], LEGENDE], ctx));
  return out;
}

/** Une composition dans une région (EMU) : les formes à ajouter à l'arbre de la diapositive, dans l'ordre. */
export function compositionXml(c: Composition, r: Region, ctx: ContexteDeDessin): string[] {
  return c.gabarit === "cas" ? casXml(c, r, ctx) : tableauXml(c, r, ctx);
}
