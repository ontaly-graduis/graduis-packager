// Témoins de l'organisation des textes et des schémas joués (PKG-B3) : dévoilement par niveau 1, partition, manière.
import { describe, expect, it } from "vitest";
import type { Dessin, Structure } from "../src/pivot/seance-spec";
import { qualifierReleve } from "../src/qualification/qualifier";
import { relever } from "../src/releve/releve";
import { planDeDevoilement } from "../src/salle/unites";
import { habiller, type Maniere } from "../src/theme/maniere";
import { composerCas, composerTableau } from "../src/qualification/gabarits";
import { deckDeCas, deckDeSchema, deckDeTableau } from "./fixture";

describe("le dévoilement par niveau de hiérarchie 1", () => {
  it("une fiche paraît entière, une section avec son intertitre, hors section chaque élément seul", () => {
    const s: Structure = {
      rangees: [
        { colonnes: [{ noeuds: [{ type: "definitions", entrees: [{ terme: "Durée", texte: "2 jours" }, { terme: "Lieu", texte: "Siège" }] }] }] },
        { colonnes: [{ noeuds: [{ type: "titre", texte: "Jour 1" }, { type: "liste", items: [{ texte: "a" }, { texte: "b" }] }] }, { noeuds: [{ type: "paragraphe", texte: "Jour 2" }] }] },
        { colonnes: [{ noeuds: [
          { type: "titre", texte: "Avant" }, { type: "titre", texte: "Ligne" }, { type: "liste", items: [{ texte: "c", details: ["d"] }] },
          { type: "titre", texte: "Échéancier" }, { type: "paragraphe", texte: "e" },
        ] }] },
      ],
    };
    // Définitions : 0, 1 ; fiches : 2 (titre, a, b), 3 ; sections : 4 (Avant, Ligne, c), 5 (Échéancier, e).
    expect(planDeDevoilement(s)).toEqual({ total: 6, atomes: [0, 1, 2, 2, 2, 3, 4, 4, 4, 5, 5] });
  });
});

