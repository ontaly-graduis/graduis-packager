// Le papier imprimé par Chromium (PKG-D) : deux passes pour un sommaire paginé, la couche texte recettée par pdf.js —
// chaque ligne attendue retrouvée —, une page « Mes notes » par séquence, la garde sans en-tête.
import { expect, test } from "@playwright/test";
import { construirePapier } from "../src/papier/construire";
import { imprimer } from "../src/papier/imprimer";
import { normaliser, recetter } from "../src/papier/recette";
import { qualifierReleve } from "../src/qualification/qualifier";
import { relever } from "../src/releve/releve";
import { chargerTheme } from "../src/theme/theme";
import { DUREES_GRADUIS } from "../src/diagnostic/regles";
import { ETAPES_CLES, deckDActivites, deckDEcrans, deckDeCas, deckDeSchema, deckDeTableau, deckDeTextes, deckSynthetique } from "../tests/fixture";
import { PROFIL } from "../tests/procede";

const theme = chargerTheme("gabarits/theme-onet");

for (const [nom, deck] of [["synthetique", deckSynthetique], ["ecrans", deckDEcrans], ["textes", deckDeTextes], ["schema", deckDeSchema], ["cas", deckDeCas], ["tableau", deckDeTableau]] as const) {
  test(`imprime le papier « ${nom} » et retrouve chaque ligne attendue dans sa couche texte`, async () => {
    test.setTimeout(60000);
    const { releve, medias } = relever(await deck(), `${nom}.pptx`);
    const { spec } = qualifierReleve(releve, PROFIL);
    const p = await construirePapier(spec, { theme, media: (h) => { const m = medias.get(h); return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined; } });
    const i = await imprimer(p.html);
    const r = recetter(p.attendus, i.lu.pages);
    expect(r.cherches).toBeGreaterThan(0);
    expect(r.manquants).toEqual([]);
    // La garde, le sommaire, la séquence, ses notes : le sommaire porte la page où s'ouvre chaque séquence.
    const s = p.donnees.sequences[0]!;
    const page = i.lu.destinations[s.id]!;
    expect(page).toBeGreaterThanOrEqual(3);
    expect(normaliser(i.lu.pages[1]!)).toContain(normaliser(`${s.titre} ${page}`));
    expect(i.lu.pages.some((x) => x.startsWith("Mes notes"))).toBe(true);
    expect(i.passes).toBeLessThanOrEqual(3);
  });
}

test("imprime la fiche de chaque activité (ACT-1) : son repli papier, recetté, sans le corrigé d'un rappel", async () => {
  test.setTimeout(60000);
  const { releve, medias } = relever(await deckDActivites(), "activites.pptx");
  const { spec } = qualifierReleve(releve, PROFIL, DUREES_GRADUIS);
  const p = await construirePapier(spec, { theme, media: (h) => { const m = medias.get(h); return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined; } });
  const i = await imprimer(p.html);
  const r = recetter(p.attendus, i.lu.pages);
  expect(r.manquants).toEqual([]);
  const texte = normaliser(i.lu.pages.join(" "));
  for (const t of ["Activité · Classement", "Numérotez dans l'ordre", "Activité · Catégorisation", "Cochez la colonne", "Activité · Rappel", "Notez ce que vous en retenez"]) {
    expect(texte).toContain(normaliser(t));
  }
  // Les étapes clés ne sont imprimées qu'une fois : par leur bloc, pas sur la fiche du rappel qui les fait retrouver.
  expect(texte.split(normaliser(ETAPES_CLES[1])).length - 1).toBe(1);
});
