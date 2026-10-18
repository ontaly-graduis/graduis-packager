// Les visuels d'origine dans la salle (PKG-B6) : le pictogramme d'un écran dans son disque, le minuteur dans la puce
// des minutes, la galerie d'une météo, le pictogramme d'une mise en pratique sur son aplat, l'icône de section en tête.
import { expect, test } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { relever } from "../src/releve/releve";
import { qualifierReleve } from "../src/qualification/qualifier";
import { construireSalle } from "../src/salle/construire";
import { chargerTheme } from "../src/theme/theme";
import type { SeanceSpec } from "../src/pivot/seance-spec";
import { deckDEcrans } from "../tests/fixture";

let url = "";
let urlAplat = "";

test.beforeAll(async () => {
  const { releve, medias } = relever(await deckDEcrans(), "ecrans.pptx");
  const { spec } = qualifierReleve(releve);
  const ecrire = async (s: SeanceSpec) => {
    const { html, nonAffichables } = await construireSalle(s, {
      prise: { devoilement: "pastille" },
      theme: chargerTheme("gabarits/theme-onet"),
      media: (h) => {
        const m = medias.get(h);
        return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined;
      },
    });
    expect(nonAffichables).toEqual([]);
    const fichier = join(mkdtempSync(join(tmpdir(), "visuels-")), "salle.html");
    writeFileSync(fichier, html);
    return "file://" + fichier;
  };
  url = await ecrire(spec);
  // Le pictogramme blanc de la mise en pratique, reposé sur l'ambre pâle, qui le noie (1,1:1).
  const aplat = structuredClone(spec);
  for (const b of aplat.sequences.flatMap((q) => q.blocs)) {
    for (const v of b.visuels) if (b.figure === "mise-en-pratique" && v.role === "pictogramme") v.fond = "ambre-pale";
  }
  urlAplat = await ecrire(aplat);
});

test("montre les visuels du diaporama d'origine, chacun à sa place", async ({ page }) => {
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(String(e)));
  await page.goto(url + "#b001.0");
  await expect(page.locator(".photo-couverture")).toHaveCount(1);
  await page.goto(url + "#b002.0");
  await expect(page.locator(".ecran .disque img")).toHaveAttribute("src", /^data:image\/svg\+xml;base64,/);
  await expect(page.locator(".puce.duree .icone-duree")).toHaveCount(1);
  await expect(page.locator(".puce.duree")).toHaveText("15 minutes");
  // La ligne « 15 minutes » n'est pas répétée hors de la puce.
  await expect(page.locator(".texte-ecran p")).toHaveCount(0);
  await page.goto(url + "#b003.0");
  await expect(page.locator(".galerie figcaption")).toHaveText(["Grand soleil", "Nuageux", "Orageux"]);
  await page.goto(url + "#b004.0");
  const fond = await page.locator(".pictogramme-cote .disque").evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(fond).toBe("rgb(210, 0, 26)");
  await page.goto(url + "#b005.0");
  await expect(page.locator(".entete .titre-entete img.section")).toHaveCount(1);
  expect(erreurs).toEqual([]);
});

test("rend lisible un pictogramme que son aplat noie : le ton le plus proche de sa famille qui le porte à 3:1", async ({ page }) => {
  await page.goto(urlAplat + "#b004.0");
  const disque = page.locator(".pictogramme-cote .disque");
  await expect(disque).toHaveAttribute("data-fond", "ambre-pale");
  // L'ambre moyen n'y suffit pas (2,1:1) ; l'ambre fort, le thème #b26a00, le porte (4,2:1).
  await expect.poll(() => disque.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(178, 106, 0)");
});
