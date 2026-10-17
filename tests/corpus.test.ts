// Témoins corpus (local, hors dépôt) : le relevé TS retrouve les mesures de `scripts/releve_pptx.py` sur le deck acheteur.
import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { stringify2 } from "../src/lib/json";
import { relever, type Releve } from "../src/releve/releve";
import { medianeMots, medianeResolution, mesurer, type Mesures } from "../src/releve/mesures";

const DECK = process.env.PKG_CORPUS ?? "docs/sources/boost acheteur areprendre v1.pptx";
const NOM = "boost acheteur areprendre v1.pptx";

describe.skipIf(!existsSync(DECK))("corpus — deck boost acheteur", () => {
  let octets: Uint8Array;
  let releve: Releve;
  let m: Mesures;
  beforeAll(() => {
    octets = new Uint8Array(readFileSync(DECK));
    releve = relever(octets, NOM).releve;
    m = mesurer(releve);
  });

  it("retrouve les mesures du relevé Python (17/10)", () => {
    expect([m.diapositives, m.dispositions, m.masques]).toEqual([166, 37, 2]);
    expect([m.mots, medianeMots(releve), m.denses.length, m.notes]).toEqual([8329, 38, 27, 16]);
    expect([m.pasAPas, m.capturesSeules, m.autres]).toEqual([61, 39, 66]);
    expect([m.pastillesSur, m.pastillesSurZone, m.pastillesHors, m.pastillesHorsTexte]).toEqual([94, 93, 137, 99]);
    expect(medianeResolution(m)).toBeCloseTo(1.24, 2);
    expect([m.resolutions.filter((r) => r < 1).length, m.resolutions.length]).toEqual([36, 113]);
    expect(m.inacheves).toEqual([[2, "a supprimer"], [16, "xxx"], [24, "insérer"], [146, "xxx"], [159, "a rédiger"]]);
    expect([m.nonWeb, m.graphiques]).toEqual([{ emf: 1 }, {}]);
  });

  it("retrouve les séquences du § 0.3", () => {
    const op = m.sequences.filter((q) => [30, 59, 68, 99, 112, 138].includes(q.n0));
    expect(op.map((q) => [q.diapositives, q.demonstrations, q.pasAPas, q.captures, q.aVousDeJouer, q.reglesDuJeu, q.etapesCles, q.mots])).toEqual([
      [29, 3, 18, 0, 1, 0, 1, 1770], [9, 0, 1, 4, 1, 1, 1, 415], [31, 0, 21, 4, 1, 1, 1, 1244],
      [13, 0, 5, 4, 0, 1, 1, 601], [26, 0, 6, 15, 0, 1, 1, 768], [23, 0, 7, 9, 0, 1, 1, 1305],
    ]);
  });

  it("apparie les pas par numéro (mesure du 17/10 : 130 pas, 101 paires, 110 complets)", () => {
    expect(m.appariement).toMatchObject({ pas: 130, paires: 101 });
    expect(m.appariement.complets).toBeGreaterThanOrEqual(110);
    expect(m.appariement.avecConsigne / m.appariement.pas).toBeGreaterThanOrEqual(0.95);
  });

  it("est déterministe sur le corpus", () => {
    expect(stringify2(relever(octets, NOM).releve)).toBe(stringify2(releve));
  });
});
