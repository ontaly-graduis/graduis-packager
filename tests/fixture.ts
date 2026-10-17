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

/**
 * Un processus en trois phases (PKG-B4) : chaque colonne a son bandeau numéroté (la pastille 3 déborde sur sa voisine,
 * comme dans les decks), trois étapes numérotées dont une en tirets et une avec sa description ; une légende dessous.
 */
export async function deckDeCas(): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.defineSlideMaster({ title: "Disposition personnalisée", background: { color: "FFFFFF" }, objects: [] });
  pptx.addSlide({ masterName: "Disposition personnalisée" }).addText("Ouverture", { x: 1, y: 2, w: 8, h: 1 });
  const s = pptx.addSlide({ masterName: "Disposition personnalisée" });
  s.addText("Processus achat", { x: 0.4, y: 0.15, w: 9, h: 0.6, fontSize: 24, bold: true });
  const phases = [["Fournisseur", "6FBFE5"], ["Contrat", "2E7D32"], ["Commande", "2F6E96"]] as const;
  // L'ordre d'empilement mêle les phases : 2, 3, 1 — ce sont les numéros qui rangent.
  for (const i of [1, 2, 0]) {
    const [titre, couleur] = phases[i]!;
    const x = 0.4 + i * 3.1;
    s.addShape(pptx.ShapeType.rect, { x, y: 1.45, w: 2.8, h: 3.2, fill: { color: "F2F2F2" } });
    s.addText(titre, { shape: pptx.ShapeType.rect, x, y: 0.95, w: 2.8, h: 0.42, fill: { color: couleur }, color: "FFFFFF", fontSize: 12, bold: true, fontFace: "Calibri", valign: "middle" });
    s.addText(String(i + 1), { shape: pptx.ShapeType.ellipse, x: i === 2 ? x - 0.24 : x - 0.1, y: 1.03, w: 0.26, h: 0.26, fill: { color: "C55A5A" }, color: "FFFFFF", fontSize: 9, align: "center" });
    for (let j = 0; j < 3; j++) {
      const y = 1.65 + j * 0.95;
      const tirets = j === 1;
      s.addText(`Étape ${i + 1}.${j + 1}`, { shape: pptx.ShapeType.rect, x: x + 0.25, y, w: 2.4, h: 0.7, fill: { color: tirets ? "DEEBF7" : couleur }, line: { color: "002060", width: 1, ...(tirets ? { dashType: "dash" as const } : {}) }, color: tirets ? "002060" : "FFFFFF", fontSize: 10, fontFace: "Calibri", valign: "top" });
      s.addText(String(j + 1), { shape: pptx.ShapeType.ellipse, x: x + 0.1, y: y + 0.05, w: 0.24, h: 0.24, fill: { color: "C55A5A" }, color: "FFFFFF", fontSize: 8, align: "center" });
      if (j === 2) s.addText(`Ce que fait l'étape ${i + 1}.3`, { x: x + 0.5, y: y + 0.36, w: 2.1, h: 0.28, fontSize: 8, color: "FFFFFF", fontFace: "Calibri" });
    }
  }
  s.addShape(pptx.ShapeType.rect, { x: 0.4, y: 4.95, w: 0.4, h: 0.2, fill: { color: "2F6E96" } });
  s.addText("Tâche réalisée dans l'ERP", { x: 0.85, y: 4.9, w: 2.5, h: 0.3, fontSize: 9, color: "404040" });
  s.addText("Actions automatiques", { x: 3.6, y: 4.9, w: 2.2, h: 0.3, fontSize: 9, color: "404040", line: { color: "002060", width: 1, dashType: "dash" } });
  return new Uint8Array((await pptx.write({ outputType: "nodebuffer" })) as Buffer);
}


/**
 * Une fiche persona en couloirs (PKG-B5) : trois phases (de hauts cadres titrés à leur couleur) sur quatre couloirs (des
 * bandes nommées, chacune son icône à gauche) ; des bulles qui désignent leur pastille posée sur un couloir, leur triangle
 * de signal dessus ; une étape sans numéro, une autre d'une manière et d'un signal hors légende ; le portrait du persona et
 * la légende hors de la grille.
 */
