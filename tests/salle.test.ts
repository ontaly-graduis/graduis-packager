// Témoins de la salle : navigation, RegionMap, mise en salle, assemblage (déterminisme, 0 hex hors jetons, aucune ressource distante).
import { describe, expect, it } from "vitest";
import { relever } from "../src/releve/releve";
import { qualifierReleve } from "../src/qualification/qualifier";
import { regionMap } from "../src/salle/region-map";
import { mettreEnSalle } from "../src/salle/donnees";
import { construireSalle } from "../src/salle/construire";
import { debut, fin, precedent, premieresEtapes, suivant } from "../src/salle/lecteur/etat";
import { fondLisible } from "../src/salle/lecteur/contraste";
import type { Role } from "../src/pivot/seance-spec";
import { chargerTheme } from "../src/theme/theme";
import { CONSIGNES, deckSynthetique } from "./fixture";
import { ONET, PROFIL } from "./procede";

describe("navigation", () => {
  const etapes = [0, 2, 0];
  const premieres = premieresEtapes(etapes);
  it("ouvre un bloc dévoilé sur sa première unité, avance par dévoilement puis par bloc, recule vers le bloc précédent entièrement dévoilé", () => {
    expect(premieres).toEqual([0, 1, 0]);
    let p = debut(premieres);
    const vus: string[] = [];
    for (let i = 0; i < 4; i++) {
      vus.push(`${p.bloc}.${p.etape}`);
      p = suivant(p, etapes, premieres);
    }
    expect(vus).toEqual(["0.0", "1.1", "1.2", "2.0"]);
    expect(suivant(fin(etapes), etapes, premieres)).toEqual(fin(etapes));
    expect(precedent({ bloc: 2, etape: 0 }, etapes, premieres)).toEqual({ bloc: 1, etape: 2 });
    expect(precedent({ bloc: 1, etape: 1 }, etapes, premieres)).toEqual({ bloc: 0, etape: 0 });
    expect(precedent(debut(premieres), etapes, premieres)).toEqual(debut(premieres));
    expect(debut(premieresEtapes([3, 0]))).toEqual({ bloc: 0, etape: 1 });
  });
});

describe("contraste des pictogrammes", () => {
  // Luminances relatives du thème ONET : l'ambre (#b26a00, son mélange au papier, son fond pâle), le ciel ; le papier.
  const L: Partial<Record<Role, number>> = {
    "ambre-fort": 0.197, "ambre-moyen": 0.45, "ambre-pale": 0.887, "ciel-fort": 0.47, "ciel-moyen": 0.669, "ciel-pale": 0.879, papier: 1,
  };
  const luminance = (r: Role) => L[r] ?? Number.NaN;
  const marine = 0.041;
  const blanc = 1;
  it("garde l'aplat qui porte l'icône à 3:1, sinon prend le ton lisible le plus proche de sa famille", () => {
    expect(fondLisible("ciel-moyen", marine, luminance)).toBe("ciel-moyen");
    // L'ampoule marine sur la terre (2,7:1) : le ton moyen (5,5:1) plutôt que le pâle, plus contrasté mais plus loin.
    expect(fondLisible("ambre-fort", marine, luminance)).toBe("ambre-moyen");
  });
  it("à défaut, prend le ton le plus contrasté de la famille ; laisse le papier, l'encre et l'inconnu tels quels", () => {
    expect(fondLisible("ciel-moyen", blanc, luminance)).toBe("ciel-fort");
    expect(fondLisible("papier", blanc, luminance)).toBe("papier");
    expect(fondLisible("rouge-fort", marine, luminance)).toBe("rouge-fort");
  });
});

describe("salle du deck synthétique", async () => {
  const { releve, medias } = relever(await deckSynthetique(), "synthetique.pptx");
  const { spec } = qualifierReleve(releve, PROFIL);
  const pas = spec.sequences[0]!.blocs[1]!;
  const media = (h: string) => {
    const m = medias.get(h);
    return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined;
  };
  const options = { prise: { devoilement: "pastille" as const }, theme: chargerTheme("gabarits/theme-onet"), media };

  it("dérive la RegionMap des pas : une zone d'observation par pas ancré", () => {
    const rm = regionMap(pas);
    const zones = Object.values(rm.captures)[0]!;
    expect(zones.map((z) => [z.step, z.role, z.consigne])).toEqual([["P1", "observe", CONSIGNES[0]], ["P2", "observe", CONSIGNES[1]]]);
    expect(rm.pas?.map((p) => p.id)).toEqual(["P1", "P2"]);
  });

  it("compte les étapes selon le dévoilement de la prise", () => {
    const px = () => null;
    const etapes = (d: "pastille" | "ecran") => mettreEnSalle(spec, { devoilement: d }, px).sequences.flatMap((s) => s.blocs.map((b) => b.etapes));
    expect(etapes("pastille")).toEqual([0, 2, 0]); // la 3ᵉ diapositive n'a qu'un titre
    expect(etapes("ecran")).toEqual([0, 0, 0]);
  });

  it("refuse une séquence inconnue, et dit celles de la séance", () => {
    expect(() => mettreEnSalle(spec, { devoilement: "pastille" }, () => null, ["S001"])).toThrow("séquence inconnue : S001 — celles de la séance : s001");
  });

  it("assemble un fichier unique, identique à l'octet d'une construction à l'autre", async () => {
    const a = await construireSalle(spec, options);
    const b = await construireSalle(spec, options);
    expect(a.html).toBe(b.html);
    expect(a.nonAffichables).toEqual([]);
  });

  it("n'écrit aucun hex hors jetons et ne charge aucune ressource distante", async () => {
    const { html } = await construireSalle(spec, options);
    const horsTheme = html.replace(/<style id="theme">[\s\S]*?<\/style>/, "");
    expect(horsTheme).not.toMatch(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b(?![\w-])/i);
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["']?https?:|url\(\s*["']?https?:|@import/i);
  });
});

describe("salle d'un schéma recomposé", () => {
  it("embarque les images des dessins et des vignettes, qui ne sont plus des visuels depuis PKG-C3", async () => {
    const { deckDeTableau } = await import("./fixture");
    const { releve, medias } = relever(await deckDeTableau(), "tableau.pptx");
    const { spec } = qualifierReleve(releve, PROFIL);
    const b = spec.sequences.flatMap((s) => s.blocs).find((x) => x.composition?.gabarit === "tableau")!;
    const c = b.composition!;
    const illustration = c.gabarit === "tableau" ? c.illustration?.elements.find((e) => e.type === "image") : undefined;
    expect(illustration?.type).toBe("image");
    const media = illustration!.type === "image" ? illustration!.media : "";
    expect(b.visuels.map((v) => v.media)).not.toContain(media);
    const { html } = await construireSalle(spec, {
      prise: { devoilement: "pastille" }, theme: chargerTheme("gabarits/theme-onet"),
      media: (h) => { const m = medias.get(h); return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined; },
    });
    expect(html).toContain(`"${media}": "data:image/`);
  });
});
