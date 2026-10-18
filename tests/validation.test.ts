// Témoins du PPT de validation (PKG-C1) : la grammaire écrite par `emettre` se relit par `lire` sans rien perdre
// (I-PKG-3), le paquet est déterministe, une diapositive dupliquée est renumérotée, une consigne retouchée dans
// PowerPoint ne change qu'un bloc, et aucune couleur n'est en dur hors du thème (I-PKG-6). La structure des textes
// (PKG-C2), les schémas en formes natives et leur annexe de contrôle (PKG-C3).
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { describe, expect, it } from "vitest";
import { emettre } from "../src/emission/emettre";
import { disposition } from "../src/emission/grammaire";
import { lire } from "../src/lecture/lire";
import { stringify2 } from "../src/lib/json";
import { FIGURES, SeanceSpec } from "../src/pivot/seance-spec";
import { qualifierReleve } from "../src/qualification/qualifier";
import { relever } from "../src/releve/releve";
import { chargerTheme } from "../src/theme/theme";
import { paletteDesJetons } from "../src/emission/gabarit";
import { CONSIGNES, deckDEcrans, deckDeCas, deckDeSchema, deckDeTableau, deckDeTextes, deckSynthetique, png } from "./fixture";

const jetons = chargerTheme("gabarits/theme-onet").jetons;

async function valider(deck: Uint8Array, nom: string) {
  const { releve, medias } = relever(deck, nom);
  const spec = SeanceSpec.parse(qualifierReleve(releve).spec);
  const octets = emettre(spec, { jetons, media: (h) => { const m = medias.get(h); return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined; } });
  return { spec, octets };
}

/** Ce que fait PowerPoint quand on duplique une diapositive : la partie, ses relations, ses notes et ses étiquettes copiées. */
function dupliquer(octets: Uint8Array, n: number): Uint8Array {
  const p = unzipSync(octets);
  const k = Object.keys(p).filter((c) => /^ppt\/slides\/slide\d+\.xml$/.test(c)).length + 1;
  const t = (c: string) => strFromU8(p[c]!);
  p[`ppt/slides/slide${k}.xml`] = p[`ppt/slides/slide${n}.xml`]!;
  p[`ppt/tags/tag${k}.xml`] = p[`ppt/tags/tag${n}.xml`]!;
  p[`ppt/notesSlides/notesSlide${k}.xml`] = p[`ppt/notesSlides/notesSlide${n}.xml`]!;
  p[`ppt/slides/_rels/slide${k}.xml.rels`] = strToU8(t(`ppt/slides/_rels/slide${n}.xml.rels`).replace(`notesSlide${n}.xml`, `notesSlide${k}.xml`).replace(`tag${n}.xml`, `tag${k}.xml`));
  p[`ppt/notesSlides/_rels/notesSlide${k}.xml.rels`] = strToU8(t(`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`).replace(`slide${n}.xml`, `slide${k}.xml`));
  p["ppt/_rels/presentation.xml.rels"] = strToU8(t("ppt/_rels/presentation.xml.rels").replace("</Relationships>", `<Relationship Id="rIdDup" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${k}.xml"/></Relationships>`));
  // La copie se place juste après l'original.
  p["ppt/presentation.xml"] = strToU8(t("ppt/presentation.xml").replace(new RegExp(`(<p:sldId id="\\d+" r:id="rId${n + 9}"/>)`), `$1<p:sldId id="9999" r:id="rIdDup"/>`));
  p["[Content_Types].xml"] = strToU8(t("[Content_Types].xml").replace("</Types>", `<Override PartName="/ppt/slides/slide${k}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/notesSlides/notesSlide${k}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/><Override PartName="/ppt/tags/tag${k}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tags+xml"/></Types>`));
  return zipSync(p as Zippable);
}

