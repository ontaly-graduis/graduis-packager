// Témoins du PPT de validation (PKG-C1) : la grammaire écrite par `emettre` se relit par `lire` sans rien perdre
// (I-PKG-3), le paquet est déterministe, une diapositive dupliquée est renumérotée, une consigne retouchée dans
// PowerPoint ne change qu'un bloc, et aucune couleur n'est en dur hors du thème (I-PKG-6).
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
import { CONSIGNES, deckDeCas, deckDeSchema, deckDeTableau, deckSynthetique } from "./fixture";

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
  it("se relit à l'identique : lire(émettre(pivot₀)) ≡ pivot₀, sur les quatre decks synthétiques", async () => {
    for (const [nom, deck] of [["synthetique", deckSynthetique], ["schema", deckDeSchema], ["cas", deckDeCas], ["tableau", deckDeTableau]] as const) {
      const { spec, octets } = await valider(await deck(), `${nom}.pptx`);
      const { spec: relu, ecarts } = lire(octets);
      expect(ecarts, nom).toEqual([]);
      expect(stringify2(relu), nom).toBe(stringify2(spec));
    }
  });

  it("est déterministe : même pivot, mêmes octets", async () => {
    const a = await valider(await deckSynthetique(), "s.pptx");
    const b = await valider(await deckSynthetique(), "s.pptx");
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

  it("ne cite que les couleurs du thème : aucune valeur hors de theme1 et theme2 (I-PKG-6)", async () => {
    for (const deck of [deckSynthetique, deckDeSchema, deckDeTableau]) {
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
