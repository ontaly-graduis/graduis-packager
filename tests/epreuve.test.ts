// Témoins du corpus d'épreuve (GEN-0) : profil neutre, lectures étendues, gabarits, vérité de terrain, tableau, déterminisme ;
// sur un deck synthétique (aucune donnée client), puis sur le corpus réel quand il est là (hors dépôt).
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import PptxGenJS from "pptxgenjs";
import { beforeAll, describe, expect, it } from "vitest";
import { sha256, stringify2 } from "../src/lib/json";
import { chargerProfil, empreinteDuProfil } from "../src/profil/profil";
import { relever } from "../src/releve/releve";
import { qualifierReleve } from "../src/qualification/qualifier";
import { SIGNAL_POSITION, SIGNAL_REPLI, type Qualification } from "../src/qualification/figures";
import { lireEtendu, type Lectures } from "../src/corpus/lectures";
import { chargerCorpus, figureDeVerite, lireVerite, tableurDeVerite } from "../src/corpus/corpus";
import { mesurerCorpus, veritesAPreparer } from "../src/corpus/mesure";
import { tableauDuCorpus, tableauEnMarkdown, type MesureDeDeck } from "../src/corpus/tableau";
import { servirRevue } from "../src/corpus/revue";
import type { AddressInfo } from "node:net";

const NEUTRE = chargerProfil("gabarits/profil-neutre.json");

/** Une animation d'entrée au clic sur la forme `spid`. */
const entree = (id: number, spid: number) =>
  `<p:par><p:cTn id="${id}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${id + 1}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>`
  + `<p:par><p:cTn id="${id + 2}" presetID="1" presetClass="entr" presetSubtype="0" fill="hold" nodeType="clickEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>`
  + `<p:set><p:cBhvr><p:cTn id="${id + 3}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`
  + `</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`;
const timing = (spids: readonly number[]) =>
  `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>`
  + spids.map((s, i) => entree(10 + 10 * i, s)).join("") + `</p:childTnLst></p:cTn></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;

const DGM = "http://schemas.openxmlformats.org/drawingml/2006/diagram";
const point = (id: string, texte: string) => `<dgm:pt modelId="${id}"><dgm:t><a:bodyPr/><a:p><a:r><a:t>${texte}</a:t></a:r></a:p></dgm:t></dgm:pt>`;
const DONNEES_SMARTART = `<dgm:dataModel xmlns:dgm="${DGM}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><dgm:ptLst>`
  + `<dgm:pt modelId="0" type="doc"><dgm:t><a:bodyPr/><a:p/></dgm:t></dgm:pt>${point("1", "Analyser")}${point("2", "Concevoir")}${point("3", "Prototyper")}`
  + `<dgm:pt modelId="9" type="parTrans"/></dgm:ptLst><dgm:cxnLst><dgm:cxn modelId="10" srcId="0" destId="1"/><dgm:cxn modelId="11" srcId="0" destId="2"/>`
  + `<dgm:cxn modelId="12" srcId="2" destId="3"/><dgm:cxn modelId="13" type="presOf" srcId="1" destId="9"/></dgm:cxnLst></dgm:dataModel>`;