describe("le PPT de validation (PKG-C1)", () => {
  it("se relit à l'identique : lire(émettre(pivot₀)) ≡ pivot₀, sur les six decks synthétiques", async () => {
    for (const [nom, deck] of [["synthetique", deckSynthetique], ["schema", deckDeSchema], ["cas", deckDeCas], ["tableau", deckDeTableau], ["ecrans", deckDEcrans], ["textes", deckDeTextes]] as const) {
      const { spec, octets } = await valider(await deck(), `${nom}.pptx`);
      const { spec: relu, ecarts } = lire(octets);
      expect(ecarts, nom).toEqual([]);
      expect(stringify2(relu), nom).toBe(stringify2(spec));
    }
  });

  it("est déterministe : même pivot, mêmes octets", async () => {
    // Un seul deck : pptxgenjs date ce qu'il écrit, deux decks fabriqués à une seconde d'écart ne sont pas la même source.
    const deck = await deckSynthetique();
    const a = await valider(deck, "s.pptx");
    const b = await valider(deck, "s.pptx");
    expect(Buffer.from(a.octets).equals(Buffer.from(b.octets))).toBe(true);
  });

  it("porte la grammaire : une disposition par figure, les pas en pastilles, zones et consignes, l'identité en étiquettes", async () => {
    const { octets } = await valider(await deckSynthetique(), "s.pptx");
    const p = unzipSync(octets);
    const dispositions = Object.keys(p).filter((c) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(c)).map((c) => strFromU8(p[c]!).match(/<p:cSld name="([^"]+)"/)?.[1]);
    expect(dispositions.sort()).toEqual(FIGURES.map(disposition).sort());
    const pas = strFromU8(p["ppt/slides/slide2.xml"]!);
    expect(pas.match(/name="G·pastille"/g)).toHaveLength(2);
    expect(pas).toContain('name="G·capture"');
    expect(pas).toContain(CONSIGNES[0]);
    expect(strFromU8(p["ppt/tags/tag2.xml"]!)).toContain('name="GRADUIS.BLOC" val="b002"');
    expect(strFromU8(p["docProps/custom.xml"]!)).toContain("graduis.source.empreinte");
  });

  it("porte les visuels d'origine : le rôle dans le nom, la légende en texte de remplacement, l'aplat en couleur du thème, le SVG en SVG", async () => {
    const p = unzipSync((await valider(await deckDEcrans(), "e.pptx")).octets);
    const ecran = strFromU8(p["ppt/slides/slide2.xml"]!);
    expect(ecran).toContain('name="G·visuel · pictogramme"');
    expect(ecran).toContain('name="G·visuel · durée"');
    expect(ecran).toMatch(/<asvg:svgBlip [^>]*r:embed="rId\d+"\/>/);
    expect(ecran).toContain('<a:solidFill><a:schemeClr val="bg1"/></a:solidFill></p:spPr></p:pic>');
    expect(strFromU8(p["ppt/slides/slide3.xml"]!)).toContain('descr="Grand soleil"');
    expect(strFromU8(p["ppt/slides/slide4.xml"]!)).toContain('<a:solidFill><a:schemeClr val="accent5"/></a:solidFill>');
    expect(Object.keys(p).some((c) => c.startsWith("ppt/media/") && c.endsWith(".svg"))).toBe(true);
  });

  it("ne cite que les couleurs du thème : aucune valeur hors de theme1 et theme2 (I-PKG-6)", async () => {
    for (const deck of [deckSynthetique, deckDeSchema, deckDeTableau, deckDEcrans]) {
      const p = unzipSync((await valider(await deck(), "d.pptx")).octets);
      const fautifs = Object.keys(p).filter((c) => c.endsWith(".xml") && !c.startsWith("ppt/theme/") && /srgbClr|sysClr/.test(strFromU8(p[c]!)));
      expect(fautifs).toEqual([]);
    }
  });

  it("renumérote une diapositive dupliquée : pas de collision d'identifiant, l'écart est dit", async () => {
    const { spec, octets } = await valider(await deckSynthetique(), "s.pptx");
    const { spec: relu, ecarts } = lire(dupliquer(octets, 2));
    const ids = relu.sequences.flatMap((s) => s.blocs.map((b) => b.id));
    expect(new Set(ids).size).toBe(ids.length);
    const n = spec.sequences.flatMap((s) => s.blocs).length;
    expect(ids).toHaveLength(n + 1);
    expect(ids[2]).toBe(`b${String(n + 1).padStart(3, "0")}`);
    expect(relu.sequences.flatMap((s) => s.blocs)[2]!.source.diapo).toBe(2);
    expect(ecarts.map((e) => e.message)).toEqual([`identifiant b002 dupliqué : renuméroté b${String(n + 1).padStart(3, "0")}`]);
  });

  it("une consigne retouchée dans PowerPoint ne change qu'un bloc, et que sa consigne", async () => {
    const { spec, octets } = await valider(await deckSynthetique(), "s.pptx");
    const p = unzipSync(octets);
    p["ppt/slides/slide2.xml"] = strToU8(strFromU8(p["ppt/slides/slide2.xml"]!).replace(CONSIGNES[1], "Sélectionner la DA à traiter"));
    const { spec: relu } = lire(zipSync(p as Zippable));
    const avant = spec.sequences.flatMap((s) => s.blocs);
    const apres = relu.sequences.flatMap((s) => s.blocs);
    const changes = avant.filter((b, i) => stringify2(b) !== stringify2(apres[i]));
    expect(changes.map((b) => b.id)).toEqual(["b002"]);
    expect(apres[1]!.pas.map((x) => x.consigne)).toEqual([CONSIGNES[0], "Sélectionner la DA à traiter"]);
    expect({ ...apres[1], pas: [] }).toEqual({ ...avant[1], pas: [] });
  });
});

