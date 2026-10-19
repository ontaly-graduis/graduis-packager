// Les activités dérivées dans un vrai navigateur (ACT-1) : la régie au clavier, le corrigé, la télécommande seule, et aucun
// mot à l'écran que la source ou l'habillage ne porte — hors ligne, en file://.
import { expect, test, type Page } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONSIGNES_DE_SALLE, TOUCHES_DE_REGIE, titreDActivite } from "../src/activites/habillage";
import { DUREES_GRADUIS } from "../src/diagnostic/regles";
import { LIBELLES_DE_GESTE } from "../src/pivot/libelles";
import { DERIVATIONS, GESTES, SeanceSpec, blocsDe, type Activite } from "../src/pivot/seance-spec";
import { qualifierReleve } from "../src/qualification/qualifier";
import { relever } from "../src/releve/releve";
import { construireSalle } from "../src/salle/construire";
import { chargerTheme } from "../src/theme/theme";
import { deckDActivites, LIGNES_DE_PROCESSUS } from "../tests/fixture";
import { PROFIL } from "../tests/procede";

let url = "";
/** Les mots que la salle peut montrer sur une activité : ceux de ses sources, et ceux de l'habillage. */
let permis = new Set<string>();
const mots = (s: string) => s.normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

test.beforeAll(async () => {
  const { releve, medias } = relever(await deckDActivites(), "activites.pptx");
  const { spec } = qualifierReleve(releve, PROFIL, DUREES_GRADUIS);
  // Un « où cliquez-vous ? » ajouté à la main après le pas-à-pas.
  const ajoutee: Activite = { id: "a005", figure: "activite", derivation: "ou-cliquez-vous", derive_de: "b005", duree: 3 };
  const pivot = SeanceSpec.parse({ ...spec, sequences: spec.sequences.map((s) => ({ ...s, blocs: s.blocs.flatMap((b) => (b.id === "b005" ? [b, ajoutee] : [b])) })) });
  const { html } = await construireSalle(pivot, {
    prise: { devoilement: "pastille" },
    theme: chargerTheme("gabarits/theme-onet"),
    media: (h) => { const m = medias.get(h); return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined; },
  });
  const fichier = join(mkdtempSync(join(tmpdir(), "activites-")), "salle.html");
  writeFileSync(fichier, html);
  url = "file://" + fichier;
  const sources = blocsDe(pivot).flatMap((b) => [b.titre ?? "", ...b.textes, ...b.tableaux.flat(2), ...b.pas.map((p) => p.consigne ?? "")]);
  const habillage = [
    ...DERIVATIONS.flatMap((d) => [titreDActivite(d, "Acteur"), titreDActivite(d), CONSIGNES_DE_SALLE[d]]),
    ...GESTES.flatMap((g) => [LIBELLES_DE_GESTE[g], TOUCHES_DE_REGIE[g]]), "D'après", "minutes", "Séquence", "dicté",
  ];
  permis = new Set([...sources, ...habillage].flatMap(mots));
});

/** Les mots d'une activité à l'écran qu'aucune source ni l'habillage ne porte (hors numéros). */
async function inventes(page: Page): Promise<string[]> {
  const texte = await page.locator(".diapo .entete h1, .diapo .act").allInnerTexts();
  return [...new Set(texte.flatMap(mots))].filter((m) => !permis.has(m) && !/^\d+$/.test(m));
}

test("le Classement : l'ordre dicté au clavier, puis le corrigé, juste ou faux, sans un mot inventé", async ({ page }) => {
  const erreurs: string[] = [];
  const requetes: string[] = [];
  page.on("pageerror", (e) => erreurs.push(String(e)));
  page.on("request", (r) => { if (!/^(file|data|about):/.test(r.url())) requetes.push(r.url()); });
  await page.goto(url + "#a003.1");
  await expect(page.locator(".act-propositions li")).toHaveCount(4);
  const propositions = await page.locator(".act-propositions .texte-act").allInnerTexts();
  // Dicter l'ordre juste pour les deux premiers, faux ensuite.
  const juste = ["Transformer la demande", "Compléter la commande", "Soumettre au circuit", "Signer le bon"];
  for (const t of [juste[0], juste[1], juste[3], juste[2]]) await page.keyboard.press(String(propositions.indexOf(t!) + 1));
  await expect(page.locator(".act-ordre .remplie")).toHaveCount(4);
  await expect(page.locator(".act-propositions .placee")).toHaveCount(4);
  // ⌫ retire la dernière saisie ; on la redonne.
  await page.keyboard.press("Backspace");
  await expect(page.locator(".act-ordre .remplie")).toHaveCount(3);
  await page.keyboard.press(String(propositions.indexOf(juste[2]!) + 1));
  expect(await inventes(page)).toEqual([]);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#a003\.2$/);
  await expect(page.locator(".act-ordre .juste")).toHaveCount(2);
  await expect(page.locator(".act-ordre .faux")).toHaveCount(2);
  await expect(page.locator(".act-ordre li .texte-act")).toHaveText(juste);
  expect(await inventes(page)).toEqual([]);
  expect(erreurs).toEqual([]);
  expect(requetes).toEqual([]);
});

