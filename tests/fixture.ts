// Deck synthétique pour les témoins du dépôt (aucune donnée client) : une transition, un pas-à-pas, une diapositive inachevée.
import PptxGenJS from "pptxgenjs";
import { crc32, deflateSync } from "node:zlib";

/** Un PNG valide de `l` × `h` pixels (blanc), pour que le relevé en lise les dimensions. */
export function png(l: number, h: number): Buffer {
  const morceau = (type: string, donnees: Buffer) => {
    const t = Buffer.from(type, "ascii");
    const lg = Buffer.alloc(4);
    lg.writeUInt32BE(donnees.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc32(Buffer.concat([t, donnees])));
    return Buffer.concat([lg, t, donnees, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(l, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 0, 0, 0, 0], 8);
  const lignes = Buffer.alloc((l + 1) * h, 0xff);
  for (let y = 0; y < h; y++) lignes[y * (l + 1)] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau("IHDR", ihdr), morceau("IDAT", deflateSync(lignes)), morceau("IEND", Buffer.alloc(0)),
  ]);
}

export const CONSIGNES = ["Cliquer sur le menu Gestion des achats", "Sélectionner la demande à traiter"] as const;

export async function deckSynthetique(): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.defineSlideMaster({ title: "Slide transition", background: { color: "FFFFFF" }, objects: [] });
  pptx.defineSlideMaster({ title: "Disposition personnalisée", background: { color: "FFFFFF" }, objects: [] });

  pptx.addSlide({ masterName: "Slide transition" }).addText("Séquence d'essai", { x: 1, y: 2, w: 8, h: 1 });

  const s = pptx.addSlide({ masterName: "Disposition personnalisée" });
  s.addImage({ data: "image/png;base64," + png(1600, 800).toString("base64"), x: 0.5, y: 1, w: 6, h: 3 });
  const pastille = (n: string, x: number, y: number) =>
    s.addText(n, { shape: pptx.ShapeType.ellipse, x, y, w: 0.3, h: 0.3, fill: { color: "F28E00" }, align: "center", fontSize: 10 });
  // Une zone est un cadre vide sans remplissage : `addShape` omet `<a:noFill/>`, `addText("")` l'écrit.
  const zone = (x: number, y: number) =>
    s.addText("", { shape: pptx.ShapeType.rect, x, y, w: 1.5, h: 0.4, line: { color: "F28E00", width: 2 } });
  pastille("1", 1.2, 1.6);
  zone(1.6, 1.55);
  pastille("2", 2.6, 3.0);
  zone(3.0, 2.95);
  pastille("1", 7.0, 1.6);
  s.addText(CONSIGNES[0], { x: 7.4, y: 1.5, w: 2.4, h: 0.5, fontSize: 12 });
  pastille("2", 7.0, 2.6);
  s.addText(CONSIGNES[1], { x: 7.4, y: 2.5, w: 2.4, h: 0.5, fontSize: 12 });
  s.addNotes("Durée : 10 min");

  pptx.addSlide({ masterName: "Disposition personnalisée" }).addText("Cas pratique : A rédiger", { x: 1, y: 1, w: 8, h: 1 });

  return new Uint8Array((await pptx.write({ outputType: "nodebuffer" })) as Buffer);
}

/**
 * Un schéma synthétique (deuxième diapositive) : six étapes en boîtes pleines, une décision, des connecteurs fléchés
 * (dont un en tirets), des pastilles et des étiquettes — couleurs directes, couleur du thème et opacité.
 */
export async function deckDeSchema(): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.defineSlideMaster({ title: "Disposition personnalisée", background: { color: "FFFFFF" }, objects: [] });
  pptx.addSlide({ masterName: "Disposition personnalisée" }).addText("Ouverture", { x: 1, y: 2, w: 8, h: 1 });
  const s = pptx.addSlide({ masterName: "Disposition personnalisée" });
  s.addText("Circuit de validation", { x: 0.4, y: 0.2, w: 9, h: 0.6, fontSize: 24, bold: true });
  const couleurs = ["2E75B6", "00B3C3", "A5C715", "F28E00", "C00418", "002060"];
  couleurs.forEach((c, i) => {
    const x = 0.4 + i * 1.6;
    s.addText(`Étape ${i + 1}`, { shape: pptx.ShapeType.roundRect, x, y: 1.5, w: 1.2, h: 0.7, fill: { color: c }, color: "FFFFFF", fontSize: 10, fontFace: "Calibri", align: "center", valign: "middle", rectRadius: 0.1 });
    s.addText(String(i + 1), { shape: pptx.ShapeType.ellipse, x: x - 0.12, y: 1.38, w: 0.26, h: 0.26, fill: { color: "FFFFFF" }, line: { color: "002060", width: 0.75 }, color: "002060", fontSize: 8, align: "center" });
    s.addText(`Détail ${i + 1}`, { x, y: 2.3, w: 1.2, h: 0.4, fontSize: 8, color: "404040", fontFace: "Calibri", align: "center" });
    if (i < couleurs.length - 1) s.addShape(pptx.ShapeType.line, { x: x + 1.2, y: 1.85, w: 0.4, h: 0, line: { color: "A3A7AF", width: 1, endArrowType: "triangle", ...(i === 2 ? { dashType: "dash" as const } : {}) } });
  });
  s.addText("Montant > seuil ?", { shape: pptx.ShapeType.diamond, x: 3.6, y: 3.1, w: 1.8, h: 1.1, fill: { color: pptx.SchemeColor.accent1, transparency: 50 }, color: "002060", fontSize: 9, align: "center", valign: "middle" });
  s.addShape(pptx.ShapeType.rect, { x: 0.3, y: 1.2, w: 9.4, h: 1.7, fill: { color: "DCF4CE" }, line: { color: "A3A7AF", width: 0.5, dashType: "sysDot" } });
  return new Uint8Array((await pptx.write({ outputType: "nodebuffer" })) as Buffer);
}
