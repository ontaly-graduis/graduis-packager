// La fiche persona recomposée au gabarit « tableau » (PKG-B5), dans un vrai navigateur : couloirs sous des phases, dévoilées
// une à une, les liens tracés d'une étape numérotée à la suivante, le tout tenu dans sa page.
import { expect, test } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { relever } from "../src/releve/releve";
import { qualifierReleve } from "../src/qualification/qualifier";
import { construireSalle } from "../src/salle/construire";
import { chargerTheme } from "../src/theme/theme";
import { deckDeTableau } from "../tests/fixture";

let url = "";

test.beforeAll(async () => {
  const { releve, medias } = relever(await deckDeTableau(), "tableau.pptx");
  const { spec } = qualifierReleve(releve);
  const { html } = await construireSalle(spec, {
    prise: { devoilement: "pastille" },
    theme: chargerTheme("gabarits/theme-onet"),
    media: (h) => {
      const m = medias.get(h);
      return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined;
    },
  });
  const fichier = join(mkdtempSync(join(tmpdir(), "tableau-")), "salle.html");
  writeFileSync(fichier, html);
  url = "file://" + fichier;
});

test("compose le tableau au thème, le dévoile phase par phase et relie les étapes numérotées", async ({ page }) => {
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(String(e)));
  await page.goto(url + "#b002.0");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".diapo.f-schema .tab")).toHaveCount(1);
  await expect(page.locator(".tab-phase-titre")).toHaveText(["Réception", "Traitement", "Validation"]);
  await expect(page.locator(".tab-ligne-titre")).toHaveText(["Système A", "Système B", "Système C", "Messagerie"]);
  await expect(page.locator(".tab-signe svg")).toHaveCount(4);
  await expect(page.locator(".tab-illustration image")).toHaveCount(1);
  await expect(page.locator(".tab-etape")).toHaveCount(7);
  await expect(page.locator(".tab-etape .cas-numero")).toHaveCount(6);
  await expect(page.locator(".tab-etape .signal")).toHaveCount(6);
  await expect(page.locator(".cas-legende li")).toHaveCount(4);
  // Une étape va à la case de son couloir et de sa phase.
  const caseDe = (texte: string) => page.locator(".tab-case", { hasText: texte }).evaluate((c) => [(c as HTMLElement).style.gridRow, (c as HTMLElement).style.gridColumn]);
  expect(await caseDe("Demande soumise")).toEqual(["4", "2"]);
  expect(await caseDe("Contrôle bancaire")).toEqual(["2", "4"]);
  // Un lien par étape numérotée qui en suit une autre ; tous tracés, cachés avec leur phase.
  await expect(page.locator(".tab-lien")).toHaveCount(3);
  expect(await page.locator(".tab-lien").evaluateAll((ls) => ls.every((l) => /^M[\d.]+ [\d.]+L[\d.]+ [\d.]+$/.test(l.getAttribute("d") ?? "")))).toBe(true);
  await expect(page.locator(".tab-case.cache")).toHaveCount(6);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".tab-phase.cache")).toHaveCount(2);
  await expect(page.locator(".tab-case.apparait")).toHaveCount(2);
  await expect(page.locator(".tab-lien.trace")).toHaveCount(1);
  await page.keyboard.press("End");
  await expect(page.locator(".tab-case.cache")).toHaveCount(0);
  const tient = await page.evaluate(() => { const c = document.querySelector<HTMLElement>(".tab")!; return c.scrollHeight <= c.clientHeight + 1 && c.scrollWidth <= c.clientWidth + 1; });
  expect(tient).toBe(true);
  expect(erreurs).toEqual([]);
});
