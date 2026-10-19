// Témoins des activités dérivées (ACT-1) : les dérivations n'inventent rien (P10), la chaîne propose en moyenne, le PPT
// d'auteur les porte et les relit (I-PKG-3), une activité pointe et suit sa source (I-PKG-12), l'écart les borne (I-PKG-19),
// la salle les joue en deux temps et le livret porte leur repli (I-PKG-13).
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { describe, expect, it } from "vitest";
import { deriver, melange, textesDuContenu } from "../src/activites/deriver";
import { DUREES_GRADUIS, type Durees } from "../src/diagnostic/regles";
import { ecartDeLivraison } from "../src/ecart/ecart";
import { emettre } from "../src/emission/emettre";
import { dispositionDeGeste } from "../src/emission/grammaire";
import { ARBRE_VIDE, ENTETE, XMLNS } from "../src/emission/xml";
import { lire } from "../src/lecture/lire";
import { stringify2 } from "../src/lib/json";
import { mettreSurPapier, textesAttendus } from "../src/papier/donnees";
import { activitesDe, blocsDe, FIGURES, GESTES, SeanceSpec, type Activite, type Bloc } from "../src/pivot/seance-spec";
import { qualifierReleve } from "../src/qualification/qualifier";
import { relever } from "../src/releve/releve";
import { mettreEnSalle } from "../src/salle/donnees";
import { deckDActivites, ETAPES_CLES, LIGNES_DE_PROCESSUS, PAS_DE_COMMANDE } from "./fixture";
import { ONET, PROFIL } from "./procede";

const theme = ONET.theme;
const mots = (s: string) => s.normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Le deck à activer, relevé et qualifié ; `durees` : en sensibilité moyenne. */
async function qualifie(durees?: Durees) {
  const { releve, medias } = relever(await deckDActivites(), "activites.pptx");
  const { spec } = qualifierReleve(releve, PROFIL, durees);
  const media = (h: string) => { const m = medias.get(h); return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined; };
  return { releve, spec, media, octets: emettre(spec, { theme, media, gestes: durees !== undefined }) };
}

const blocDe = (spec: SeanceSpec, id: string) => spec.sequences.flatMap((s) => s.blocs).find((b) => b.id === id)!;
const source = (spec: SeanceSpec, figure: Bloc["figure"]) => blocsDe(spec).find((b) => b.figure === figure)!;

/** Une partie XML du paquet, retouchée comme dans PowerPoint. */
function retoucher(octets: Uint8Array, partie: string, de: string | RegExp, vers: string): Uint8Array {
  const p = unzipSync(octets);
  const avant = strFromU8(p[partie]!);
  const apres = avant.replace(de, vers);
  if (apres === avant) throw new Error(`rien à retoucher dans ${partie}`);
  p[partie] = strToU8(apres);
  return zipSync(p as Zippable);
}

