// Témoins des schémas redessinés (PKG-B2) : couleurs du thème du deck, rôles, géométries, dessin au pivot, SVG au thème.
import { DOMParser } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { lireCouleur } from "../src/ooxml/couleurs";
import { tracer } from "../src/dessin/geometries";
import { dessinEnSvg, transformerChemin } from "../src/dessin/svg";
import { ROLES, SeanceSpec, type Dessin, blocsDe } from "../src/pivot/seance-spec";
import { qualifierReleve } from "../src/qualification/qualifier";
import { roleDe, roleDeTexte } from "../src/qualification/roles";
import { relever } from "../src/releve/releve";
import { compenserChasse, rapportDeChasse } from "../src/theme/chasse";
import { deckDeSchema } from "./fixture";
import { PROFIL } from "./procede";

const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const couleur = (xml: string, palette: Record<string, string> = {}) =>
  lireCouleur(new DOMParser().parseFromString(xml.replace("<a:", `<a:`).replace(/^<a:(\w+)/, `<a:$1 ${A}`), "text/xml").documentElement!, new Map(Object.entries(palette)));

describe("couleurs DrawingML", () => {
  it("résout une couleur du thème et ses modificateurs comme PowerPoint (« plus clair 40 % », « plus sombre 25 % »)", () => {
    const pal = { accent1: "4472C4" };
    expect(couleur('<a:schemeClr val="accent1"><a:lumMod val="60000"/><a:lumOff val="40000"/></a:schemeClr>', pal)?.rgb).toBe("8FAADC");
    expect(couleur('<a:schemeClr val="accent1"><a:lumMod val="75000"/></a:schemeClr>', pal)?.rgb).toBe("2F5597");
    expect(couleur('<a:srgbClr val="FF0000"><a:alpha val="38000"/></a:srgbClr>')).toEqual({ rgb: "FF0000", alpha: 38000 });
    expect(couleur('<a:schemeClr val="accent9"/>', pal)).toBeUndefined();
  });
});

describe("rôles de couleur", () => {
  it("projette les couleurs du deck sur les familles et les tons du thème", () => {
    const r = (rgb: string) => roleDe({ rgb }, PROFIL.projection);
    expect([r("003058"), r("002060"), r("2E75B6"), r("BDD7EE")]).toEqual(["marine-fort", "marine-fort", "marine-fort", "marine-pale"]);
    expect([r("00B3C3"), r("228A94"), r("D3F2F5")]).toEqual(["ciel-moyen", "ciel-fort", "ciel-pale"]);
    expect([r("A5C715"), r("DCF4CE"), r("F28E00"), r("FFC000"), r("FF0000"), r("FFEBEB")]).toEqual(["vert-fort", "vert-pale", "ambre-fort", "ambre-moyen", "rouge-fort", "rouge-pale"]);
    expect([r("FFFFFF"), r("000000"), r("A3A7AF"), r("EDEDED"), r("666666")]).toEqual(["papier", "encre", "gris-moyen", "gris-pale", "gris-fort"]);
    // Une opacité se compose sur le blanc avant la projection.
    expect(roleDe({ rgb: "003058", alpha: 15000 }, PROFIL.projection)).toMatch(/-pale$/);
  });

  it("garde le contraste d'un texte sur son fond", () => {
    expect(roleDeTexte("marine-fort", "marine-fort")).toBe("papier");
    expect(roleDeTexte("papier", "vert-pale")).toBe("marine-fort");
    expect(roleDeTexte("papier", "rouge-fort")).toBe("papier");
    expect(roleDeTexte("ambre-fort", undefined)).toBe("ambre-fort");
  });
});

describe("géométries", () => {
  it("trace un connecteur coudé par son ajustement, et une bulle dont la pointe sort vers le bas", () => {
    expect(tracer("bentConnector3", 0, 0, 100, 40, { adj1: 25000 }).points).toEqual([[0, 0], [25, 0], [25, 40], [100, 40]]);
    const bulle = tracer("wedgeRoundRectCallout", 0, 0, 100, 50, { adj1: -20833, adj2: 62500, adj3: 16667 }).d;
    expect(bulle).toMatch(/^M.*Z$/);
    expect(bulle).toContain("L29.17 56.25");
    expect(tracer("forme-inconnue", 1, 2, 3, 4).d).toBe("M1 2L4 2L4 6L1 6Z");
  });

  it("met un chemin libre à l'échelle de sa boîte", () => {
    expect(transformerChemin("M0 0L100 50C10 20 30 40 50 60Z", 2, 0.5, 10, 20)).toBe("M10 20L210 45C30 30 70 40 110 50Z");
  });
});

