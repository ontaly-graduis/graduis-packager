// Le dessin d'un schéma en formes natives (PKG-C3) : un groupe dont le repère enfant est celui du dessin (un point du
// pivot vaut 12 700 EMU, au centième près exact), ses formes, images et chemins tels qu'ils ont été relevés, leurs couleurs
// en rôles du thème (I-PKG-6). Le dévoilement se lit dans les noms (pas, ordre, pastille) : pas d'animation.
// Un tableau ne se groupe pas dans PowerPoint : il est posé hors du groupe, à sa place, son rang d'empilement dans son nom.
import type { Corps, Dessin, ElementDeDessin, FormeDeDessin, Role, TraitDeDessin } from "../pivot/seance-spec";

type CheminLibre = NonNullable<FormeDeDessin["chemins"]>[number];
import type { Region } from "./gabarit";
import { EMU, NOMS, couleurDeRole, nomDElement } from "./grammaire";
import { x } from "./xml";

/** Points du pivot → EMU. */
export const emu = (pt: number) => Math.round(pt * EMU.point);

export interface ContexteDeDessin {
  /** L'identifiant suivant de la diapositive. */
  readonly id: () => number;
  /** La relation d'une image (le média enregistré dans le paquet) et si elle est vectorielle. */
  readonly image: (media: string) => { readonly rId: string; readonly svg: boolean };
}

const ALIGNEMENTS = { gauche: "l", centre: "ctr", droite: "r", justifie: "just" } as const;
const ANCRAGES = { haut: "t", milieu: "ctr", bas: "b" } as const;

export const remplissage = (r: Role | undefined) => (r ? `<a:solidFill>${couleurDeRole(r)}</a:solidFill>` : "<a:noFill/>");

export function traitXml(t: TraitDeDessin | null | undefined, balise = "a:ln"): string {
  if (!t) return `<${balise}><a:noFill/></${balise}>`;
  return `<${balise} w="${emu(t.largeur)}"><a:solidFill>${couleurDeRole(t.couleur)}</a:solidFill>`
    + (t.tirets ? `<a:prstDash val="${t.tirets}"/>` : "") + (t.debut ? `<a:headEnd type="${t.debut}"/>` : "") + (t.fin ? `<a:tailEnd type="${t.fin}"/>` : "")
    + `</${balise}>`;
}

type Fragment = Corps["paragraphes"][number]["fragments"][number];

function rPr(f: Fragment, police: string | undefined, balise = "a:rPr"): string {
  return `<${balise} lang="fr-FR" sz="${Math.round(f.taille * 100)}"${f.gras ? ' b="1"' : ""}${f.italique ? ' i="1"' : ""}${f.souligne ? ' u="sng"' : ""} dirty="0">`
    + `<a:solidFill>${couleurDeRole(f.couleur)}</a:solidFill>${police ? `<a:latin typeface="${x(police)}"/>` : ""}</${balise}>`;
}

/** Un paragraphe : ses fragments en runs, un « \n » en saut de ligne au style du fragment ; vide, son seul style. */
function paragrapheXml(p: Corps["paragraphes"][number], police: string | undefined): string {
  const pPr = `<a:pPr algn="${ALIGNEMENTS[p.alignement]}"/>`;
  const seul = p.fragments.length === 1 ? p.fragments[0]! : undefined;
  if (seul && seul.texte === "") return `<a:p>${pPr}${rPr(seul, police, "a:endParaRPr")}</a:p>`;
  const runs = p.fragments.map((f) => f.texte.split("\n").map((m, i) => (i ? `<a:br>${rPr(f, police)}</a:br>` : "") + (m ? `<a:r>${rPr(f, police)}<a:t>${x(m)}</a:t></a:r>` : "")).join("")).join("");
  return `<a:p>${pPr}${runs}</a:p>`;
}

/** Les paragraphes d'un cadre de texte, sous `bodyPr` (sans ajustement automatique : les corps sont déjà à l'échelle). */
export function corpsXml(c: Corps, balise = "p:txBody"): string {
  const [l, t, r, b] = c.marges.map(emu);
  return `<${balise}><a:bodyPr wrap="${c.retour === false ? "none" : "square"}" lIns="${l}" tIns="${t}" rIns="${r}" bIns="${b}" anchor="${ANCRAGES[c.ancrage]}" rtlCol="0"><a:noAutofit/></a:bodyPr>`
    // Un cadre sans paragraphe (une cellule vide) : un paragraphe nu, que la lecture reconnaît (un vrai porte son alignement).
    + `<a:lstStyle/>${c.paragraphes.length ? c.paragraphes.map((p) => paragrapheXml(p, c.police)).join("") : "<a:p/>"}</${balise}>`;
}