/** Une zone de texte ajoutée dans PowerPoint, hors grammaire. */
const zoneDeTexte = (texte: string, y = 6000000) => `<p:sp><p:nvSpPr><p:cNvPr id="990" name="ZoneTexte 989"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="${y}"/><a:ext cx="5000000" cy="400000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="1400" dirty="0"/><a:t>${texte}</a:t></a:r></a:p></p:txBody></p:sp>`;
const ajouter = (p: Record<string, Uint8Array>, n: number, xml: string) => {
  p[`ppt/slides/slide${n}.xml`] = strToU8(strFromU8(p[`ppt/slides/slide${n}.xml`]!).replace("</p:spTree>", `${xml}</p:spTree>`));
};

describe("la structure des textes en grammaire, et l'ingestion complémentaire (PKG-C2)", () => {
  it("écrit la structure en paragraphes : une colonne par cadre, les intertitres, puces, numéros, définitions et détails", async () => {
    const p = unzipSync((await valider(await deckDeTextes(), "t.pptx")).octets);
    const x = strFromU8(p["ppt/slides/slide2.xml"]!);
    for (const nom of ["G·colonne 1.1", "G·colonne 2.1", "G·colonne 2.2"]) expect(x).toContain(`name="${nom}"`);
    expect(x).toContain('<a:buChar char="▸"/>');
    expect(x).toContain('<a:buChar char="•"/>');
    expect(x).toMatch(/lvl="1" indent="-228600"><a:buFont typeface="Arial"\/><a:buChar char="–"\/>/);
    expect(x).toContain('<a:buAutoNum type="arabicPeriod"/>');
    expect(x).toMatch(/<a:rPr lang="fr-FR" sz="1800" b="1" dirty="0"><a:solidFill><a:schemeClr val="tx2"\/><\/a:solidFill><\/a:rPr><a:t>Jour 1<\/a:t>/);
    expect(strFromU8(p["ppt/tags/tag2.xml"]!)).not.toContain("GRADUIS.LECTURES");
  });

  it("une retouche dans une fiche ne change que son bloc, sa structure et son inventaire dérivé", async () => {
    const { spec, octets } = await valider(await deckDeTextes(), "t.pptx");
    const p = unzipSync(octets);
    p["ppt/slides/slide2.xml"] = strToU8(strFromU8(p["ppt/slides/slide2.xml"]!).replace("Accueil et tour de table", "Accueil des participants"));
    const { spec: relu, ecarts } = lire(zipSync(p as Zippable));
    expect(ecarts).toEqual([]);
    const [avant, apres] = [spec, relu].map((x) => x.sequences.flatMap((q) => q.blocs)[1]!);
    const liste = apres!.structure!.rangees[1]!.colonnes[0]!.noeuds[1]!;
    expect(liste.type === "liste" && liste.items[0]!.texte).toBe("Accueil des participants");
    expect(apres!.textes[1]).toBe(avant!.textes[1]!.replace("Accueil et tour de table", "Accueil des participants"));
    expect(stringify2(relu.sequences.flatMap((q) => q.blocs)[0])).toBe(stringify2(spec.sequences.flatMap((q) => q.blocs)[0]));
  });

  it("lit une zone de texte ajoutée à un texte organisé : une rangée de plus, par l'heuristique de l'ingestion initiale, signalée", async () => {
    const { octets } = await valider(await deckDeTextes(), "t.pptx");
    const p = unzipSync(octets);
    ajouter(p, 2, zoneDeTexte("Prévoir un badge visiteur"));
    const { spec, ecarts } = lire(zipSync(p as Zippable));
    const b = spec.sequences.flatMap((q) => q.blocs)[1]!;
    expect(b.structure!.rangees).toHaveLength(3);
    expect(b.structure!.rangees[2]!.colonnes[0]!.noeuds).toEqual([{ type: "paragraphe", texte: "Prévoir un badge visiteur" }]);
    expect(b.textes.at(-1)).toBe("Prévoir un badge visiteur");
    expect(ecarts.map((e) => [e.diapo, e.message.split(",")[0]])).toEqual([[2, "1 cadre(s) de texte hors grammaire"]]);
  });

  it("lit une zone de texte ajoutée ailleurs comme un texte de plus, et une image ajoutée comme un visuel, signalés", async () => {
    const { spec: avant, octets } = await valider(await deckSynthetique(), "s.pptx");
    const p = unzipSync(octets);
    ajouter(p, 2, zoneDeTexte("Attention aux doublons"));
    p["ppt/media/ajout.png"] = new Uint8Array(png(40, 40));
    p["ppt/slides/_rels/slide2.xml.rels"] = strToU8(strFromU8(p["ppt/slides/_rels/slide2.xml.rels"]!).replace("</Relationships>", '<Relationship Id="rIdAjout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/ajout.png"/></Relationships>'));
    ajouter(p, 2, '<p:pic><p:nvPicPr><p:cNvPr id="991" name="Image 990" descr="Une image contenant un cercle"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rIdAjout"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="100000" y="100000"/><a:ext cx="300000" cy="300000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>');
    const { spec, ecarts } = lire(zipSync(p as Zippable));
    const [a, b] = [avant, spec].map((x) => x.sequences.flatMap((q) => q.blocs)[1]!);
    expect(b!.textes).toEqual([...a!.textes, "Attention aux doublons"]);
    expect(b!.visuels).toHaveLength(a!.visuels.length + 1);
    expect(b!.visuels.at(-1)).toEqual({ media: expect.stringMatching(/^sha256:/), capture: false });
    expect(b!.pas).toEqual(a!.pas);
    expect(ecarts.map((e) => e.message.split(" (")[0])).toEqual(["image ajoutée hors grammaire", "1 cadre(s) de texte hors grammaire, ajouté(s) aux textes : « Attention aux doublons »"]);
  });

  it("lit une diapositive venue d'un autre deck (disposition hors grammaire) par l'ingestion initiale, et le dit", async () => {
    const { octets } = await valider(await deckDeTextes(), "t.pptx");
    const p = unzipSync(octets);
    const t = (c: string) => strFromU8(p[c]!);
    p["ppt/slideLayouts/slideLayout99.xml"] = strToU8(t("ppt/slideLayouts/slideLayout5.xml").replace(/<p:cSld name="[^"]+">/, '<p:cSld name="1_Vide">'));
    p["ppt/slideLayouts/_rels/slideLayout99.xml.rels"] = p["ppt/slideLayouts/_rels/slideLayout5.xml.rels"]!;
    p["ppt/slides/_rels/slide2.xml.rels"] = strToU8(t("ppt/slides/_rels/slide2.xml.rels").replace(/slideLayout\d+\.xml/, "slideLayout99.xml"));
    p["[Content_Types].xml"] = strToU8(t("[Content_Types].xml").replace("</Types>", '<Override PartName="/ppt/slideLayouts/slideLayout99.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/></Types>'));
    const { spec, ecarts } = lire(zipSync(p as Zippable));
    const b = spec.sequences.flatMap((q) => q.blocs)[1]!;
    expect(b.id).toBe("b002");
    expect(b.figure).toBe("contenu");
    expect(b.textes.join(" ")).toContain("Prise en main d'Oracle Fusion");
    expect(ecarts).toEqual([{ diapo: 2, message: "disposition hors grammaire (« 1_Vide ») : lue par l'ingestion initiale, en contenu" }]);
  });
});


/** La boîte (EMU) de la première forme d'un nom donné. */
function boiteDe(xml: string, nom: string): [number, number, number, number] {
  const m = xml.match(new RegExp(`name="${nom}"/>.*?<a:off x="(-?\\d+)" y="(-?\\d+)"/><a:ext cx="(\\d+)" cy="(\\d+)"`, "s"));
  if (!m) throw new Error(`forme absente : ${nom}`);
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
}

describe("les schémas en formes natives (PKG-C3)", () => {
  it("écrit le dessin en groupe : repère enfant au point près, dévoilement dans les noms, plus d'étiquette de lectures", async () => {
    const { spec, octets } = await valider(await deckDeSchema(), "d.pptx");
    const p = unzipSync(octets);
    const x = strFromU8(p["ppt/slides/slide2.xml"]!);
    const b = spec.sequences.flatMap((q) => q.blocs)[1]!;
    expect(x).toContain(`name="G·schéma · étapes · ${b.dessin!.partition!.pas} pas"`);
    expect(x).toContain(`<a:chOff x="${Math.round(b.dessin!.cadre[0] * 12700)}" y="${Math.round(b.dessin!.cadre[1] * 12700)}"/>`);
    expect(x).toMatch(/name="G·forme · pas 1 · ordre 0 · pastille"/);
    expect(strFromU8(p["ppt/tags/tag2.xml"]!)).not.toContain("GRADUIS.LECTURES");
    // Les textes du schéma se dérivent de son dessin : pas d'espace de contenu à côté.
    expect(x).not.toContain('<p:ph type="body" idx="1"/>');
  });

  it("recompose en formes éditables, le dessin d'origine en annexe masquée « Pour contrôle uniquement », qui n'est pas un bloc", async () => {
    const { spec, octets } = await valider(await deckDeCas(), "c.pptx");
    const p = unzipSync(octets);
    const x = strFromU8(p["ppt/slides/slide2.xml"]!);
    for (const nom of ["G·cas 1", "G·cas 3", "G·étape 3", "G·légende 2 · case"]) expect(x).toContain(`name="${nom}"`);
    expect(x).not.toContain("G·schéma");
    const annexe = strFromU8(p["ppt/slides/slide3.xml"]!);
    expect(annexe).toContain('show="0"');
    expect(annexe).toContain("Pour contrôle uniquement");
    expect(annexe).toContain('name="G·schéma · colonnes · 3 pas"');
    expect(strFromU8(p["ppt/tags/tag3.xml"]!)).toContain('name="GRADUIS.ANNEXE" val="b002"');
    expect(strFromU8(p["docProps/app.xml"]!)).toContain("<Slides>3</Slides>");
    const { spec: relu, ecarts } = lire(octets);
    expect(ecarts).toEqual([]);
    expect(relu.sequences.flatMap((q) => q.blocs).map((b) => b.id)).toEqual(spec.sequences.flatMap((q) => q.blocs).map((b) => b.id));
  });

  it("relit une composition retouchée : une étape réécrite, une autre déplacée d'une case (avec son signal), une autre recolorée", async () => {
    const { spec, octets } = await valider(await deckDeTableau(), "t.pptx");
    const p = unzipSync(octets);
    let x = strFromU8(p["ppt/slides/slide2.xml"]!);
    x = x.replace(">Demande soumise<", ">Demande déposée<");
    // Déplacer le groupe « Analyse de la fiche » (et son triangle) dans la case Messagerie × Validation.
    const [px] = boiteDe(x, "G·phase 3");
    const [, cy] = boiteDe(x, "G·couloir 4");
    x = x.replace(/(<p:grpSp><p:nvGrpSpPr><p:cNvPr id="\d+" name="G·étape 1"\/>(?:(?!<\/p:grpSp>).)*?<a:off )x="\d+" y="\d+"((?:(?!<\/p:grpSp>).)*Analyse de la fiche)/s, `$1x="${px + 60000}" y="${cy + 60000}"$2`);
    // Recolorer la carte « Complétion de la fiche » d'une couleur choisie dans PowerPoint (hors grammaire).
    const ambre = paletteDesJetons(jetons).ambre;
    const morceaux = x.split("<p:sp>");
    const k = morceaux.findIndex((m) => m.includes("Complétion de la fiche"));
    morceaux[k] = morceaux[k]!.replace(/<a:solidFill>.*?<\/a:solidFill>/s, `<a:solidFill><a:srgbClr val="${ambre}"/></a:solidFill>`);
    p["ppt/slides/slide2.xml"] = strToU8(morceaux.join("<p:sp>"));
    const { spec: relu, ecarts } = lire(zipSync(p as Zippable));
    expect(ecarts).toEqual([]);
    const [avant, apres] = [spec, relu].map((s) => s.sequences.flatMap((q) => q.blocs)[1]!);
    if (avant!.composition?.gabarit !== "tableau" || apres!.composition?.gabarit !== "tableau") throw new Error("tableau attendu");
    const attendues = avant!.composition.etapes.map((e, i) =>
      i === 0 ? { ...e, texte: "Demande déposée" } : i === 2 ? { ...e, ligne: 3, colonne: 2 } : i === 3 ? { ...e, fond: "ambre-fort" } : e);
    expect(apres!.composition.etapes).toEqual(attendues);
    expect(apres!.textes).toContain("Demande déposée");
    expect(apres!.dessin).toEqual(avant!.dessin);
    expect(stringify2(relu.sequences.flatMap((q) => q.blocs)[0])).toBe(stringify2(spec.sequences.flatMap((q) => q.blocs)[0]));
  });

  it("reprend dans le dessin ce qu'ONET y ajoute, dans son repère, et le dit", async () => {
    const { spec, octets } = await valider(await deckDeSchema(), "d.pptx");
    const p = unzipSync(octets);
    ajouter(p, 2, zoneDeTexte("Note du formateur"));
    const { spec: relu, ecarts } = lire(zipSync(p as Zippable));
    const [avant, apres] = [spec, relu].map((s) => s.sequences.flatMap((q) => q.blocs)[1]!);
    expect(apres!.dessin!.elements).toHaveLength(avant!.dessin!.elements.length + 1);
    const ajout = apres!.dessin!.elements.at(-1)!;
    expect(ajout.type === "forme" && ajout.texte?.paragraphes[0]!.fragments[0]!.texte).toBe("Note du formateur");
    expect(ajout.boite[2]).toBeCloseTo(5000000 / 12700, 1);
    expect(apres!.textes).toContain("Note du formateur");
    expect(ecarts.map((e) => e.message.split(" (")[0])).toEqual(["1 forme(s) ajoutée(s) sur le schéma : reprise(s) dans son dessin"]);
  });

  it("dit qu'il manque le dessin d'origine quand l'annexe a été supprimée, et garde la composition", async () => {
    const { spec, octets } = await valider(await deckDeCas(), "c.pptx");
    const p = unzipSync(octets);
    p["ppt/presentation.xml"] = strToU8(strFromU8(p["ppt/presentation.xml"]!).replace('<p:sldId id="258" r:id="rId12"/>', ""));
    const { spec: relu, ecarts } = lire(zipSync(p as Zippable));
    const [avant, apres] = [spec, relu].map((s) => s.sequences.flatMap((q) => q.blocs)[1]!);
    expect(apres!.dessin).toBeUndefined();
    expect(apres!.composition).toEqual(avant!.composition);
    expect(ecarts).toEqual([{ diapo: 2, message: "schéma recomposé sans sa diapositive annexe : le dessin d'origine manque" }]);
  });
});
