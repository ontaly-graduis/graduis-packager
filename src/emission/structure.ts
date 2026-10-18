// La structure d'un texte dans le PPT de validation (PKG-C2) : une rangée sous l'autre, une colonne à côté de l'autre, un
// cadre de texte par colonne (« G·colonne r.c »), son illustration à sa gauche ; dans le cadre, un paragraphe par nœud,
// dans la grammaire des puces (`PUCES`) et des corps (`CORPS_DE_STRUCTURE`).
import type { Noeud, Structure } from "../pivot/seance-spec";
import type { Region } from "./gabarit";
import { CORPS_DE_STRUCTURE, NOMS, PUCES } from "./grammaire";
import { x } from "./xml";

const C = CORPS_DE_STRUCTURE;
const ECART = 137160;
const ILLUSTRATION = 914400;

/** Les runs d'un texte à marques de graisse : chaque segment `**…**` en gras ; les retours à la ligne en sauts, au même style. */
export function runs(texte: string, taille: number, toutGras = false, couleur = ""): string {
  const segments = texte.split(/\*\*([\s\S]+?)\*\*/);
  return segments.map((seg, i) => {
    if (!seg) return "";
    const gras = toutGras || i % 2 === 1;
    const rPr = `<a:rPr lang="fr-FR" sz="${taille}"${gras ? ' b="1"' : ""} dirty="0">${couleur}</a:rPr>`;
    return seg.split("\n").map((l, k) => (k ? `<a:br>${rPr}</a:br>` : "") + (l ? `<a:r>${rPr}<a:t>${x(l)}</a:t></a:r>` : "")).join("");
  }).join("");
}

const pPr = (marL: number, indent: number, puce: string, lvl = 0) => `<a:pPr marL="${marL}"${lvl ? ` lvl="${lvl}"` : ""} indent="${indent}">${puce}</a:pPr>`;
const car = (c: string) => `<a:buFont typeface="Arial"/><a:buChar char="${c}"/>`;
const p = (pr: string, corps: string) => `<a:p>${pr}${corps || `<a:endParaRPr lang="fr-FR" sz="${C.texte}" dirty="0"/>`}</a:p>`;

/** Les paragraphes d'un nœud. */
export function paragraphesDeNoeud(n: Noeud): string {
  const detail = (d: string) => p(pPr(628650, -228600, car(PUCES.detail), 1), runs(d, C.texte));
  switch (n.type) {
    case "titre":
      return p(pPr(0, 0, "<a:buNone/>"), runs(n.texte, C.intertitre, true, '<a:solidFill><a:schemeClr val="tx2"/></a:solidFill>'));
    case "paragraphe":
      return p(pPr(0, 0, "<a:buNone/>"), runs(n.texte, C.texte));
    case "liste":
      return n.items.map((i) => p(pPr(285750, -285750, n.numerotee ? '<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/>' : car(PUCES.item)), runs(i.texte, C.texte))
        + (i.details ?? []).map(detail).join("")).join("");
    case "definitions":
      return n.entrees.map((e) => p(pPr(285750, -285750, car(PUCES.definition)), runs(`**${e.terme}** : ${e.texte}`, C.texte))
        + (e.details ?? []).map(detail).join("")).join("");
  }
}

/** La place que prend une colonne : ses caractères rapportés à sa largeur (une estimation de ses lignes). */
function lignesEstimees(noeuds: readonly Noeud[], largeur: number): number {
  const parLigne = Math.max(12, largeur / 91440);
  const longueurs = noeuds.flatMap((n) => n.type === "titre" || n.type === "paragraphe" ? [n.texte.length + 20]
    : n.type === "liste" ? n.items.flatMap((i) => [i.texte.length, ...(i.details ?? []).map((d) => d.length)])
      : n.entrees.flatMap((e) => [e.terme.length + e.texte.length + 3, ...(e.details ?? []).map((d) => d.length)]));
  return longueurs.reduce((s, l) => s + Math.max(1, Math.ceil(l / parLigne)), 0);
}

export interface CadreDeStructure {
  readonly nom: string;
  readonly boite: Region;
  readonly paragraphes: string;
  /** L'illustration de la colonne (un hash) et sa place, à gauche du cadre. */
  readonly illustration?: { readonly media: string; readonly boite: Region };
}

/** La mise en page d'une structure dans une région : les rangées à la hauteur de leur texte, les colonnes à parts égales. */
export function disposerStructure(s: Structure, region: Region, rapport: (media: string) => number): CadreDeStructure[] {
  const [rx, ry, rw, rh] = region;
  const poids = s.rangees.map((r) => {
    const l = (rw - ECART * (r.colonnes.length - 1)) / r.colonnes.length;
    return Math.max(1.5, ...r.colonnes.map((c) => lignesEstimees(c.noeuds, l - (c.visuel ? ILLUSTRATION + ECART : 0))));
  });
  const total = poids.reduce((a, b) => a + b, 0);
  const utile = rh - ECART * (s.rangees.length - 1);
  const out: CadreDeStructure[] = [];
  let y = ry;
  s.rangees.forEach((r, i) => {
    const h = Math.round((utile * poids[i]!) / total);
    const l = (rw - ECART * (r.colonnes.length - 1)) / r.colonnes.length;
    r.colonnes.forEach((c, j) => {
      const x0 = Math.round(rx + j * (l + ECART));
      const dx = c.visuel ? ILLUSTRATION + ECART : 0;
      const illustration = c.visuel ? (() => {
        const k = rapport(c.visuel!);
        const [w, hh] = k >= ILLUSTRATION / Math.min(h, 1.4 * ILLUSTRATION) ? [ILLUSTRATION, ILLUSTRATION / k] : [Math.min(h, 1.4 * ILLUSTRATION) * k, Math.min(h, 1.4 * ILLUSTRATION)];
        // Calée contre le cadre : la lecture la reconnaît à sa gauche.
        return { media: c.visuel!, boite: [Math.round(x0 + ILLUSTRATION - w), y, Math.round(w), Math.round(hh)] as Region };
      })() : undefined;
      out.push({
        nom: `${NOMS.colonne} ${i + 1}.${j + 1}`,
        boite: [x0 + dx, y, Math.round(l - dx), h],
        paragraphes: c.noeuds.map(paragraphesDeNoeud).join(""),
        ...(illustration ? { illustration } : {}),
      });
    });
    y += h + ECART;
  });
  return out;
}

/** Un cadre de structure : une zone de texte, son corps courant déclaré (le texte saisi dans PowerPoint le prend). */
export function cadreXml(id: number, c: CadreDeStructure, xfrm: (b: Region) => string): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${x(c.nom)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr>${xfrm(c.boite)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>`
    + `<p:txBody><a:bodyPr wrap="square" lIns="45720" tIns="45720" rIns="45720" bIns="45720"><a:normAutofit/></a:bodyPr>`
    + `<a:lstStyle><a:lvl1pPr><a:spcBef><a:spcPts val="400"/></a:spcBef><a:defRPr sz="${C.texte}"/></a:lvl1pPr><a:lvl2pPr><a:defRPr sz="${C.texte}"/></a:lvl2pPr></a:lstStyle>`
    + `${c.paragraphes || `<a:p><a:endParaRPr lang="fr-FR" sz="${C.texte}" dirty="0"/></a:p>`}</p:txBody></p:sp>`;
}