const CADRE_SMARTART = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="90" name="SmartArt"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>`
  + `<p:xfrm><a:off x="914400" y="914400"/><a:ext cx="4572000" cy="2286000"/></p:xfrm><a:graphic><a:graphicData uri="${DGM}">`
  + `<dgm:relIds xmlns:dgm="${DGM}" r:dm="rIdDm" r:lo="rIdLo" r:qs="" r:cs=""/></a:graphicData></a:graphic></p:graphicFrame>`;

/** Un deck de cinq diapositives : couverture ; graphique natif et SmartArt ; dévoilement selon la lecture ; question ; réponse. */
async function deckEtendu(masque = "Disposition d'essai", inverse = false): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.defineSlideMaster({ title: masque, background: { color: "FFFFFF" }, objects: [] });
  pptx.addSlide({ masterName: masque }).addText("Séance d'essai", { x: 1, y: 2, w: 8, h: 1 });
  pptx.addSlide({ masterName: masque }).addChart(pptx.ChartType.bar, [
    { name: "Avant", labels: ["Lundi", "Mardi", "Mercredi"], values: [1, 2, 3] },
    { name: "Après", labels: ["Lundi", "Mardi", "Mercredi"], values: [3, 2, 1] },
  ], { x: 5, y: 1, w: 4, h: 3 });
  const d = pptx.addSlide({ masterName: masque });
  d.addText("Premier temps de la démarche", { x: 1, y: 1, w: 6, h: 1, objectName: "Haut" });
  d.addText("Second temps de la démarche", { x: 1, y: 3, w: 6, h: 1, objectName: "Bas" });
  pptx.addSlide({ masterName: masque }).addText("Le tri des déchets est-il obligatoire au bureau ?", { x: 1, y: 1, w: 8, h: 1 });
  const r = pptx.addSlide({ masterName: masque });
  r.addText("Le tri des déchets est-il obligatoire au bureau ?", { x: 1, y: 1, w: 8, h: 1 });
  r.addText("Oui : depuis 2016, pour cinq flux.", { x: 1, y: 2.5, w: 8, h: 1 });
  const z = unzipSync(new Uint8Array((await pptx.write({ outputType: "nodebuffer" })) as Buffer));
  const s2 = "ppt/slides/slide2.xml", s3 = "ppt/slides/slide3.xml";
  z[s2] = strToU8(strFromU8(z[s2]!).replace("</p:spTree>", CADRE_SMARTART + "</p:spTree>"));
  const r2 = "ppt/slides/_rels/slide2.xml.rels";
  z[r2] = strToU8(strFromU8(z[r2]!).replace("</Relationships>",
    `<Relationship Id="rIdDm" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData" Target="../diagrams/data1.xml"/>`
    + `<Relationship Id="rIdLo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramLayout" Target="../diagrams/layout1.xml"/></Relationships>`));
  z["ppt/diagrams/data1.xml"] = strToU8(DONNEES_SMARTART);
  z["ppt/diagrams/layout1.xml"] = strToU8(`<dgm:layoutDef xmlns:dgm="${DGM}" uniqueId="urn:microsoft.com/office/officeart/2005/8/layout/hProcess9"/>`);
  const x3 = strFromU8(z[s3]!);
  const id = (nom: string) => Number(x3.match(new RegExp(`<p:cNvPr id="(\\d+)" name="${nom}"`))![1]);
  const ordre = inverse ? [id("Bas"), id("Haut")] : [id("Haut"), id("Bas")];
  z[s3] = strToU8(x3.replace("</p:sld>", timing(ordre) + "</p:sld>"));
  return zipSync(z);
}

describe("le profil neutre (GEN-0)", () => {
  it("ne porte ni disposition ni marqueur, et reprend la projection des couleurs d'ONET comme défaut", () => {
    expect(NEUTRE.dispositions).toEqual([]);
    expect(NEUTRE.inacheve).toEqual([]);
    expect(NEUTRE.processus).toBeUndefined();
    expect(NEUTRE.pratique).toBeUndefined();
    expect(NEUTRE.projection).toEqual(chargerProfil("gabarits/profil-onet.json").projection);
  });
});

describe("les lectures étendues (graduis/lectures@0)", () => {
  let octets: Uint8Array;
  let l: Lectures;
  beforeAll(async () => {
    octets = await deckEtendu();
    l = lireEtendu(octets, relever(octets, "etendu.pptx").releve);
  });

  it("lit le graphique natif : type, séries, catégories, valeurs présentes", () => {
    expect(l.diapositives.find((d) => d.n === 2)?.graphiques).toEqual([{ type: "bar", series: 2, categories: 3, donnees: true }]);
  });

  it("lit le SmartArt : sa disposition, ses nœuds porteurs de texte, sa profondeur", () => {
    expect(l.diapositives.find((d) => d.n === 2)?.smartart).toEqual([{ disposition: "hProcess9", noeuds: 3, profondeur: 2 }]);
  });

  it("lit l'ordre des animations : deux clics, deux temps de dévoilement, selon la lecture ou non", async () => {
    expect(l.diapositives.find((d) => d.n === 3)?.animation).toEqual({ clics: 2, effets: 2, devoilement: 2, selonLaLecture: true });
    const inverse = await deckEtendu(undefined, true);
    const li = lireEtendu(inverse, relever(inverse, "inverse.pptx").releve);
    expect(li.diapositives.find((d) => d.n === 3)?.animation?.selonLaLecture).toBe(false);
  });

  it("trouve la paire question → réponse, et rien d'autre", () => {
    expect(l.paires).toEqual([{ question: 4, reponse: 5, interrogative: true }]);
  });

  it("ne touche pas au relevé : son empreinte ne dépend pas des lectures", () => {
    const a = stringify2(relever(octets, "etendu.pptx").releve);
    lireEtendu(octets, relever(octets, "etendu.pptx").releve);
    expect(stringify2(relever(octets, "etendu.pptx").releve)).toBe(a);
  });

  it("donne l'empreinte du gabarit : la même pour le même masque, une autre pour un autre", async () => {
    const autre = await deckEtendu("Autre disposition");
    const la = lireEtendu(autre, relever(autre, "autre.pptx").releve);
    expect(lireEtendu(octets, relever(octets, "bis.pptx").releve).gabarit).toEqual(l.gabarit);
    expect(la.gabarit.empreinte).not.toBe(l.gabarit.empreinte);
    expect(la.gabarit.dispositions).toContain("Autre disposition");
  });
});

