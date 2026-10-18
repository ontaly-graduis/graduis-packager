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
import { deckDEcrans } from "../tests/fixture";

let url = "";

test.beforeAll(async () => {
  const { releve, medias } = relever(await deckDEcrans(), "ecrans.pptx");
  const { spec } = qualifierReleve(releve);
  const { html, nonAffichables } = await construireSalle(spec, {
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
  url = "file://" + fichier;
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
