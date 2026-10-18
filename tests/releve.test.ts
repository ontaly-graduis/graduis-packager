// Témoins du relevé sur le deck synthétique : formes, pas-à-pas apparié, notes, déterminisme, groupes, héritage.
import { describe, expect, it } from "vitest";
import { DOMParser } from "@xmldom/xmldom";
import { stringify2 } from "../src/lib/json";
import { aplatir } from "../src/ooxml/formes";
import { relever } from "../src/releve/releve";
import { mesurer } from "../src/releve/mesures";
import { CONSIGNES, deckSynthetique } from "./fixture";
import { PROFIL } from "./procede";

describe("relevé du deck synthétique", async () => {
  const octets = await deckSynthetique();
  const { releve, medias } = relever(octets, "synthetique.pptx");

  it("lit les diapositives, leur disposition et leurs notes", () => {
    expect(releve.diapositives.map((d) => d.disposition)).toEqual(["Slide transition", "Disposition personnalisée", "Disposition personnalisée"]);
    expect(releve.diapositives[1]!.notes).toBe("Durée : 10 min");
  });

  it("hashe la capture et en lit les dimensions", () => {
    expect(medias.size).toBe(1);
    expect(Object.values(releve.medias)[0]!.px).toEqual([1600, 800]);
  });

  it("apparie repère, zone, légende et consigne par numéro", () => {
    const pas = releve.diapositives[1]!.pas_a_pas!.pas;
    expect(pas.map((p) => p.numero)).toEqual([1, 2]);
    expect(pas.map((p) => p.consigne)).toEqual([...CONSIGNES]);
    expect(pas.every((p) => p.repere && p.legende && p.zone && p.capture?.startsWith("sha256:"))).toBe(true);
  });

  it("mesure le deck : un pas-à-pas, une transition, un marqueur d'inachèvement", () => {
    const m = mesurer(releve, PROFIL);
    expect(m.pasAPas).toBe(1);
    expect(m.pastillesSur).toBe(2);
    expect(m.pastillesSurZone).toBe(2);
    expect(m.inacheves).toEqual([[3, "a rédiger"]]);
    expect(m.sequences.map((q) => q.n0)).toEqual([1, 1]);
    expect(m.appariement).toMatchObject({ pas: 2, paires: 2, complets: 2 });
  });

  it("est déterministe : deux relevés du même deck sont identiques à l'octet", () => {
    expect(stringify2(relever(octets, "synthetique.pptx").releve)).toBe(stringify2(releve));
  });
});

describe("aplatissement", () => {
  const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
  const arbre = (xml: string) => new DOMParser().parseFromString(`<p:spTree ${P}>${xml}</p:spTree>`, "text/xml").documentElement!;
  const sp = (id: number, xfrm: string, ph = "") =>
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="f${id}"/><p:cNvSpPr/><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr>${xfrm}<a:prstGeom prst="rect"/></p:spPr></p:sp>`;
  const ctx = { heritage: () => [10, 20, 30, 40] as const, media: () => undefined };

  it("ramène les enfants d'un groupe en coordonnées absolues", () => {
    const groupe = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="9" name="g"/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="1000" y="2000"/><a:ext cx="200" cy="200"/><a:chOff x="0" y="0"/><a:chExt cx="100" cy="100"/></a:xfrm></p:grpSpPr>`
      + sp(10, '<a:xfrm><a:off x="50" y="50"/><a:ext cx="10" cy="20"/></a:xfrm>') + "</p:grpSp>";
    const [f] = aplatir(arbre(groupe), ctx);
    expect(f).toMatchObject({ id: 10, boite: [1100, 2100, 20, 40], groupe: 9, nature: "forme" });
  });

  it("donne à un espace réservé sans position la boîte de sa disposition", () => {
    const [f] = aplatir(arbre(sp(4, "", '<p:ph type="title"/>')), ctx);
    expect(f).toMatchObject({ nature: "espace", boite: [10, 20, 30, 40], espace: { type: "title", idx: 0 } });
  });
});