describe("la vérité de terrain", () => {
  it("se prépare depuis les règles et se relit telle quelle", async () => {
    const o = await deckEtendu();
    const q = qualifierReleve(relever(o, "etendu.pptx").releve, NEUTRE);
    const dossier = mkdtempSync(join(tmpdir(), "verite-"));
    writeFileSync(join(dossier, "v.csv"), tableurDeVerite(q.spec, q.qualifications));
    expect(lireVerite(join(dossier, "v.csv"), 5)).toEqual(new Map([...q.qualifications].map(([n, x]) => [n, x.figure])));
  });

  it("accepte libellés, candidates et « autre », au point-virgule comme à la virgule", () => {
    const dossier = mkdtempSync(join(tmpdir(), "verite-"));
    writeFileSync(join(dossier, "pv.csv"), '﻿diapo;titre;regles;signal;verite;note\n1;"Titre; avec point-virgule";couverture;"x";Couverture;""\n2;"";capture;"";autre :  Photo  d\'illustration;""\n3;"";contenu;"";Pas-à-pas;""\n');
    expect([...lireVerite(join(dossier, "pv.csv"), 3)]).toEqual([[1, "couverture"], [2, "autre : photo d'illustration"], [3, "pas-a-pas"]]);
    writeFileSync(join(dossier, "v.csv"), 'diapo,titre,regles,signal,verite,note\n1,"Titre, avec virgule",couverture,x,quiz,\n');
    expect([...lireVerite(join(dossier, "v.csv"), 1)]).toEqual([[1, "quiz"]]);
    expect(figureDeVerite("Étapes clés")).toBe("etapes-cles");
    expect(figureDeVerite("photo")).toBeNull();
  });

  it("refuse une figure inconnue et une diapositive sans vérité, en les nommant", () => {
    const dossier = mkdtempSync(join(tmpdir(), "verite-"));
    writeFileSync(join(dossier, "v.csv"), "diapo;verite\n1;photo\n");
    expect(() => lireVerite(join(dossier, "v.csv"), 2)).toThrow(/diapositive 1 : « photo ».*diapositives sans vérité : 2/);
  });
});

const lectures = (n: number, etendu: Partial<Lectures> = {}): Lectures => ({
  schema: "graduis/lectures@0", deck: { nom: `d${n}`, empreinte: "sha256:0" },
  gabarit: { empreinte: `sha256:${n}`, theme: "", dispositions: ["Titre", "Contenu", "Section"], images: ["sha256:logo"] }, diapositives: [], paires: [], ...etendu,
});
const q = (figure: Qualification["figure"], signal: string): Qualification => ({ figure, signal });