/** Ce que fait PowerPoint pour « Nouvelle diapositive » à une disposition donnée : une diapositive vide après la n-ième. */
function nouvelleDiapositive(octets: Uint8Array, apres: number, nom: string): Uint8Array {
  const p = unzipSync(octets);
  const t = (c: string) => strFromU8(p[c]!);
  const k = Object.keys(p).filter((c) => /^ppt\/slides\/slide\d+\.xml$/.test(c)).length + 1;
  const disposition = Object.keys(p).find((c) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(c) && t(c).includes(`name="${nom}"`));
  if (!disposition) throw new Error(`disposition absente : ${nom}`);
  p[`ppt/slides/slide${k}.xml`] = strToU8(`${ENTETE}<p:sld ${XMLNS}><p:cSld><p:spTree>${ARBRE_VIDE}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Titre 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="fr-FR"/></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
  p[`ppt/slides/_rels/slide${k}.xml.rels`] = strToU8(`${ENTETE}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${disposition.split("/").pop()}"/></Relationships>`);
  p["ppt/_rels/presentation.xml.rels"] = strToU8(t("ppt/_rels/presentation.xml.rels").replace("</Relationships>", `<Relationship Id="rIdNeuve" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${k}.xml"/></Relationships>`));
  p["ppt/presentation.xml"] = strToU8(t("ppt/presentation.xml").replace(new RegExp(`(<p:sldId id="\\d+" r:id="rId${apres + 9}"/>)`), `$1<p:sldId id="9998" r:id="rIdNeuve"/>`));
  p["[Content_Types].xml"] = strToU8(t("[Content_Types].xml").replace("</Types>", `<Override PartName="/ppt/slides/slide${k}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`));
  return zipSync(p as Zippable);
}

/** Retire la n-ième diapositive de la présentation (sa partie reste, orpheline, comme une suppression vue de `lire`). */
function retirerDiapositive(octets: Uint8Array, n: number): Uint8Array {
  return retoucher(octets, "ppt/presentation.xml", new RegExp(`<p:sldId id="\\d+" r:id="rId${n + 9}"/>`), "");
}

describe("les dérivations sans invention (spec v1 § 5.3)", () => {
  it("tirent de chaque source son activité, sans un mot de plus", async () => {
    const { spec } = await qualifie();
    const schema = source(spec, "schema");
    const processus = source(spec, "processus");
    const pap = source(spec, "pas-a-pas");
    const cles = source(spec, "etapes-cles");
    const ordre = deriver({ derivation: "etapes-a-replacer", derive_de: schema.id }, schema);
    expect(ordre?.geste === "classement" && ordre.items).toEqual(["Transformer la demande", "Compléter la commande", "Soumettre au circuit", "Signer le bon"]);
    const range = deriver({ derivation: "qui-fait-quoi", derive_de: processus.id }, processus);
    // Acteur et Outil départagent également : la plus à gauche.
    expect(range?.geste === "categorisation" && [range.intitule, range.categories]).toEqual(["Acteur", ["Demandeur", "Manager", "Acheteur"]]);
    expect(range?.geste === "categorisation" && range.cartes.map((c) => c.texte)).toEqual(LIGNES_DE_PROCESSUS.map((l) => l[0]));
    const pas = deriver({ derivation: "ordre-des-pas", derive_de: pap.id }, pap);
    expect(pas?.geste === "classement" && pas.items).toEqual([...PAS_DE_COMMANDE]);
    const ou = deriver({ derivation: "ou-cliquez-vous", derive_de: pap.id }, pap);
    expect(ou?.geste === "selection-sur-image" && ou.pas.map((p) => [p.numero, p.consigne])).toEqual(PAS_DE_COMMANDE.map((c, i) => [i + 1, c]));
    const rappel = deriver({ derivation: "rappel", derive_de: cles.id }, cles);
    expect(rappel?.geste === "rappel" && rappel.items).toEqual([...ETAPES_CLES]);
    // Aucun mot qui ne soit déjà dans sa source.
    for (const [c, b] of [[ordre, schema], [range, processus], [pas, pap], [ou, pap], [rappel, cles]] as const) {
      const tenus = new Set(mots([b.titre ?? "", ...b.textes, ...b.tableaux.flat(2), ...b.pas.map((p) => p.consigne ?? "")].join(" ")));
      expect(textesDuContenu(c!).flatMap(mots).filter((m) => !tenus.has(m))).toEqual([]);
    }
  });

  it("mélangent de façon déterministe, jamais dans l'ordre juste", () => {
    expect(melange(9, "b031·etapes-a-replacer")).toEqual(melange(9, "b031·etapes-a-replacer"));
    for (let n = 2; n <= 9; n++) for (const g of ["a", "b", "c", "d"]) {
      const p = melange(n, g);
      expect([...p].sort((x, y) => x - y)).toEqual([...Array(n).keys()]);
      expect(p.every((x, i) => x === i)).toBe(false);
    }
  });

  it("ne dérivent rien d'une source qui ne s'y prête pas", async () => {
    const { spec } = await qualifie();
    const pap = source(spec, "pas-a-pas");
    expect(deriver({ derivation: "rappel", derive_de: pap.id }, pap)).toBeNull();
    expect(deriver({ derivation: "ordre-des-pas", derive_de: pap.id }, { ...pap, pas: pap.pas.slice(0, 2) })).toBeNull();
    const processus = source(spec, "processus");
    expect(deriver({ derivation: "qui-fait-quoi", derive_de: processus.id }, { ...processus, tableaux: [[["Étape", "Acteur"], ["A", "X"], ["B", "X"], ["C", "X"], ["D", "X"], ["E", "Y"]]] })).toBeNull();
  });
});

describe("les activités que la chaîne propose (sensibilité moyenne)", () => {
  it("sont les dérivations sans choix, posées avant ou après leur source ; aucune d'un pas-à-pas ; aucune en minimale", async () => {
    const { spec } = await qualifie(DUREES_GRADUIS);
    expect(spec.sequences.flatMap((s) => s.blocs.map((b) => b.id))).toEqual(["b001", "b002", "b003", "a003", "b004", "a004", "b005", "a006", "b006"]);
    expect(activitesDe(spec)).toEqual([
      { id: "a003", figure: "activite", derivation: "etapes-a-replacer", derive_de: "b003", duree: 5 },
      { id: "a004", figure: "activite", derivation: "qui-fait-quoi", derive_de: "b004", duree: 8 },
      { id: "a006", figure: "activite", derivation: "rappel", derive_de: "b006", duree: 5 },
    ]);
    expect(activitesDe((await qualifie()).spec)).toEqual([]);
  });
});

describe("les activités dans le PPT d'auteur", () => {
  it("se relisent à l'identique, sans écart ; mêmes octets ; aucune couleur hors du thème (I-PKG-3, I-PKG-6)", async () => {
    const { spec, octets, media } = await qualifie(DUREES_GRADUIS);
    const { spec: relu, ecarts } = lire(octets, PROFIL);
    expect(ecarts).toEqual([]);
    expect(stringify2(relu)).toBe(stringify2(spec));
    expect(Buffer.from(emettre(spec, { theme, media, gestes: true })).equals(Buffer.from(octets))).toBe(true);
    const p = unzipSync(octets);
    expect(Object.keys(p).filter((c) => c.endsWith(".xml") && !c.startsWith("ppt/theme/") && /srgbClr|sysClr/.test(strFromU8(p[c]!)))).toEqual([]);
    // L'activité telle qu'elle se jouera : sa disposition, ses éléments mélangés, sa durée, son corrigé en notes, ses étiquettes.
    expect(strFromU8(p["ppt/slides/_rels/slide4.xml.rels"]!)).toContain("slideLayout17.xml");
    const a = strFromU8(p["ppt/slides/slide4.xml"]!);
    expect(a).toContain("Dans quel ordre ?");
    expect(a).toContain('name="G·durée"');
    expect(a).toContain(">5 min<");
    expect(strFromU8(p["ppt/notesSlides/notesSlide4.xml"]!)).toContain("1. Transformer la demande");
    expect(strFromU8(p["ppt/tags/tag4.xml"]!)).toMatch(/GRADUIS\.DERIVE" val="b003".*GRADUIS\.DERIVATION" val="etapes-a-replacer"/);
  });

  it("n'offrent leurs dispositions qu'à partir de la moyenne", async () => {
    const dispositions = (o: Uint8Array) => { const p = unzipSync(o); return Object.keys(p).filter((c) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(c)).length; };
    expect(dispositions((await qualifie()).octets)).toBe(FIGURES.length);
    expect(dispositions((await qualifie(DUREES_GRADUIS)).octets)).toBe(FIGURES.length + GESTES.length);
  });

  it("s'ajoutent à la main : une diapositive « G · Sélection sur image » posée après un pas-à-pas en dérive « où cliquez-vous ? »", async () => {
    const { spec, octets } = await qualifie(DUREES_GRADUIS);
    const { spec: relu, ecarts } = lire(nouvelleDiapositive(octets, 7, dispositionDeGeste("selection-sur-image")), PROFIL, DUREES_GRADUIS);
    expect(ecarts.map((e) => e.message)).toEqual(["activité ajoutée : « ou-cliquez-vous », dérivée de la diapositive qui la précède (b005)"]);
    const ajoutee = activitesDe(relu).find((a) => a.derivation === "ou-cliquez-vous");
    expect(ajoutee).toEqual({ id: "a005", figure: "activite", derivation: "ou-cliquez-vous", derive_de: "b005", duree: 3 });
    expect(relu.sequences.flatMap((s) => s.blocs.map((b) => b.id))).toEqual(["b001", "b002", "b003", "a003", "b004", "a004", "b005", "a005", "a006", "b006"]);
    // Réémise, elle porte ses étiquettes : la relecture suivante ne dit plus rien.
    const { media } = await qualifie();
    expect(lire(emettre(relu, { theme, media, gestes: true }), PROFIL, DUREES_GRADUIS).ecarts).toEqual([]);
    expect(blocsDe(relu)).toEqual(blocsDe(spec));
  });

  it("refusent une dérivation qui n'existe pas, en le disant", async () => {
    const { octets } = await qualifie(DUREES_GRADUIS);
    const { spec, ecarts } = lire(nouvelleDiapositive(octets, 7, dispositionDeGeste("rappel")), PROFIL, DUREES_GRADUIS);
    expect(ecarts.map((e) => e.message)).toEqual(["aucune activité ne se dérive d'une diapositive « pas-a-pas » (b005) par le geste « rappel » : diapositive ignorée"]);
    expect(activitesDe(spec)).toHaveLength(3);
  });

  it("signalent une retouche sans la reprendre, suivent leur source sans écart, prennent leur durée du PPT", async () => {
    const { spec, octets } = await qualifie(DUREES_GRADUIS);
    // Une étape réécrite sur la diapositive d'activité : signalée, l'activité reste ce que sa source dit.
    const retouche = lire(retoucher(octets, "ppt/slides/slide4.xml", ">Signer le bon<", ">Signer le bon de commande<"), PROFIL, DUREES_GRADUIS);
    expect(retouche.ecarts.map((e) => e.message)).toEqual(["le contenu d'une activité ne se retouche pas dans PowerPoint : il dérive de b003 — retouche non reprise (modifier la source)"]);
    expect(stringify2(retouche.spec)).toBe(stringify2(spec));
    // La source modifiée : la diapositive d'activité est en retard, pas retouchée — aucun écart ; l'activité suit sa source.
    const suit = lire(retoucher(octets, "ppt/slides/slide7.xml", PAS_DE_COMMANDE[2], "Cliquer sur Créer la commande"), PROFIL, DUREES_GRADUIS);
    expect(suit.ecarts).toEqual([]);
    const b005 = blocDe(suit.spec, "b005") as Bloc;
    const ordre = deriver({ derivation: "ordre-des-pas", derive_de: "b005" }, b005);
    expect(ordre?.geste === "classement" && ordre.items[2]).toBe("Cliquer sur Créer la commande");
    // La durée se change dans le PPT.
    const duree = lire(retoucher(octets, "ppt/slides/slide6.xml", ">8 min<", ">12 min<"), PROFIL, DUREES_GRADUIS);
    expect(duree.ecarts).toEqual([]);
    expect((blocDe(duree.spec, "a004") as Activite).duree).toBe(12);
  });

  it("disparaissent avec leur source, en le disant", async () => {
    const { octets } = await qualifie(DUREES_GRADUIS);
    const { spec, ecarts } = lire(retirerDiapositive(octets, 5), PROFIL, DUREES_GRADUIS);
    expect(ecarts.map((e) => e.message)).toEqual(["activité dont la source (b004) n'est plus au PPT : retirée"]);
    expect(activitesDe(spec).map((a) => a.id)).toEqual(["a003", "a006"]);
  });
});

describe("l'écart de la sensibilité moyenne (I-PKG-19)", () => {
  it("compte les activités et leurs minutes, sans un mot inventé ; la minimale n'en admet aucune", async () => {
    const { releve, spec } = await qualifie(DUREES_GRADUIS);
    const e = ecartDeLivraison(releve, spec, spec, "moyenne");
    expect(e.franchies).toEqual([]);
    expect(e.chaine.activites.map((a) => [a.id, a.inventes.length])).toEqual([["a003", 0], ["a004", 0], ["a006", 0]]);
    expect([e.chaine.minutes, e.revue.activites.length, e.livrees.minutes]).toEqual([18, 0, 18]);
    expect(e.chaine.inventes).toEqual([]);
    const minimale = ecartDeLivraison(releve, (await qualifie()).spec, spec, "minimale");
    expect(minimale.franchies).toEqual(["3 activité(s) dérivée(s) dans une séance en minimale, qui n'en admet aucune : a003, a004, a006"]);
    expect(ecartDeLivraison(releve, (await qualifie()).spec, (await qualifie()).spec, "minimale").franchies).toEqual([]);
  });
});

describe("les activités en salle et sur papier", () => {
  it("se jouent en deux temps, une Sélection sur image pas à pas ; le présentateur lit le corrigé ; des zones `act`", async () => {
    const { spec } = await qualifie(DUREES_GRADUIS);
    const ajoutee: Activite = { id: "a005", figure: "activite", derivation: "ou-cliquez-vous", derive_de: "b005", duree: 3 };
    const avecSelection = SeanceSpec.parse({ ...spec, sequences: spec.sequences.map((s) => ({ ...s, blocs: s.blocs.flatMap((b) => (b.id === "b005" ? [b, ajoutee] : [b])) })) });
    const salle = mettreEnSalle(avecSelection, { devoilement: "pastille" }, () => [1600, 800]);
    const blocs = new Map(salle.sequences.flatMap((s) => s.blocs).map((b) => [b.id, b]));
    expect(["a003", "a004", "a006", "a005"].map((id) => [blocs.get(id)!.etapes, blocs.get(id)!.activite?.geste])).toEqual([[2, "classement"], [2, "categorisation"], [2, "rappel"], [6, "selection-sur-image"]]);
    expect(blocs.get("a003")!.notes).toBe("Corrigé\n1. Transformer la demande\n2. Compléter la commande\n3. Soumettre au circuit\n4. Signer le bon");
    expect(blocs.get("a005")!.regionMap?.captures[blocs.get("a005")!.visuels[0]!.media]?.map((z) => [z.role, z.step])).toEqual([["act", "P1"], ["act", "P2"], ["act", "P3"]]);
    expect(blocs.get("a004")!.duree).toBe(8);
  });

  it("ont leur fiche dans le livret : ce qu'on ordonne ou range, jamais ce qu'un rappel doit retrouver", async () => {
    const { spec } = await qualifie(DUREES_GRADUIS);
    const papier = mettreSurPapier(spec, () => [1600, 800]);
    const fiches = papier.sequences.flatMap((s) => s.blocs).filter((b) => b.activite).map((b) => b.id);
    expect(fiches).toEqual(["a003", "a004", "a006"]);
    const attendus = textesAttendus(papier);
    for (const t of ["Dans quel ordre ?", "Signer le bon", "Qui fait quoi ?", "Demandeur", "Qu'avez-vous retenu ?"]) expect(attendus).toContain(t);
    // Les étapes clés sont au livret par leur bloc source, une fois : la fiche du rappel ne les porte pas.
    expect(attendus.filter((l) => l === ETAPES_CLES[0])).toHaveLength(1);
  });
});
