// Témoins de la qualification et du diagnostic : figures, pas en % de capture, zones proposées, rapport, déterminisme.
import { describe, expect, it } from "vitest";
import { stringify2 } from "../src/lib/json";
import { relever, type Releve } from "../src/releve/releve";
import { qualifierReleve } from "../src/qualification/qualifier";
import { SeanceSpec, blocsDe } from "../src/pivot/seance-spec";
import { diagnostiquer } from "../src/diagnostic/regles";
import { rapportHtml } from "../src/diagnostic/rapport-html";
import { chargerTheme } from "../src/theme/theme";
import { CONSIGNES, deckSynthetique } from "./fixture";
import { CADRE, ONET, PROFIL } from "./procede";

const POUCE = 914400;
const p = (v: number) => Math.round(v * POUCE);

describe("qualification du deck synthétique", async () => {
  const { releve } = relever(await deckSynthetique(), "synthetique.pptx");
  const { spec, qualifications } = qualifierReleve(releve, PROFIL);
  const blocs = blocsDe(spec);

  it("produit un seance-spec valide, un bloc par diapositive", () => {
    expect(() => SeanceSpec.parse(spec)).not.toThrow();
    expect(blocs.map((b) => [b.id, b.figure])).toEqual([["b001", "couverture"], ["b002", "pas-a-pas"], ["b003", "contenu"]]);
    expect(qualifications.get(2)?.signal).toBe("capture et 2 pas numérotés");
  });

  it("ramène les zones en pourcentage de la capture et garde les consignes hors des textes", () => {
    const b = blocs[1]!;
    expect(b.pas.map((x) => [x.numero, x.ancrage, x.consigne])).toEqual([[1, "repere", CONSIGNES[0]], [2, "repere", CONSIGNES[1]]]);
    expect(b.pas[0]!.zone).toEqual([18.33, 18.33, 25, 13.33]);
    expect(b.textes).toEqual([]);
    expect(b.notes).toBe("Durée : 10 min");
  });

  it("diagnostique : le marqueur d'inachèvement est bloquant, le rapport n'a aucun hex hors jetons", () => {
    const r = diagnostiquer(spec, releve, qualifications, CADRE);
    expect(r.constats.filter((k) => k.niveau === "bloquant")).toEqual([
      { regle: "H8", niveau: "bloquant", diapo: 3, sequence: "s001", message: "Marqueur « A rédiger »." },
    ]);
    const html = rapportHtml(r, chargerTheme("gabarits/theme-onet"), ONET.procede.charte);
    const horsJetons = html.slice(html.indexOf("</style>"));
    expect(horsJetons).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(html).toContain("Rapport d'anomalies et d'équilibrage");
  });

  it("est déterministe : deux qualifications du même relevé sont identiques à l'octet", () => {
    expect(stringify2(qualifierReleve(releve, PROFIL).spec)).toBe(stringify2(spec));
  });
});

describe("zones proposées par ordre de lecture (décision du 17/10)", () => {
  // Une capture, deux zones libres, deux légendes sans repère : la zone du haut va au pas 1, celle du bas au pas 2.
  // (Diapositive 2 : la première serait qualifiée « couverture ».)
  const capture = "sha256:" + "a".repeat(64);
  const releve: Releve = {
    schema: "graduis/releve@0",
    deck: { nom: "essai.pptx", empreinte: "sha256:" + "b".repeat(64), largeur: p(10), hauteur: p(5.625), masques: 1 },
    medias: { [capture]: { ext: "png", octets: 1, px: [2000, 1000] } },
    diapositives: [{
      n: 2, masquee: false, disposition: "Vide", notes: "", liens: [],
      formes: [
        { id: 2, nom: "capture", nature: "image", boite: [p(1), p(1), p(6), p(3)], media: capture },
        { id: 3, nom: "zone bas", nature: "forme", boite: [p(2), p(3), p(2), p(0.5)], sansRemplissage: true, texte: [] },
        { id: 4, nom: "zone haut", nature: "forme", boite: [p(4), p(1.5), p(2), p(0.5)], sansRemplissage: true, texte: [] },
      ],
      pas_a_pas: { pas: [
        { numero: 2, capture, repere: null, zone: null, legende: [p(7.5), p(3), p(0.3), p(0.3)], consigne: "Valider" },
        { numero: 1, capture, repere: null, zone: null, legende: [p(7.5), p(2), p(0.3), p(0.3)], consigne: "Ouvrir le menu" },
      ] },
    }],
  };

  it("attribue les zones libres aux pas sans zone, marquées « proposee »", () => {
    const pas = blocsDe(qualifierReleve(releve, PROFIL).spec)[0]!.pas;
    const parNumero = new Map(pas.map((x) => [x.numero, x]));
    expect(parNumero.get(1)).toMatchObject({ ancrage: "proposee", zone: [50, 16.67, 33.33, 16.67] });
    expect(parNumero.get(2)).toMatchObject({ ancrage: "proposee", zone: [16.67, 66.67, 33.33, 16.67] });
  });
});