describe("le tableau comparé", () => {
  const qualifs = new Map<number, Qualification>([
    [1, q("couverture", SIGNAL_POSITION)], [2, q("capture", "capture sans pastille")], [3, q("schema", "24 formes dessinées")],
    [4, q("contenu", SIGNAL_REPLI)], [5, q("contenu", SIGNAL_REPLI)], [6, q("contenu", SIGNAL_REPLI)],
  ]);
  const mesures: MesureDeDeck[] = [
    {
      nom: "a.pptx", famille: "comportemental", client: "c1", role: "tableau", qualifications: qualifs,
      verite: new Map([[1, "couverture"], [2, "autre : photo"], [3, "schema"], [4, "contenu"], [5, "quiz"], [6, "pas-a-pas"]]),
      lectures: lectures(1, {
        diapositives: [{ n: 4, smartart: [{ disposition: "process1", noeuds: 3, profondeur: 1 }] }, { n: 3, animation: { clics: 2, effets: 2, devoilement: 2, selonLaLecture: true } }],
        paires: [{ question: 5, reponse: 6, interrogative: true }],
      }),
    },
    { nom: "b.pptx", famille: "comportemental", client: "c1", role: "gabarit", lectures: lectures(2) },
    { nom: "c.pptx", famille: "metier", client: "c2", role: "gabarit", lectures: { ...lectures(3), gabarit: { empreinte: "sha256:3", theme: "", dispositions: ["Autre"], images: [] } } },
    // Les mêmes noms de dispositions, mais un autre masque : un autre gabarit.
    { nom: "d.pptx", famille: "metier", client: "c2", role: "gabarit", lectures: { ...lectures(4), gabarit: { empreinte: "sha256:4", theme: "", dispositions: ["Titre", "Contenu", "Section"], images: ["sha256:autre"] } } },
  ];
  const t = tableauDuCorpus({ nom: "essai", empreinte: "sha256:e", profil: "sha256:p" }, mesures);

  it("compte décidées, position et repli ; la justesse contre la vérité", () => {
    const [l] = t.decks;
    expect(t.decks).toHaveLength(1);
    expect(l).toMatchObject({ diapos: 6, position: 1, decidees: 2, repli: 3, figures: { capture: 1, schema: 1 } });
    expect(l!.signaux).toEqual({ "capture · capture sans pastille": 1, "schema · N formes dessinées": 1 });
    expect(l!.verite).toEqual({
      justes: 1, fausses: 1, repliContenu: 1, repliAutre: 2,
      confusions: { "capture → autre : photo": 1, "repli → pas-a-pas": 1, "repli → quiz": 1 },
      manquantes: { "autre : photo": 1, quiz: 1 },
    });
  });

  it("lit le potentiel des lectures étendues au repli : le SmartArt et la paire, pas le dévoilement d'une diapositive décidée", () => {
    expect(t.decks[0]!.etendues).toEqual({ smartart: 1, graphiques: 0, animees: 1, devoilements: 1, selonLaLecture: 1, questions: 1, duplications: 0, potentiel: 3 });
  });

  it("compte ensemble les graphies d'une même figure libre, sous la plus fréquente", () => {
    const verite = (v: string) => new Map([...qualifs.keys()].map((n) => [n, n === 2 ? v : n === 3 ? "autre : questions métacognitives" : "contenu"]));
    const deux = tableauDuCorpus(t.corpus, [
      { ...mesures[0]!, verite: verite("autre : questions métacognitives") },
      { ...mesures[0]!, nom: "a2.pptx", verite: verite("autre : Questions metacognitive") },
    ]);
    expect(deux.familles[0]!.verite!.manquantes).toEqual({ "autre : questions métacognitives": 4 });
  });

  it("range les gabarits en familles, par client", () => {
    expect(t.gabarits).toEqual([{ client: "c1", decks: 2, empreintes: 2, familles: ["G1"] }, { client: "c2", decks: 2, empreintes: 2, familles: ["G2", "G3"] }]);
  });

  it("s'écrit en Markdown sans dépendre de l'heure ni du poste", () => {
    const md = tableauEnMarkdown(t);
    expect(md).toContain("| Comportemental | 1 | 6 | 1 | 2 (33,3 %) | 3 (50 %) | 1 (16,7 %) | 50 % |");
    expect(md).toContain("autre : photo ×1 · quiz ×1");
    expect(tableauEnMarkdown(tableauDuCorpus(t.corpus, mesures))).toBe(md);
  });
});

