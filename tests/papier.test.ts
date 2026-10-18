// Témoins du papier (PKG-D) : ce qui va au papier et ce qui n'y va pas, l'oracle de la recette, la normalisation de la
// couche texte, les captures sous-résolues, et la page elle-même (déterminisme, 0 hex hors jetons, aucune ressource distante).
import { describe, expect, it } from "vitest";
import { construirePapier } from "../src/papier/construire";
import { mettreSurPapier, textesAttendus } from "../src/papier/donnees";
import { normaliser, recetter } from "../src/papier/recette";
import { SeanceSpec } from "../src/pivot/seance-spec";
import { qualifierReleve } from "../src/qualification/qualifier";
import { relever } from "../src/releve/releve";
import { chargerTheme } from "../src/theme/theme";
import { CONSIGNES, deckDEcrans, deckDeTableau, deckSynthetique } from "./fixture";

const theme = chargerTheme("gabarits/theme-onet");

async function pivot(deck: Uint8Array, nom: string) {
  const { releve, medias } = relever(deck, nom);
  const spec = SeanceSpec.parse(qualifierReleve(releve).spec);
  const media = (h: string) => { const m = medias.get(h); return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined; };
  return { spec, media, px: (h: string) => releve.medias[h]?.px ?? null };
}

describe("la mise sur papier", () => {
  it("garde la couverture, écarte les écrans d'animation, met tout le reste à l'état final", async () => {
    const { spec, px } = await pivot(await deckDEcrans(), "e.pptx");
    const d = mettreSurPapier(spec, px);
    const figures = d.sequences.flatMap((s) => s.blocs.map((b) => b.figure));
    expect(d.titre).toBe("Campus Onet");
    expect(figures).not.toContain("ecran-animation");
    expect(figures).toEqual(["mise-en-pratique", "contenu"]);
    expect(d.sequences.flatMap((s) => s.blocs).every((b) => b.etapes === 0)).toBe(true);
    const attendus = textesAttendus(d);
    expect(attendus).toContain("Créer une commande à partir d'une demande d'achat validée.");
    expect(attendus).not.toContain("Emargement");
  });

  it("renvoie synthèse et glossaire en annexe ; le glossaire y reste quand on n'imprime qu'une séquence", async () => {
    const { spec, px } = await pivot(await deckDEcrans(), "e.pptx");
    const blocs = spec.sequences.flatMap((s) => s.blocs);
    const objectifs = blocs.find((b) => b.figure === "contenu")!;
    const pratique = blocs.find((b) => b.figure === "mise-en-pratique")!;
    const modifie = SeanceSpec.parse({ ...spec, sequences: spec.sequences.map((s) => ({ ...s, blocs: s.blocs.map((b) => (b === objectifs ? { ...b, figure: "glossaire" } : b === pratique ? { ...b, figure: "synthese" } : b)) })) });
    const tout = mettreSurPapier(modifie, px);
    expect(tout.annexes.map((b) => b.figure)).toEqual(["synthese", "glossaire"]);
    expect(tout.sequences.flatMap((s) => s.blocs.map((b) => b.figure))).not.toContain("glossaire");
    // Le glossaire seul dans une seconde séquence : n'imprimer qu'elle ne garde que lui, en annexe.
    const [s1] = modifie.sequences;
    const glossaire = s1!.blocs.find((b) => b.figure === "glossaire")!;
    const deux = SeanceSpec.parse({ ...modifie, sequences: [{ id: "s001", blocs: s1!.blocs.filter((b) => b !== glossaire) }, { id: "s002", blocs: [glossaire] }] });
    const extrait = mettreSurPapier(deux, px, ["s002"]);
    expect(extrait.sequences).toEqual([]);
    expect(extrait.annexes.map((b) => b.figure)).toEqual(["glossaire"]);
    expect(extrait.titre).toBe("Campus Onet");
  });

  it("met dans l'oracle les consignes d'un pas-à-pas et les textes d'une composition", async () => {
    const s = await pivot(await deckSynthetique(), "s.pptx");
    expect(textesAttendus(mettreSurPapier(s.spec, s.px))).toEqual(expect.arrayContaining([...CONSIGNES]));
    const t = await pivot(await deckDeTableau(), "t.pptx");
    const attendus = textesAttendus(mettreSurPapier(t.spec, t.px));
    expect(attendus).toEqual(expect.arrayContaining(["Demande soumise", "Réception", "Messagerie", "Impact fort"]));
  });
});

describe("la recette de la couche texte", () => {
  it("neutralise espaces, césures, ligatures, ponctuation et casse imposée", () => {
    expect(normaliser("Le ﬁchier « Commandes » — à TRAITER")).toBe(normaliser("le fichier commandes à traiter"));
    expect(normaliser("S U P P O R T PA R T I C I PA N T")).toBe("supportparticipant");
    expect(normaliser("trans-\nformation")).toBe("transformation");
  });

  it("compte ce qu'elle cherche : une ligne vide n'est pas cherchée, une ligne coupée par un saut de page se recoud", () => {
    const r = recetter(["Cliquer sur « Publier »", " — ", "Vérifier la ligne de la DA", "Absente du PDF"], ["…cliquer sur publier. Vérifier la li", "gne de la DA…"]);
    expect(r).toEqual({ cherches: 3, trouves: 2, manquants: ["Absente du PDF"] });
  });
});

describe("la page du papier", () => {
  it("est déterministe, ne cite aucune couleur hors des jetons, ne charge rien de distant", async () => {
    const { spec, media } = await pivot(await deckDeTableau(), "t.pptx");
    const a = await construirePapier(spec, { theme, media });
    const b = await construirePapier(spec, { theme, media });
    expect(a.html).toBe(b.html);
    const horsTheme = a.html.replace(/<style id="theme">[\s\S]*?<\/style>/, "").replace(/data:[^"')]+/g, "");
    expect(horsTheme.match(/#[0-9a-fA-F]{6}\b/g) ?? []).toEqual([]);
    expect(a.html).not.toMatch(/(src|href)="https?:/);
    expect(a.nonAffichables).toEqual([]);
  });

  it("signale une capture qui s'imprimerait sous 150 ppp, sans l'écarter", async () => {
    const { spec, media } = await pivot(await deckSynthetique(), "s.pptx");
    const petite = (h: string) => { const m = media(h); return m && m.px ? { ...m, px: [800, 400] as const } : m; };
    const p = await construirePapier(spec, { theme, media: petite });
    expect(p.sousResolues).toEqual([{ bloc: "b002", media: expect.stringMatching(/^sha256:/), ppp: 114 }]);
    expect(p.html).toContain(p.sousResolues[0]!.media);
    expect((await construirePapier(spec, { theme, media })).sousResolues).toEqual([]);
  });
});