describe("le schéma synthétique joué par ses pastilles", async () => {
  const { releve } = relever(await deckDeSchema(), "schema.pptx");
  const dessin = qualifierReleve(releve).spec.sequences.flatMap((s) => s.blocs).find((b) => b.source.diapo === 2)!.dessin!;

  it("se partitionne par ses six pastilles numérotées : chaque étape, sa pastille et le trait qui en part", () => {
    expect(dessin.partition).toEqual({ mode: "etapes", pas: 6 });
    const pasDe = (geometrie: string) => dessin.elements.filter((e) => e.type === "forme" && e.geometrie === geometrie).map((e) => (e.type === "forme" ? e.pas : null));
    expect(pasDe("roundRect")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(pasDe("line")).toEqual([1, 2, 3, 4, 5]);
    expect(dessin.elements.filter((e) => e.type === "forme" && e.marque === "pastille")).toHaveLength(6);
    // Le cadre de fond et la décision, sans numéro ni trait qui y mène, sont le décor.
    expect(dessin.elements.find((e) => e.type === "forme" && e.geometrie === "diamond")?.pas).toBeUndefined();
  });

  it("prend la manière du thème : coins droits, deux épaisseurs, trois corps", () => {
    const maniere: Maniere = { schema: { coins: "droits", traits: { fin: 0.75, appuye: 1.5, seuil: 1.25 }, corps: { titre: 1.3, libelle: 0.82, tolerance: 0.2 }, pastilles: "badge-etape" } };
    const h: Dessin = habiller(dessin, maniere);
    const formes = h.elements.filter((e) => e.type === "forme");
    expect(formes.some((e) => e.type === "forme" && e.geometrie === "roundRect")).toBe(false);
    expect(new Set(formes.flatMap((e) => (e.type === "forme" && e.trait ? [e.trait.largeur] : [])))).toEqual(new Set([0.75]));
    const corps = new Set(formes.flatMap((e) => (e.type === "forme" && e.texte ? e.texte.paragraphes.flatMap((p) => p.fragments.map((f) => f.taille)) : [])));
    expect(corps.size).toBeLessThanOrEqual(3);
  });
});

describe("le processus en phases recomposé au gabarit « cas » du wizard (PKG-B4)", async () => {
  const { releve } = relever(await deckDeCas(), "cas.pptx");
  const bloc = qualifierReleve(releve).spec.sequences.flatMap((s) => s.blocs).find((b) => b.source.diapo === 2)!;

  it("se partitionne en colonnes rangées par les numéros de leurs bandeaux, la pastille débordante comprise", () => {
    expect(bloc.figure).toBe("schema");
    expect(bloc.dessin?.partition).toEqual({ mode: "colonnes", pas: 3 });
  });

  it("se lit en cas : bandeaux, étapes numérotées à leur manière, description, légende", () => {
    const c = bloc.composition;
    expect(c?.gabarit).toBe("cas");
    if (c?.gabarit !== "cas") return;
    expect(c.cas.map((k) => [k.numero, k.titre])).toEqual([[1, "Fournisseur"], [2, "Contrat"], [3, "Commande"]]);
    expect(c.cas.every((k) => k.couleur)).toBe(true);
    for (const [i, k] of c.cas.entries()) {
      expect(k.etapes.map((e) => [e.numero, e.texte])).toEqual([1, 2, 3].map((j) => [j, `Étape ${i + 1}.${j}`]));
      expect(k.etapes.map((e) => e.bord)).toEqual(["plein", "tirets", "plein"]);
      expect(k.etapes.map((e) => e.detail)).toEqual([undefined, undefined, `Ce que fait l'étape ${i + 1}.3`]);
    }
    expect(c.legende?.map((l) => [l.texte, l.bord])).toEqual([["Tâche réalisée dans l'ERP", "aucun"], ["Actions automatiques", "tirets"]]);
    expect(c.legende?.[0]?.fond).toBe(c.cas[2]!.couleur);
  });

  it("ne recompose pas un logigramme joué par étapes", async () => {
    const { releve: r } = relever(await deckDeSchema(), "schema.pptx");
    const b = qualifierReleve(r).spec.sequences.flatMap((s) => s.blocs).find((x) => x.source.diapo === 2)!;
    expect(b.composition).toBeUndefined();
    expect(composerCas(b.dessin!)).toBeNull();
  });
});

describe("la fiche persona en couloirs recomposée au gabarit « tableau » du wizard (PKG-B5)", async () => {
  const { releve } = relever(await deckDeTableau(), "tableau.pptx");
  const bloc = qualifierReleve(releve).spec.sequences.flatMap((s) => s.blocs).find((b) => b.source.diapo === 2)!;
  const t = bloc.composition;

  it("lit les phases à leur couleur et les couloirs avec leur signe", () => {
    expect(t?.gabarit).toBe("tableau");
    if (t?.gabarit !== "tableau") return;
    expect(t.colonnes.map((k) => k.titre)).toEqual(["Réception", "Traitement", "Validation"]);
    expect(t.colonnes.every((k) => k.couleur)).toBe(true);
    expect(t.lignes.map((l) => [l.titre, l.signe?.elements.length])).toEqual([["Système A", 1], ["Système B", 1], ["Système C", 1], ["Messagerie", 1]]);
    expect(t.illustration?.elements.map((e) => e.type)).toEqual(["image"]);
  });

  it("place chaque étape par la pastille qu'elle désigne, avec son numéro, sa manière et son signal", () => {
    if (t?.gabarit !== "tableau") return;
    expect(t.etapes.map((e) => [e.colonne, e.ligne, e.numero ?? null, e.texte])).toEqual([
      [0, 2, 1, "Demande soumise"], [0, 0, 2, "Données enrichies"],
      [1, 1, 1, "Analyse de la fiche"], [1, 1, 2, "Complétion de la fiche"],
      [2, 3, 1, "Information du demandeur"], [2, 0, 2, "Contrôle bancaire"], [2, 2, null, "Provisions générées"],
    ]);
    expect(t.etapes[0]).toMatchObject({ bord: "tirets", signal: "rouge-fort" });
    expect(t.etapes[1]).toMatchObject({ bord: "aucun", signal: "vert-moyen" });
    // Les cases d'abord, puis les signaux ; et chaque entrée nomme une manière ou un signal des étapes.
    expect(t.legende?.map((l) => [l.texte, l.forme ?? "case"])).toEqual([
      ["Tâche automatique", "case"], ["Tâche d'un tiers", "case"], ["Impact léger", "triangle"], ["Impact fort", "triangle"],
    ]);
  });

  it("ne lit en tableau ni un cas ni un logigramme, ni en cas une fiche en couloirs", async () => {
    expect(composerCas(bloc.dessin!)).toBeNull();
    const cas = qualifierReleve(relever(await deckDeCas(), "cas.pptx").releve).spec.sequences.flatMap((s) => s.blocs).find((b) => b.source.diapo === 2)!;
    expect(composerTableau(cas.dessin!)).toBeNull();
    const schema = qualifierReleve(relever(await deckDeSchema(), "schema.pptx").releve).spec.sequences.flatMap((s) => s.blocs).find((b) => b.source.diapo === 2)!;
    expect(composerTableau(schema.dessin!)).toBeNull();
  });
});