/** Un chemin SVG (M, L, C, Q, Z, A) en chemin DrawingML ; un arc repasse en `arcTo` depuis le point courant. */
function cheminXml(c: CheminLibre): string {
  const out: string[] = [];
  let cur: [number, number] = [0, 0];
  let debut: [number, number] = [0, 0];
  const pt = (px: number, py: number) => `<a:pt x="${px}" y="${py}"/>`;
  for (const [, cmd, arg] of c.d.matchAll(/([MLCQZA])([^MLCQZA]*)/g)) {
    const n = (arg ?? "").trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (cmd === "M") { out.push(`<a:moveTo>${pt(n[0]!, n[1]!)}</a:moveTo>`); cur = [n[0]!, n[1]!]; debut = cur; }
    else if (cmd === "L") { out.push(`<a:lnTo>${pt(n[0]!, n[1]!)}</a:lnTo>`); cur = [n[0]!, n[1]!]; }
    else if (cmd === "C") { out.push(`<a:cubicBezTo>${pt(n[0]!, n[1]!)}${pt(n[2]!, n[3]!)}${pt(n[4]!, n[5]!)}</a:cubicBezTo>`); cur = [n[4]!, n[5]!]; }
    else if (cmd === "Q") { out.push(`<a:quadBezTo>${pt(n[0]!, n[1]!)}${pt(n[2]!, n[3]!)}</a:quadBezTo>`); cur = [n[2]!, n[3]!]; }
    else if (cmd === "Z") { out.push("<a:close/>"); cur = debut; }
    else if (cmd === "A") {
      const [rx, ry, , grand, sens, fx, fy] = n as [number, number, number, number, number, number, number];
      const { st, sw } = arcDepuis(cur, [fx, fy], rx, ry, grand === 1, sens === 1);
      out.push(`<a:arcTo wR="${rx}" hR="${ry}" stAng="${st}" swAng="${sw}"/>`);
      cur = [fx, fy];
    }
  }
  return `<a:path w="${c.largeur}" h="${c.hauteur}"${c.remplir === false ? ' fill="none"' : ""}${c.tracer === false ? ' stroke="0"' : ""}>${out.join("")}</a:path>`;
}

/** L'arc elliptique (axes droits) d'un point à un autre en angles DrawingML (60 000es de degré, paramétriques). */
function arcDepuis(a: readonly [number, number], b: readonly [number, number], rx: number, ry: number, grand: boolean, sens: boolean): { st: number; sw: number } {
  if (!rx || !ry) return { st: 0, sw: 0 };
  const x1 = (a[0] - b[0]) / 2;
  const y1 = (a[1] - b[1]) / 2;
  const l = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  const [Rx, Ry] = l > 1 ? [rx * Math.sqrt(l), ry * Math.sqrt(l)] : [rx, ry];
  const num = Math.max(0, Rx * Rx * Ry * Ry - Rx * Rx * y1 * y1 - Ry * Ry * x1 * x1);
  const k = (grand === sens ? -1 : 1) * Math.sqrt(num / (Rx * Rx * y1 * y1 + Ry * Ry * x1 * x1 || 1));
  const cx = (k * Rx * y1) / Ry;
  const cy = (-k * Ry * x1) / Rx;
  const angle = (ux: number, uy: number) => Math.atan2(uy, ux);
  const t1 = angle((x1 - cx) / Rx, (y1 - cy) / Ry);
  let dt = angle((-x1 - cx) / Rx, (-y1 - cy) / Ry) - t1;
  if (sens && dt < 0) dt += 2 * Math.PI;
  if (!sens && dt > 0) dt -= 2 * Math.PI;
  const deg = (r: number) => Math.round((r * 180 / Math.PI) * 60000);
  return { st: ((deg(t1) % 21600000) + 21600000) % 21600000, sw: deg(dt) };
}

const xfrmXml = (b: readonly [number, number, number, number], attrs = "") =>
  `<a:xfrm${attrs}><a:off x="${emu(b[0])}" y="${emu(b[1])}"/><a:ext cx="${emu(b[2])}" cy="${emu(b[3])}"/></a:xfrm>`;

function formeXml(e: Extract<ElementDeDessin, { type: "forme" }>, ctx: ContexteDeDessin): string {
  const attrs = (e.rotation ? ` rot="${Math.round(e.rotation * 60000)}"` : "")
    + (e.retournement?.includes("h") ? ' flipH="1"' : "") + (e.retournement?.includes("v") ? ' flipV="1"' : "");
  const geometrie = e.chemins?.length
    ? `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst>${e.chemins.map(cheminXml).join("")}</a:pathLst></a:custGeom>`
    : `<a:prstGeom prst="${x(e.geometrie)}"><a:avLst>${Object.entries(e.ajustements ?? {}).map(([n, v]) => `<a:gd name="${x(n)}" fmla="val ${v}"/>`).join("")}</a:avLst></a:prstGeom>`;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${ctx.id()}" name="${x(nomDElement(NOMS.forme, e))}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr>${xfrmXml(e.boite, attrs)}${geometrie}${remplissage(e.fond)}${traitXml(e.trait)}</p:spPr>${e.texte ? corpsXml(e.texte) : ""}</p:sp>`;
}

/** Le blip d'une image : une image vectorielle se lit dans l'extension SVG (comme le deck d'origine). */
export const blipXml = (rId: string, svg: boolean) => (svg
  ? `<a:blip><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${rId}"/></a:ext></a:extLst></a:blip>`
  : `<a:blip r:embed="${rId}"/>`);