export async function deckDeTableau(): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.defineSlideMaster({ title: "Disposition personnalisée", background: { color: "FFFFFF" }, objects: [] });
  pptx.addSlide({ masterName: "Disposition personnalisée" }).addText("Ouverture", { x: 1, y: 2, w: 8, h: 1 });
  const s = pptx.addSlide({ masterName: "Disposition personnalisée" });
  s.addText("Fiche persona acheteur", { x: 0.3, y: 0.1, w: 4.5, h: 0.5, fontSize: 24, bold: true });
  const couloirs = ["Système A", "Système B", "Système C", "Messagerie"];
  couloirs.forEach((nom, i) => {
    const y = 1.4 + i * 0.9;
    s.addText(nom, { shape: pptx.ShapeType.rect, x: 1.0, y, w: 8.7, h: 0.4, fill: { color: "BFBFBF" }, color: "002060", fontSize: 9, bold: true, valign: "middle" });
    s.addShape(pptx.ShapeType.ellipse, { x: 0.45, y: y + 0.05, w: 0.3, h: 0.3, fill: { color: "002060" } });
  });
  ["6FBFE5", "D98E04", "2E7D32"].forEach((c, j) => {
    s.addText(["Réception", "Traitement", "Validation"][j]!, { shape: pptx.ShapeType.roundRect, x: 2.0 + j * 2.6, y: 0.9, w: 2.5, h: 4.2, line: { color: c, width: 1 }, color: "002060", fontSize: 11, bold: true, valign: "top", align: "center", rectRadius: 0.05 });
  });
  // Les bulles : la pointe par défaut d'une wedgeRectCallout tombe sous son coin gauche ; la pastille y est posée.
  // `horsLegende` et `noir` : une manière et un signal que la légende ne nomme pas (l'harmonisation les y ramène).
  const natures = { auto: { fill: { color: "BFBFBF" } }, tiers: { fill: { color: "DEEBF7" }, line: { color: "A3A7AF", width: 0.75, dashType: "sysDot" as const } }, persona: { fill: { color: "E2F0D9" }, line: { color: "A3A7AF", width: 0.75 } }, horsLegende: { fill: { color: "FFFFFF" }, line: { color: "A3A7AF", width: 0.75 } } };
  const signaux = { leger: "8FBC8F", moyen: "DDA15E", fort: "E00000", noir: "000000" };
  const etapes: [number, number, number, keyof typeof natures, keyof typeof signaux, string][] = [
    [0, 2, 1, "tiers", "fort", "Demande soumise"], [0, 0, 2, "auto", "leger", "Données enrichies"],
    [1, 1, 1, "persona", "moyen", "Analyse de la fiche"], [1, 1, 2, "horsLegende", "noir", "Complétion de la fiche"],
    [2, 3, 1, "persona", "leger", "Information du demandeur"], [2, 0, 2, "auto", "moyen", "Contrôle bancaire"],
  ];
  for (const [j, i, n, nature, signal, texte] of etapes) {
    const tipX = 2.4 + j * 2.6 + (n - 1) * 1.1;
    const tipY = 1.6 + i * 0.9;
    const w = 1.0, h = 0.4;
    const cx = tipX + 0.20833 * w, cy = tipY - 0.625 * h;
    s.addText(texte, { shape: pptx.ShapeType.wedgeRectCallout, x: cx - w / 2, y: cy - h / 2, w, h, ...natures[nature], color: "002060", fontSize: 8, align: "right", valign: "middle" });
    s.addShape(pptx.ShapeType.triangle, { x: cx - w / 2 + 0.04, y: cy - 0.07, w: 0.14, h: 0.14, fill: { color: signaux[signal] } });
    s.addText(String(n), { shape: pptx.ShapeType.ellipse, x: tipX - 0.11, y: tipY - 0.11, w: 0.22, h: 0.22, fill: { color: "C55A5A" }, color: "FFFFFF", fontSize: 8, align: "center" });
  }
  s.addText("Provisions générées", { shape: pptx.ShapeType.rect, x: 7.3, y: 3.15, w: 1.2, h: 0.3, fill: { color: "BFBFBF" }, color: "002060", fontSize: 8 });
  // Hors de la grille : la légende (trois natures, trois signaux) et le portrait.
  const libelle = (texte: string, x: number, y: number) => s.addText(texte, { x, y: y - 0.04, w: 1.4, h: 0.2, fontSize: 7, color: "002060" });
  (["auto", "tiers", "persona"] as const).forEach((k, r) => {
    s.addShape(pptx.ShapeType.rect, { x: 5.2, y: 0.05 + r * 0.17, w: 0.3, h: 0.12, ...natures[k] });
    libelle({ auto: "Tâche automatique", tiers: "Tâche d'un tiers", persona: "Tâche du persona" }[k], 5.52, 0.05 + r * 0.17);
  });
  (["leger", "moyen", "fort"] as const).forEach((k, r) => {
    s.addShape(pptx.ShapeType.triangle, { x: 7.0, y: 0.05 + r * 0.17, w: 0.12, h: 0.12, fill: { color: signaux[k] } });
    libelle({ leger: "Impact léger", moyen: "Impact moyen", fort: "Impact fort" }[k], 7.14, 0.05 + r * 0.17);
  });
  s.addImage({ data: `data:image/png;base64,${png(60, 60).toString("base64")}`, x: 8.9, y: 0.05, w: 0.7, h: 0.7 });
  return new Uint8Array((await pptx.write({ outputType: "nodebuffer" })) as Buffer);
}