describe("le manifeste du corpus", () => {
  let dossier: string;
  beforeAll(async () => {
    dossier = mkdtempSync(join(tmpdir(), "corpus-"));
    const o = await deckEtendu();
    writeFileSync(join(dossier, "etendu.pptx"), o);
    writeFileSync(join(dossier, "corpus.json"), stringify2({
      schema: "graduis/corpus@0", nom: "essai",
      profil: { chemin: join(process.cwd(), "gabarits/profil-neutre.json"), empreinte: empreinteDuProfil(NEUTRE) },
      decks: [{ chemin: "etendu.pptx", empreinte: sha256(o), famille: "procedural-logiciel", client: "essai", role: "tableau" }],
    }));
  });

  it("prépare la vérité une fois, sans jamais la réécrire, et mesure à l'octet près deux fois de suite", () => {
    const c = chargerCorpus(join(dossier, "corpus.json"));
    const [p] = veritesAPreparer(c);
    writeFileSync(p!.deck.verite, p!.contenu);
    expect(veritesAPreparer(chargerCorpus(join(dossier, "corpus.json")))).toEqual([]);
    const a = mesurerCorpus(c);
    const b = mesurerCorpus(chargerCorpus(join(dossier, "corpus.json")));
    expect(stringify2(b.tableau)).toBe(stringify2(a.tableau));
    expect(stringify2([...b.lectures])).toBe(stringify2([...a.lectures]));
    expect(a.tableau.decks[0]).toMatchObject({ diapos: 5, verite: null });
  });

  it("refuse un deck changé, en donnant sa nouvelle empreinte", () => {
    const m = JSON.parse(readFileSync(join(dossier, "corpus.json"), "utf8"));
    m.decks[0].empreinte = "sha256:" + "0".repeat(64);
    writeFileSync(join(dossier, "change.json"), stringify2(m));
    expect(() => chargerCorpus(join(dossier, "change.json"))).toThrow(/le deck etendu\.pptx \(sha256:[0-9a-f]{64}\)/);
  });
});

describe("la page de revue de la vérité", () => {
  it("écrit chaque geste au tableur, refuse une figure inconnue, et ne dit un deck revu qu'une fois tout vu", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "revue-"));
    const o = await deckEtendu();
    writeFileSync(join(dossier, "etendu.pptx"), o);
    const manifeste = join(dossier, "corpus.json");
    writeFileSync(manifeste, stringify2({
      schema: "graduis/corpus@0", nom: "essai",
      profil: { chemin: join(process.cwd(), "gabarits/profil-neutre.json"), empreinte: empreinteDuProfil(NEUTRE) },
      decks: [{ chemin: "etendu.pptx", empreinte: sha256(o), famille: "metier", client: "essai", role: "tableau" }],
    }));
    const c = chargerCorpus(manifeste);
    for (const { deck, contenu } of veritesAPreparer(c)) writeFileSync(deck.verite, contenu);
    const serveur = servirRevue(c, manifeste, { dossier });
    await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
    const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
    const poster = (chemin: string, x: unknown) => fetch(base + chemin, { method: "POST", body: JSON.stringify(x) });
    try {
      const donnees = await (await fetch(base + "/donnees")).json() as { decks: { rendu: string; lignes: unknown[] }[]; figures: unknown[] };
      expect(donnees.decks[0]).toMatchObject({ rendu: "absent" });
      expect(donnees.decks[0]!.lignes).toHaveLength(5);
      expect(donnees.figures).toHaveLength(24);
      expect(await (await fetch(base + "/")).text()).toContain("Revue des figures");
      const r = await poster("/verite/0", { diapo: 4, verite: "Quiz", note: "question écrite" });
      expect(await r.json()).toMatchObject({ diapo: "4", verite: "quiz", vue: "1", note: "question écrite" });
      expect((await poster("/verite/0", { diapo: 4, verite: "photo" })).status).toBe(400);
      expect((await poster("/revue/0", { revue: true })).status).toBe(409);
      for (const n of [1, 2, 3, 5]) await poster("/verite/0", { diapo: n, verite: n === 2 ? "autre : graphique et schéma" : "contenu" });
      expect((await poster("/revue/0", { revue: true })).status).toBe(200);
      const m = chargerCorpus(manifeste);
      expect(m.decks[0]!.deck.verite).toBe("revue");
      expect(lireVerite(m.decks[0]!.verite, 5).get(2)).toBe("autre : graphique et schéma");
      expect(mesurerCorpus(m).tableau.decks[0]!.verite?.manquantes).toEqual({ "autre : graphique et schéma": 1, quiz: 1 });
    } finally {
      serveur.close();
    }
  });
});

const REEL = "docs/sources/corpus/corpus.json";

describe.skipIf(!existsSync(REEL))("le corpus d'épreuve réel (hors dépôt)", () => {
  it("se mesure en entier ; un client, une famille de gabarit (mesure du 18/10)", () => {
    const c = chargerCorpus(REEL);
    const { tableau, lectures } = mesurerCorpus(c);
    expect(lectures.size).toBe(c.decks.length);
    expect(tableau.decks).toHaveLength(c.decks.filter((d) => d.deck.role === "tableau").length);
    for (const l of tableau.decks) expect(l.position + l.decidees + l.repli).toBe(l.diapos);
    for (const g of tableau.gabarits) expect(g.familles).toHaveLength(1);
  });
});