function imageXml(e: Extract<ElementDeDessin, { type: "image" }>, ctx: ContexteDeDessin): string {
  const { rId, svg } = ctx.image(e.media);
  const rognage = e.rognage ? `<a:srcRect l="${e.rognage[0]}" t="${e.rognage[1]}" r="${e.rognage[2]}" b="${e.rognage[3]}"/>` : "";
  return `<p:pic><p:nvPicPr><p:cNvPr id="${ctx.id()}" name="${x(nomDElement(NOMS.image, e))}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>`
    + `<p:blipFill>${blipXml(rId, svg)}${rognage}<a:stretch><a:fillRect/></a:stretch></p:blipFill>`
    + `<p:spPr>${xfrmXml(e.boite)}<a:prstGeom prst="${x(e.geometrie ?? "rect")}"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

/** Un tableau du dessin, à sa place sur la diapositive (`b`, EMU) ; grille à l'échelle `s` du groupe, textes non. */
function grilleXml(e: Extract<ElementDeDessin, { type: "tableau" }>, nom: string, b: Region, s: number, ctx: ContexteDeDessin): string {
  const tr = e.cellules.map((l, i) => `<a:tr h="${Math.round(emu(e.hauteurs[i] ?? 0) * s)}">${l.map((c) => {
    const [m0, m1, m2, m3] = c.texte.marges.map(emu);
    const [h, d, bas, g] = c.bords;
    return `<a:tc>${corpsXml(c.texte, "a:txBody")}<a:tcPr marL="${m0}" marR="${m2}" marT="${m1}" marB="${m3}" anchor="${ANCRAGES[c.texte.ancrage]}">`
      + `${traitXml(g, "a:lnL")}${traitXml(d, "a:lnR")}${traitXml(h, "a:lnT")}${traitXml(bas, "a:lnB")}${remplissage(c.fond)}</a:tcPr></a:tc>`;
  }).join("")}</a:tr>`).join("");
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${ctx.id()}" name="${x(nom)}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>`
    + `<p:xfrm><a:off x="${Math.round(b[0])}" y="${Math.round(b[1])}"/><a:ext cx="${Math.round(b[2])}" cy="${Math.round(b[3])}"/></p:xfrm>`
    + `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/>`
    + `<a:tblGrid>${e.colonnes.map((w) => `<a:gridCol w="${Math.round(emu(w) * s)}"/>`).join("")}</a:tblGrid>${tr}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

/** La place d'un cadre (points) dans une région (EMU) : à l'échelle 1 s'il y tient (les textes d'un groupe ne suivent pas son échelle), réduit sinon ; centré. */
export function placer(cadre: readonly number[], region: Region, agrandir = false): { place: Region; s: number } {
  const [cw, ch] = [emu(cadre[2]!), emu(cadre[3]!)];
  const s = Math.min(agrandir ? Infinity : 1, cw ? region[2] / cw : Infinity, ch ? region[3] / ch : Infinity);
  const e = Number.isFinite(s) ? s : 1;
  const [w, h] = [Math.round(cw * e), Math.round(ch * e)];
  return { place: [Math.round(region[0] + (region[2] - w) / 2), Math.round(region[1] + (region[3] - h) / 2), w, h], s: e };
}

/**
 * Un dessin (ou une vignette) en groupe nommé, posé à `place` (EMU) ; ses tableaux à côté, nommés « G·grille · <proprietaire> · rang k ».
 * Rend les formes à ajouter à l'arbre de la diapositive, dans l'ordre.
 */
export function groupeXml(nom: string, proprietaire: string, d: Pick<Dessin, "cadre" | "elements">, place: Region, ctx: ContexteDeDessin): string[] {
  const [ox, oy] = [emu(d.cadre[0]), emu(d.cadre[1])];
  const [cw, ch] = [emu(d.cadre[2]), emu(d.cadre[3])];
  const sx = cw ? place[2] / cw : 1;
  const sy = ch ? place[3] / ch : 1;
  const id = ctx.id();
  const enfants: string[] = [];
  const tableaux: string[] = [];
  d.elements.forEach((e, k) => {
    if (e.type === "forme") enfants.push(formeXml(e, ctx));
    else if (e.type === "image") enfants.push(imageXml(e, ctx));
    else {
      const b: Region = [place[0] + (emu(e.boite[0]) - ox) * sx, place[1] + (emu(e.boite[1]) - oy) * sy, emu(e.boite[2]) * sx, emu(e.boite[3]) * sy];
      tableaux.push(grilleXml(e, nomDElement(`${NOMS.grille} · ${proprietaire} · rang ${k}`, e), b, sx, ctx));
    }
  });
  const groupe = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="${x(nom)}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>`
    + `<p:grpSpPr><a:xfrm><a:off x="${place[0]}" y="${place[1]}"/><a:ext cx="${place[2]}" cy="${place[3]}"/><a:chOff x="${ox}" y="${oy}"/><a:chExt cx="${cw}" cy="${ch}"/></a:xfrm></p:grpSpPr>`
    + `${enfants.join("")}</p:grpSp>`;
  return [groupe, ...tableaux];
}
