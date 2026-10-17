// La salle du deck synthétique dans un vrai navigateur : aucune requête réseau, dévoilement, zoom, présentateur.
import { expect, test } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { relever } from "../src/releve/releve";
import { qualifierReleve } from "../src/qualification/qualifier";
import { construireSalle } from "../src/salle/construire";
import { chargerTheme } from "../src/theme/theme";
import { deckSynthetique } from "../tests/fixture";

let url = "";

test.beforeAll(async () => {
  const { releve, medias } = relever(await deckSynthetique(), "synthetique.pptx");
  const { spec } = qualifierReleve(releve);
  const { html } = await construireSalle(spec, {
    prise: { devoilement: "pastille" },
    theme: chargerTheme("gabarits/theme-onet"),
    media: (h) => {
      const m = medias.get(h);
      return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined;
    },
  });
  const fichier = join(mkdtempSync(join(tmpdir(), "salle-")), "salle.html");
  writeFileSync(fichier, html);
  url = "file://" + fichier;
});

test("joue hors ligne : aucune requête réseau, aucune erreur", async ({ page }) => {
  const requetes: string[] = [];
  const erreurs: string[] = [];
  page.on("request", (r) => { if (!/^(file|data|about):/.test(r.url())) requetes.push(r.url()); });
  page.on("pageerror", (e) => erreurs.push(String(e)));
  await page.goto(url);
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
  expect(requetes).toEqual([]);
  expect(erreurs).toEqual([]);
});

test("dévoile le pas-à-pas pastille par pastille, et zoome sur la zone courante", async ({ page }) => {
  await page.goto(url + "#b002.0");
  await expect(page.locator(".zone")).toHaveCount(0);
  await expect(page.locator(".consignes li.cache")).toHaveCount(2);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#b002\.1$/);
  await expect(page.locator(".zone .num")).toHaveText("1");
  await expect(page.locator(".consignes li.courant")).toContainText("Cliquer sur le menu");
  await page.keyboard.press("z");
  await expect(page.locator(".capture .plan")).toHaveAttribute("style", /scale\(/);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/#b001\.0$/);
});

test("ouvre le présentateur, qui pilote la salle", async ({ page }) => {
  await page.goto(url + "#b001.0");
  const [presentateur] = await Promise.all([page.waitForEvent("popup"), page.keyboard.press("p")]);
  await expect(presentateur.locator("#courante .diapo")).toHaveCount(1);
  await presentateur.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#b002\.0$/);
  await expect(presentateur.locator("#position")).toContainText("2 / 3");
});
