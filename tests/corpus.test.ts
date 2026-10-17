// Témoins corpus (local, hors dépôt) : le relevé TS retrouve les mesures de `scripts/releve_pptx.py` sur le deck acheteur.
import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { stringify2 } from "../src/lib/json";
import { relever, type Releve } from "../src/releve/releve";
import { medianeMots, medianeResolution, mesurer, type Mesures } from "../src/releve/mesures";
import { qualifierReleve } from "../src/qualification/qualifier";
import { diagnostiquer, type Rapport } from "../src/diagnostic/regles";
import type { SeanceSpec } from "../src/pivot/seance-spec";
import { GEOMETRIES } from "../src/dessin/geometries";

const DECK = process.env.PKG_CORPUS ?? "docs/sources/boost acheteur areprendre v1.pptx";
const NOM = "boost acheteur areprendre v1.pptx";

describe.skipIf(!existsSync(DECK))("corpus — deck boost acheteur", () => {
  let octets: Uint8Array;
  let releve: Releve;
  let m: Mesures;
  let spec: SeanceSpec;
  let rapport: Rapport;
  beforeAll(() => {
    octets = new Uint8Array(readFileSync(DECK));
    releve = relever(octets, NOM).releve;
    m = mesurer(releve);
    const q = qualifierReleve(releve);
    spec = q.spec;
    rapport = diagnostiquer(spec, releve, q.qualifications);
  });

  it("qualifie les 166 diapositives (mesure du 17/10)", () => {
    expect(rapport.synthese.figures).toEqual({
      couverture: 1, "ecran-animation": 10, transition: 13, objectifs: 1, contenu: 15, processus: 1, schema: 7,
      demonstration: 3, "pas-a-pas": 61, capture: 37, "mise-en-pratique": 8, "etapes-cles": 6, synthese: 1, glossaire: 1, renvoi: 1,
    });
    const op = rapport.sequences.filter((l) => l.operatoire && l.temps.R && l.temps["R*"]).map((l) => l.id);
    expect(op).toEqual(["s030", "s059", "s068", "s099", "s112", "s138"]);
  });

  it("ancre les pas : 130 relevés, au moins 127 avec une zone, dont les zones proposées", () => {
    const pas = rapport.synthese.pas;
    expect(pas.total).toBe(130);
    expect(pas.total - pas.sansZone).toBeGreaterThanOrEqual(127);
    expect(pas.proposee).toBeGreaterThan(0);
  });

  it("retrouve les anomalies du § 0.3 au rapport", () => {
    const de = (regle: string) => rapport.constats.filter((k) => k.regle === regle);
    expect(de("H8").map((k) => k.diapo)).toEqual([2, 16, 24, 146, 159]);
    expect(de("H6").map((k) => k.diapo)).toEqual([95]);
    expect(de("H4")).toHaveLength(1);
    expect(de("H1").filter((k) => k.niveau === "info")).toHaveLength(6);
  });

  it("redessine les 7 schémas : un dessin chacun, géométries prises en charge, aucune couleur au pivot (PKG-B2)", () => {
    const schemas = spec.sequences.flatMap((s) => s.blocs).filter((b) => b.figure === "schema");
    expect(schemas.map((b) => b.source.diapo)).toEqual([15, 16, 17, 18, 19, 20, 31]);
    expect(schemas.every((b) => (b.dessin?.elements.length ?? 0) >= 20)).toBe(true);
    const geometries = new Set(schemas.flatMap((b) => b.dessin!.elements.flatMap((e) => (e.type === "forme" ? [e.geometrie] : []))));
    for (const g of geometries) expect([...GEOMETRIES, "libre"]).toContain(g);
    expect(JSON.stringify(schemas.map((b) => b.dessin))).not.toMatch(/"[0-9A-Fa-f]{6}"/);
    expect(rapport.constats.filter((x) => x.regle === "DESSIN" && x.niveau === "info")).toHaveLength(7);
    // Aucune couleur confondue, aucune géométrie de repli ; à valider : les dévoilements proposés et les recompositions.
    const aValider = rapport.constats.filter((x) => x.regle === "DESSIN" && x.niveau === "a-valider");
    expect(aValider.filter((x) => /^(Couleurs|Dessinées)/.test(x.message))).toHaveLength(0);
    expect(aValider.filter((x) => x.message.startsWith("Dévoilement")).map((x) => x.diapo)).toEqual([17, 18, 19, 20, 31]);
  });

  it("organise les textes : étapes clés dans l'ordre de leurs numéros, définitions, fiches illustrées (PKG-B3)", () => {
    const bloc = (n: number) => spec.sequences.flatMap((s) => s.blocs).find((b) => b.source.diapo === n)!;
    const noeuds = (n: number) => bloc(n).structure!.rangees.flatMap((r) => r.colonnes.flatMap((c) => c.noeuds));
    const etapes = noeuds(58)[0]!;
    expect(etapes.type === "liste" && etapes.numerotee && etapes.items.map((i) => i.texte.split(" ")[0])).toEqual(["Accéder", "Vérifier", "Consolider/transformer", "Soumettre"]);
    expect(noeuds(140).map((x) => x.type)).toEqual(["definitions"]);
    expect(bloc(7).structure!.rangees.map((r) => r.colonnes.length)).toEqual([1, 2, 1]);
    expect(bloc(21).structure!.rangees.map((r) => r.colonnes.map((c) => !!c.visuel))).toEqual([[true], [true], [true], [true]]);
  });

  it("partitionne les schémas : colonnes rangées par leurs numéros, logigramme par ses étapes (PKG-B3)", () => {
    const partition = (n: number) => spec.sequences.flatMap((s) => s.blocs).find((b) => b.source.diapo === n)!.dessin!.partition;
    expect([15, 16, 17, 18, 19, 20, 31].map(partition)).toEqual([
      undefined, undefined,
      { mode: "colonnes", pas: 4 }, { mode: "colonnes", pas: 4 }, { mode: "colonnes", pas: 4 }, { mode: "colonnes", pas: 4 },
      { mode: "etapes", pas: 9 },
    ]);
  });

  it("recompose les processus en phases au gabarit « cas » du wizard (PKG-B4)", () => {
    const bloc = (n: number) => spec.sequences.flatMap((s) => s.blocs).find((b) => b.source.diapo === n)!;
    const lu = (n: number) => {
      const c = bloc(n).composition;
      return c?.gabarit === "cas" ? { phases: c.cas.map((k) => [k.numero, k.etapes.length, k.etapes.filter((e) => e.detail).length]), legende: c.legende?.length ?? 0 } : null;
    };
    expect(lu(17)).toEqual({ phases: [[1, 6, 0], [2, 6, 0], [3, 5, 0], [4, 6, 0]], legende: 3 });
    expect(lu(18)).toEqual({ phases: [[1, 6, 6], [2, 6, 6], [3, 5, 5], [4, 6, 6]], legende: 4 });
    // Les personae (couloirs × phases) et le logigramme ne sont pas des cas.
    expect([19, 20, 31].map(lu)).toEqual([null, null, null]);
    expect(rapport.constats.filter((c) => c.regle === "DESSIN" && c.message.startsWith("Recomposé")).map((c) => c.diapo)).toEqual([17, 18]);
  });

  it("qualifie de façon déterministe", () => {
    expect(stringify2(qualifierReleve(relever(octets, NOM).releve).spec)).toBe(stringify2(spec));
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
