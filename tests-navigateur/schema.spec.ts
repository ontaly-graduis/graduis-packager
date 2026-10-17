// Le schéma redessiné dans un vrai navigateur : SVG au thème, textes ajustés à leurs formes, rien de distant.
import { expect, test } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { relever } from "../src/releve/releve";
import { qualifierReleve } from "../src/qualification/qualifier";
import { construireSalle } from "../src/salle/construire";
import { chargerTheme } from "../src/theme/theme";
import { deckDeSchema } from "../tests/fixture";

let url = "";

test.beforeAll(async () => {
  const { releve, medias } = relever(await deckDeSchema(), "schema.pptx");
  const { spec } = qualifierReleve(releve);
  const { html } = await construireSalle(spec, {
    prise: { devoilement: "pastille" },
    theme: chargerTheme("gabarits/theme-onet"),
    media: (h) => {
      const m = medias.get(h);
      return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined;
    },
  });
  const fichier = join(mkdtempSync(join(tmpdir(), "schema-")), "salle.html");
  writeFileSync(fichier, html);
  url = "file://" + fichier;
});

test("dessine le schéma au thème, textes dans leurs formes, sans requête ni erreur", async ({ page }) => {
  const requetes: string[] = [];
  const erreurs: string[] = [];
  page.on("request", (r) => { if (!/^(file|data|about):/.test(r.url())) requetes.push(r.url()); });
  page.on("pageerror", (e) => erreurs.push(String(e)));
  await page.goto(url + "#b002.0");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".diapo.f-schema .dessin")).toHaveCount(1);
  await expect(page.locator(".dessin foreignObject")).toHaveCount(19);
  // Les rôles prennent les valeurs du thème : marine fort = la primitive navy du DS Onet.
  const fond = await page.locator(".dessin .f-marine-fort").first().evaluate((e) => getComputedStyle(e).fill);
  expect(fond).toBe("rgb(0, 48, 88)");
  await expect(page.locator(".dessin .bt", { hasText: "Montant > seuil ?" })).toHaveCount(1);
  const debordent = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".dessin .bt")].filter((b) => {
    const r = document.createRange();
    r.selectNodeContents(b.firstElementChild!);
    const t = r.getBoundingClientRect();
    const l = b.firstElementChild!.getBoundingClientRect();
    const c = b.getBoundingClientRect();
    return t.left < c.left - 1 || t.right > c.right + 1 || l.top < c.top - 1 || l.bottom > c.bottom + 1;
  }).length);
  expect(debordent).toBe(0);
  expect(requetes).toEqual([]);
  expect(erreurs).toEqual([]);
});

test("joue le schéma pas à pas : le décor d'abord, puis chaque étape se trace", async ({ page }) => {
  await page.goto(url + "#b002.0");
  await page.evaluate(() => document.fonts.ready);
  // Six étapes, leurs six pastilles et les cinq traits qui les relient attendent leur pas.
  await expect(page.locator(".dessin g[data-pas].pas-cache")).toHaveCount(17);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".dessin g[data-pas='1'].pas-courant.trace")).toHaveCount(3);
  expect(await page.locator(".dessin g[data-pas='1'] path[pathLength='1']").count()).toBeGreaterThan(0);
  await expect(page.locator(".dessin g[data-pas].pas-cache")).toHaveCount(14);
  await page.keyboard.press("End");
  await expect(page.locator(".dessin g[data-pas].pas-cache")).toHaveCount(0);
});
