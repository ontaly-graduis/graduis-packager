// Témoins de la salle : navigation, RegionMap, mise en salle, assemblage (déterminisme, 0 hex hors jetons, aucune ressource distante).
import { describe, expect, it } from "vitest";
import { relever } from "../src/releve/releve";
import { qualifierReleve } from "../src/qualification/qualifier";
import { regionMap } from "../src/salle/region-map";
import { mettreEnSalle } from "../src/salle/donnees";
import { construireSalle } from "../src/salle/construire";
import { debut, fin, precedent, suivant } from "../src/salle/lecteur/etat";
import { chargerTheme } from "../src/theme/theme";
import { CONSIGNES, deckSynthetique } from "./fixture";

describe("navigation", () => {
  const etapes = [0, 2, 0];
  it("avance par dévoilement puis par bloc, recule vers le bloc précédent entièrement dévoilé", () => {
    let p = debut();
    const vus: string[] = [];
    for (let i = 0; i < 5; i++) {
      vus.push(`${p.bloc}.${p.etape}`);
      p = suivant(p, etapes);
    }
    expect(vus).toEqual(["0.0", "1.0", "1.1", "1.2", "2.0"]);
    expect(suivant(fin(etapes), etapes)).toEqual(fin(etapes));
    expect(precedent({ bloc: 2, etape: 0 }, etapes)).toEqual({ bloc: 1, etape: 2 });
    expect(precedent(debut(), etapes)).toEqual(debut());
  });
});

describe("salle du deck synthétique", async () => {
  const { releve, medias } = relever(await deckSynthetique(), "synthetique.pptx");
  const { spec } = qualifierReleve(releve);
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
