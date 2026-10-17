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
