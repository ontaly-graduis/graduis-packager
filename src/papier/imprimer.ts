// L'impression du papier par Chromium (filiation : l'imprimeur du wizard) : la page se dit prête, une première passe donne
// la page de chaque ancre (les destinations du PDF), le sommaire reçoit ses numéros, une seconde passe imprime ; on
// recommence tant que la pagination bouge. Options : la page A4 de la feuille, les fonds, le PDF balisé, les signets.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { lirePdf, type PdfLu } from "./recette";

export interface Impression {
  readonly pdf: Uint8Array;
  readonly lu: PdfLu;
  /** Les passes qu'il a fallu pour une pagination stable. */
  readonly passes: number;
}

const OPTIONS = { preferCSSPageSize: true, printBackground: true, tagged: true, outline: true } as const;

/** Un Chromium : celui que désigne `PW_CHROMIUM`, sinon celui de Playwright, sinon Google Chrome installé. */
async function lancer(chemin = process.env["PW_CHROMIUM"]) {
  const { chromium } = await import("playwright-core");
  if (chemin) return chromium.launch({ executablePath: chemin });
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ channel: "chrome" });
  }
}

/** Y a-t-il un Chromium pour imprimer ici ? */
export async function chromiumDisponible(): Promise<boolean> {
  try {
    const n = await lancer();
    await n.close();
    return true;
  } catch {
    return false;
  }
}

const memes = (a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

export async function imprimer(html: string): Promise<Impression> {
  const dossier = mkdtempSync(join(tmpdir(), "graduis-papier-"));
  const fichier = join(dossier, "papier.html");
  writeFileSync(fichier, html);
  const navigateur = await lancer();
  try {
    const page = await navigateur.newPage();
    const erreurs: string[] = [];
    page.on("pageerror", (e) => erreurs.push(e.message));
    await page.goto(pathToFileURL(fichier).href);
    await page.waitForFunction(() => document.documentElement.dataset["papier"] !== undefined, null, { timeout: 180000 });
    const [etat, erreur] = await page.evaluate(() => [document.documentElement.dataset["papier"], document.documentElement.dataset["erreur"]]);
    if (etat !== "pret" || erreurs.length) throw new Error(`le papier refuse de s'imprimer : ${erreur ?? erreurs.join(" ; ")}`);
    let pdf = await page.pdf(OPTIONS);
    let lu = await lirePdf(pdf);
    let passes = 1;
    for (; passes < 4; passes++) {
      const numeros = lu.destinations;
      await page.evaluate((m) => (window as unknown as { __papier: { paginer(m: Record<string, number>): void } }).__papier.paginer(m), numeros);
      pdf = await page.pdf(OPTIONS);
      lu = await lirePdf(pdf);
      if (memes(numeros, lu.destinations)) break;
    }
    return { pdf: new Uint8Array(pdf), lu, passes: passes + 1 };
  } finally {
    await navigateur.close();
    rmSync(dossier, { recursive: true, force: true });
  }
}
