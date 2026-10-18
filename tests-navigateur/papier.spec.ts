// Le papier imprimé par Chromium (PKG-D) : deux passes pour un sommaire paginé, la couche texte recettée par pdf.js —
// chaque ligne attendue retrouvée —, une page « Mes notes » par séquence, la garde sans en-tête.
import { expect, test } from "@playwright/test";
import { construirePapier } from "../src/papier/construire";
import { imprimer } from "../src/papier/imprimer";
import { normaliser, recetter } from "../src/papier/recette";
import { qualifierReleve } from "../src/qualification/qualifier";
import { relever } from "../src/releve/releve";
import { chargerTheme } from "../src/theme/theme";
import { deckDEcrans, deckDeCas, deckDeSchema, deckDeTableau, deckDeTextes, deckSynthetique } from "../tests/fixture";

const theme = chargerTheme("gabarits/theme-onet");

for (const [nom, deck] of [["synthetique", deckSynthetique], ["ecrans", deckDEcrans], ["textes", deckDeTextes], ["schema", deckDeSchema], ["cas", deckDeCas], ["tableau", deckDeTableau]] as const) {
  test(`imprime le papier « ${nom} » et retrouve chaque ligne attendue dans sa couche texte`, async () => {
    test.setTimeout(60000);
    const { releve, medias } = relever(await deck(), `${nom}.pptx`);
    const { spec } = qualifierReleve(releve);
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