describe("le schéma du deck synthétique", async () => {
  const { releve } = relever(await deckDeSchema(), "schema.pptx");
  const { spec } = qualifierReleve(releve, PROFIL);
  const bloc = blocsDe(spec).find((b) => b.source.diapo === 2)!;
  const dessin = bloc.dessin!;

  it("qualifie la diapositive en schéma et la redessine au pivot, titre écarté", () => {
    expect(bloc.figure).toBe("schema");
    expect(SeanceSpec.parse(spec)).toEqual(spec);
    expect(bloc.titre).toBe("Circuit de validation");
    const textes = dessin.elements.flatMap((e) => (e.type === "forme" && e.texte ? [e.texte.paragraphes.map((p) => p.fragments.map((f) => f.texte).join("")).join("\n")] : []));
    expect(textes).not.toContain("Circuit de validation");
    expect(textes).toEqual(expect.arrayContaining(["Étape 1", "Étape 6", "Montant > seuil ?", "3"]));
  });

  it("n'écrit que des rôles, des points et le vocabulaire DrawingML", () => {
    const json = JSON.stringify(dessin);
    expect(json).not.toMatch(/"[0-9A-Fa-f]{6}"/);
    const roles = new Set(json.match(/"(fond|couleur)":"[^"]+"/g)?.map((m) => m.split(":")[1]!.replace(/"/g, "")));
    for (const r of roles) expect(ROLES).toContain(r);
    const etapes = dessin.elements.filter((e) => e.type === "forme" && e.geometrie === "roundRect");
    // Deux bleus nettement distincts (2E75B6, 002060, le plus employé) ne se fondent pas : le plus clair prend le ton voisin.
    expect(etapes.map((e) => (e.type === "forme" ? e.fond : null))).toEqual(["marine-moyen", "ciel-moyen", "vert-fort", "ambre-fort", "rouge-fort", "marine-fort"]);
    // Le texte blanc sur un fond clair (ciel moyen) passe à l'encre marine ; il reste papier sur les fonds sombres.
    const texteDe = (i: number) => (etapes[i]?.type === "forme" ? etapes[i].texte?.paragraphes[0]?.fragments[0]?.couleur : undefined);
    expect([texteDe(0), texteDe(1), texteDe(2), texteDe(5)]).toEqual(["papier", "marine-fort", "papier", "papier"]);
  });

  it("garde les flèches, les tirets et la police d'origine", () => {
    const traits = dessin.elements.filter((e) => e.type === "forme" && e.geometrie === "line");
    expect(traits).toHaveLength(5);
    expect(traits.every((e) => e.type === "forme" && e.trait?.fin === "triangle" && e.trait.couleur === "gris-moyen")).toBe(true);
    expect(traits.filter((e) => e.type === "forme" && e.trait?.tirets === "dash")).toHaveLength(1);
    const etape = dessin.elements.find((e) => e.type === "forme" && e.geometrie === "roundRect");
    expect(etape?.type === "forme" && etape.texte?.police).toBe("Calibri");
    expect(etape?.type === "forme" && etape.texte?.paragraphes[0]?.fragments[0]?.taille).toBe(10);
  });

  it("compense la chasse au thème : nom exact, puis sans suffixe de graisse", () => {
    const table = { Calibri: 0.816, "Asap Condensed": 0.722 };
    expect([rapportDeChasse(table, "Asap Condensed Medium"), rapportDeChasse(table, "Calibri Light"), rapportDeChasse(table, "Inconnue"), rapportDeChasse(table, undefined)]).toEqual([0.722, 0.816, 1, 1]);
    const compense = compenserChasse(dessin, table);
    const etape = compense.elements.find((e) => e.type === "forme" && e.geometrie === "roundRect");
    expect(etape?.type === "forme" && etape.texte?.paragraphes[0]?.fragments[0]?.taille).toBe(8.16);
  });

  it("rend un SVG au thème : classes de rôle, aucun hex, textes en HTML, déterministe", () => {
    const svg = dessinEnSvg(dessin, "b002");
    expect(svg).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(svg).not.toMatch(/#[0-9A-Fa-f]{3,6}\b|rgb\(/);
    expect(svg).toContain('class="f-marine-fort');
    expect(svg).toContain('class="s-gris-moyen" stroke-width="1" stroke-dasharray="4 3"');
    expect((svg.match(/<foreignObject/g) ?? []).length).toBeGreaterThanOrEqual(13);
    expect(svg).toContain("Montant &gt; seuil ?");
    expect(dessinEnSvg(dessin, "b002")).toBe(svg);
  });
});

describe("un dessin vide", () => {
  it("se rend sans erreur", () => {
    const vide: Dessin = { cadre: [0, 0, 0, 0], elements: [] };
    expect(dessinEnSvg(vide, "x")).toContain("<svg");
  });
});
