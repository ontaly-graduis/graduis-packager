// Le processus en phases recomposé au gabarit « cas » (PKG-B4), dans un vrai navigateur : colonnes en regard, dévoilées
// une à une, le tout tenu dans sa page.
import { expect, test } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { relever } from "../src/releve/releve";
import { qualifierReleve } from "../src/qualification/qualifier";
import { construireSalle } from "../src/salle/construire";
import { chargerTheme } from "../src/theme/theme";
import { deckDeCas } from "../tests/fixture";

let url = "";

test.beforeAll(async () => {
  const { releve, medias } = relever(await deckDeCas(), "cas.pptx");
  const { spec } = qualifierReleve(releve);
  const { html } = await construireSalle(spec, {
    prise: { devoilement: "pastille" },
    theme: chargerTheme("gabarits/theme-onet"),
    media: (h) => {
      const m = medias.get(h);
      return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined;
    },
  });
  const fichier = join(mkdtempSync(join(tmpdir(), "cas-")), "salle.html");
  writeFileSync(fichier, html);
  url = "file://" + fichier;
});

test("compose le cas au thème et le dévoile colonne par colonne, dans sa page", async ({ page }) => {
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(String(e)));
  await page.goto(url + "#b002.0");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".diapo.f-schema .cas")).toHaveCount(1);
  await expect(page.locator(".cas-colonne")).toHaveCount(3);
  await expect(page.locator(".cas-tete .cas-titre")).toHaveText(["Fournisseur", "Contrat", "Commande"]);
  await expect(page.locator(".cas-etape")).toHaveCount(9);
  await expect(page.locator(".cas-etape.bord-tirets")).toHaveCount(3);
  await expect(page.locator(".cas-etape .detail")).toHaveCount(3);
  await expect(page.locator(".cas-legende li")).toHaveCount(2);
  // Avant le premier pas, les colonnes attendent ; la légende est déjà là.
  await expect(page.locator(".cas-colonne.cache")).toHaveCount(3);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".cas-colonne.cache")).toHaveCount(2);
  await expect(page.locator(".cas-colonne.apparait")).toHaveCount(1);
  await page.keyboard.press("End");
  await expect(page.locator(".cas-colonne.cache")).toHaveCount(0);
  // Le cas tient dans sa page : rien sous le pied de page.
  const tient = await page.evaluate(() => {
    const c = document.querySelector<HTMLElement>(".cas")!;
    return c.scrollHeight <= c.clientHeight + 1;
  });
  expect(tient).toBe(true);
  expect(erreurs).toEqual([]);
});
