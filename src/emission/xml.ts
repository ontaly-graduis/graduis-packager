// L'écriture XML des parties OOXML : échappement, espaces de noms, paragraphes DrawingML.

export const ENTETE = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
export const XMLNS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
export const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** Échappe un texte pour un contenu ou un attribut XML ; retire les caractères que XML 1.0 refuse. */
export function x(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    // Dans un attribut, un retour à la ligne se normaliserait en espace : on l'écrit en référence de caractère.
    .replace(/\n/g, "&#10;").replace(/\r/g, "&#13;").replace(/\t/g, "&#9;");
}

/** Un run de texte. */
export const run = (t: string, rPr = '<a:rPr lang="fr-FR" dirty="0"/>') => `<a:r>${rPr}<a:t>${x(t)}</a:t></a:r>`;

/**
 * Un paragraphe DrawingML : les « \n » d'un texte deviennent des sauts de ligne (`a:br`), si bien qu'un paragraphe porte
 * exactement un texte du pivot et se relit à l'identique.
 */
export function paragraphe(t: string, pPr = "", rPr?: string): string {
  if (t === "") return `<a:p>${pPr}<a:endParaRPr lang="fr-FR" dirty="0"/></a:p>`;
  const morceaux = t.split("\n");
  const corps = morceaux.map((m, i) => (i > 0 ? '<a:br><a:rPr lang="fr-FR" dirty="0"/></a:br>' : "") + (m ? run(m, rPr) : "")).join("");
  return `<a:p>${pPr}${corps}</a:p>`;
}

/** Les relations d'une partie. */
export function relations(rels: readonly { id: string; type: string; cible: string }[]): string {
  return `${ENTETE}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels
    .map((r) => `<Relationship Id="${r.id}" Type="${r.type.startsWith("http") ? r.type : `${REL}/${r.type}`}" Target="${x(r.cible)}"/>`)
    .join("")}</Relationships>`;
}

export const xfrm = (b: readonly [number, number, number, number]) =>
  `<a:xfrm><a:off x="${Math.round(b[0])}" y="${Math.round(b[1])}"/><a:ext cx="${Math.round(b[2])}" cy="${Math.round(b[3])}"/></a:xfrm>`;

export const ARBRE_VIDE = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
