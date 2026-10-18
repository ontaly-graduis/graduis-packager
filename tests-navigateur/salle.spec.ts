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

test("dévoile le pas-à-pas pastille par pastille, la première sitôt le titre posé, et zoome sur la zone courante", async ({ page }) => {
  const delai = (selecteur: string) => page.locator(selecteur).first().evaluate((e) => parseFloat(getComputedStyle(e).animationDelay));
  await page.goto(url + "#b001.0");
  await page.keyboard.press("ArrowRight");
  // À l'entrée, le titre d'abord ; la première pastille paraît ensuite, sans attendre l'animateur.
  await expect(page).toHaveURL(/#b002\.1$/);
  await expect(page.locator(".diapo.entree")).toHaveCount(1);
  await expect(page.locator(".zone.apparait .num")).toHaveText("1");
  await expect(page.locator(".consignes li.courant.apparait")).toContainText("Cliquer sur le menu");
  await expect(page.locator(".consignes li.cache")).toHaveCount(1);
  expect(await delai(".diapo.entree .entete")).toBe(0);
  expect(await delai(".zone.apparait")).toBeGreaterThan(0.2);
  // L'étape suivante paraît sur-le-champ.
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#b002\.2$/);
  expect(await delai(".zone.apparait")).toBe(0);
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
  await expect(page).toHaveURL(/#b002\.1$/);
  await expect(presentateur.locator("#position")).toContainText("2 / 3");
  // Le plan demandé au présentateur s'ouvre chez lui : la salle n'en voit rien.
  await presentateur.keyboard.press("m");
  await expect(presentateur.locator(".plan-seance")).toHaveCount(1);
  await expect(page.locator(".plan-seance")).toHaveCount(0);
  await presentateur.keyboard.press("3");
  await presentateur.keyboard.press("Enter");
  await expect(page).toHaveURL(/#b003\.0$/);
  await expect(presentateur.locator(".plan-seance")).toHaveCount(0);
});

test("affiche toute la diapositive d'un coup (A, Maj →) ; un contenu statique reste tel quel", async ({ page }) => {
  await page.goto(url + "#b002.1");
  await page.keyboard.press("a");
  await expect(page).toHaveURL(/#b002\.2$/);
  await expect(page.locator(".consignes li.cache")).toHaveCount(0);
  await page.keyboard.press("a");
  await expect(page).toHaveURL(/#b002\.2$/);
  await page.goto(url + "#b002.1");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page).toHaveURL(/#b002\.2$/);
  await page.goto(url + "#b001.0");
  await page.keyboard.press("a");
  await expect(page).toHaveURL(/#b001\.0$/);
});

test("ouvre le plan de la séance (M, bouton ☰) : filtrer, choisir au clavier ou à la souris, fermer", async ({ page }) => {
  await page.goto(url + "#b001.0");
  await page.keyboard.press("m");
  const plan = page.locator(".plan-seance");
  await expect(plan).toHaveCount(1);
  await expect(plan.locator("h3")).toHaveText(["Ouverture"]);
  await expect(plan.locator("li")).toHaveCount(3);
  await expect(plan.locator("li.courant .num")).toHaveText("1");
  await expect(plan.locator("input")).toBeFocused();
  // Les touches sont celles du plan : → ne fait pas avancer la salle.
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#b001\.0$/);
  // Filtrer sans accents ni casse, sur la figure ; Entrée y mène, sur la première étape.
  await page.keyboard.type("pas a pas".replace(/ /g, "-"));
  await expect(plan.locator("li:not([hidden])")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#b002\.1$/);
  await expect(plan).toHaveCount(0);
  // ↓ choisit la suivante.
  await page.keyboard.press("m");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#b003\.0$/);
  // Échap, ou un clic à côté, ferme sans bouger ; le bouton ☰ l'ouvre aussi ; un clic sur une diapositive y mène.
  await page.keyboard.press("m");
  await page.keyboard.press("Escape");
  await expect(plan).toHaveCount(0);
  await page.mouse.move(10, 10);
  await page.locator(".plan-bouton").click();
  await expect(plan).toHaveCount(1);
  await page.mouse.click(5, 5);
  await expect(plan).toHaveCount(0);
  await expect(page).toHaveURL(/#b003\.0$/);
  await page.keyboard.press("m");
  await plan.locator("li").first().click();
  await expect(page).toHaveURL(/#b001\.0$/);
});

test.describe("débordement", () => {
  let urlLongue = "";
  test.beforeAll(async () => {
    const ligne = (i: number) => `Item ${i} — une consigne assez longue pour occuper une ligne entière de la scène projetée`;
    const bloc = (n: number, figure: "contenu" | "glossaire", lignes: number) => ({
      id: `b${String(n).padStart(3, "0")}`, figure, source: { diapo: n }, titre: `Bloc ${n}`,
      textes: [Array.from({ length: lignes }, (_, i) => ligne(i + 1)).join("\n")],
      visuels: [], tableaux: [], pas: [], notes: "",
    });
    const spec = {
      schema: "graduis/seance-spec@0" as const,
      source: { nom: "long.pptx", empreinte: "sha256:" + "c".repeat(64) },
      sequences: [{ id: "s001", blocs: [bloc(1, "contenu", 30), bloc(2, "glossaire", 60), bloc(3, "contenu", 1)] }],
    };
    const { html } = await construireSalle(spec, { prise: { devoilement: "pastille" }, theme: chargerTheme("gabarits/theme-onet"), media: () => undefined });
    const fichier = join(mkdtempSync(join(tmpdir(), "salle-")), "longue.html");
    writeFileSync(fichier, html);
    urlLongue = "file://" + fichier;
  });

  test("en dévoilement, la pile suit l'item courant, qui reste entier dans la fenêtre", async ({ page }) => {
    await page.goto(urlLongue + "#b001.25");
    await page.waitForTimeout(700);
    const fenetre = (await page.locator(".defile").boundingBox())!;
    const courant = (await page.locator("li.courant").boundingBox())!;
    expect(courant.y).toBeGreaterThanOrEqual(fenetre.y - 1);
    expect(courant.y + courant.height).toBeLessThanOrEqual(fenetre.y + fenetre.height + 1);
    await expect(page.locator(".defile")).toHaveClass(/haut/);
  });

  test("un contenu statique qui déborde se lit page par page, et le retour arrive sur sa dernière page", async ({ page }) => {
    await page.goto(urlLongue + "#b002.0");
    await expect(page.locator(".defile")).toHaveClass(/bas/);
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#b002\.1$/);
    await page.goto(urlLongue + "#b003.0");
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/#b002\.[1-9]$/);
    await expect(page.locator(".defile")).not.toHaveClass(/bas/);
  });
});

test("affiche l'aide des commandes par la touche ? et par le bouton", async ({ page }) => {
  await page.goto(url + "#b001.0");
  await expect(page.locator(".aide-commandes")).toHaveCount(0);
  await page.keyboard.press("?");
  await expect(page.locator(".aide-commandes h2")).toHaveText("Commandes de la salle");
  await expect(page.locator(".aide-commandes kbd", { hasText: "Z" })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".aide-commandes")).toHaveCount(0);
  await page.mouse.move(200, 200);
  await page.locator(".aide-bouton").click();
  await expect(page.locator(".aide-commandes")).toHaveCount(1);
});