test("la Catégorisation : une carte, puis sa colonne ; au corrigé, chaque carte à sa place", async ({ page }) => {
  await page.goto(url + "#a004.1");
  await expect(page.locator(".act-reserve .carte-act")).toHaveCount(4);
  await expect(page.locator(".tete-act")).toHaveText(["1Demandeur", "2Manager", "3Acheteur"]);
  const cartes = await page.locator(".act-reserve .texte-act").allInnerTexts();
  await page.keyboard.press(String(cartes.indexOf(LIGNES_DE_PROCESSUS[0][0]) + 1));
  await expect(page.locator(".carte-act.choisie")).toHaveCount(1);
  await page.keyboard.press("1");
  await page.keyboard.press(String(cartes.indexOf(LIGNES_DE_PROCESSUS[1][0]) + 1));
  await page.keyboard.press("3");
  await expect(page.locator(".colonne-act").nth(0).locator(".carte-act")).toHaveCount(1);
  await expect(page.locator(".act-reserve .carte-act")).toHaveCount(2);
  expect(await inventes(page)).toEqual([]);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".carte-act.juste")).toHaveCount(1);
  await expect(page.locator(".carte-act.faux")).toHaveCount(1);
  await expect(page.locator(".colonne-act").nth(2).locator(".texte-act")).toHaveText([...LIGNES_DE_PROCESSUS.slice(2).map((l) => l[0])].sort((a, b) => cartes.indexOf(a) - cartes.indexOf(b)));
});

test("le Rappel : ce qui sort paraît aussitôt, le reste au corrigé ; le présentateur a le corrigé et les touches", async ({ page }) => {
  await page.goto(url + "#a006.1");
  await expect(page.locator(".act-rappel .vide")).toHaveCount(3);
  await page.keyboard.press("2");
  await expect(page.locator(".act-rappel .sorti")).toHaveText(["2Vérifier le fournisseur"]);
  const [presentateur] = await Promise.all([page.waitForEvent("popup"), page.keyboard.press("p")]);
  await expect(presentateur.locator("#notes")).toContainText("1. Ouvrir la demande");
  await expect(presentateur.locator("#notes")).toContainText("sortis : 2 sur 3");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".act-rappel .a-retenir")).toHaveCount(2);
  await expect(page.locator(".act-rappel .sorti")).toHaveCount(1);
});

test("à la télécommande seule : la consigne, le corrigé, puis la suite ; ⌫ sans saisie recule ; la Sélection sur image pas à pas", async ({ page }) => {
  await page.goto(url + "#b005.3");
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#a005\.1$/);
  // Le premier pas : sa consigne, pas sa zone.
  await expect(page.locator(".act-pas .courant")).toContainText("Ouvrir le menu Achats");
  await expect(page.locator(".act-selection .zone")).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".act-selection .zone.courante .num")).toHaveText("1");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".act-pas .courant")).toContainText("Choisir la demande");
  await expect(page.locator(".act-selection .zone.faite")).toHaveCount(1);
  expect(await inventes(page)).toEqual([]);
  await page.keyboard.press("Backspace");
  await expect(page).toHaveURL(/#a005\.2$/);
  // Une activité sans saisie se traverse à la télécommande : → donne le corrigé, puis la diapositive suivante.
  await page.goto(url + "#a006.1");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".act-rappel .a-retenir")).toHaveCount(3);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#b006\.1$/);
});
