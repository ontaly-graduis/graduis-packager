// La planche avant/après (PKG-E, tranché le 18/10 : la même séquence avant et après) : pour chaque bloc livré, la
// diapositive du deck hérité (rendue par LibreOffice) face à la même diapositive en salle, à son dernier dévoilement
// (Chromium, mouvement réduit). Page locale : elle porte le contenu du client et ne se publie pas (I-PKG-9).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { esc, STYLE_DOCUMENT } from "../diagnostic/rapport-html";
import type { SeanceSpec } from "../pivot/seance-spec";
import type { DonneesDeSalle } from "../salle/donnees";
import type { Theme } from "../theme/theme";
import { LIBELLES } from "../pivot/libelles";

/** Les diapositives d'un deck, rendues par LibreOffice puis pdftoppm : numéro → JPEG. */
function apercus(deck: string, pages: readonly number[]): Map<number, Uint8Array> {
  const dossier = mkdtempSync(join(tmpdir(), "graduis-avant-"));
  try {
    const soffice = ["soffice", "libreoffice"].find((c) => spawnSync(c, ["--version"], { stdio: "ignore" }).status === 0);
    if (!soffice) throw new Error("LibreOffice est nécessaire pour rendre le deck d'origine");
    const copie = join(dossier, "deck.pptx");
    writeFileSync(copie, readFileSync(deck));
    // Les diapositives masquées aussi : la page n du PDF est la diapositive n du deck.
    const filtre = 'pdf:impress_pdf_Export:{"ExportHiddenSlides":{"type":"boolean","value":"true"}}';
    spawnSync(soffice, ["--headless", `-env:UserInstallation=file://${join(dossier, "profil")}`, "--convert-to", filtre, "--outdir", dossier, copie], { stdio: "ignore", timeout: 300000 });
    const out = new Map<number, Uint8Array>();
    for (const n of pages) {
      spawnSync("pdftoppm", ["-f", String(n), "-l", String(n), "-scale-to", "960", "-jpeg", "-jpegopt", "quality=80", join(dossier, "deck.pdf"), join(dossier, `p${n}`)], { stdio: "ignore" });
      const f = readdirSync(dossier).find((x) => x.startsWith(`p${n}-`) && x.endsWith(".jpg"));
      if (f) out.set(n, new Uint8Array(readFileSync(join(dossier, f))));
    }
    return out;
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

/** La salle, bloc par bloc à son dernier dévoilement : identifiant → JPEG 960 × 540. */
async function vuesDeSalle(salle: string, blocs: readonly { id: string; etapes: number }[]): Promise<Map<string, Uint8Array>> {
  const { chromium } = await import("playwright-core");
  const chemin = process.env["PW_CHROMIUM"];
  const navigateur = chemin ? await chromium.launch({ executablePath: chemin }) : await chromium.launch({ channel: "chrome" });
  try {
    const page = await navigateur.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 0.5, reducedMotion: "reduce" });
    await page.goto(pathToFileURL(salle).href);
    const out = new Map<string, Uint8Array>();
    for (const b of blocs) {
      await page.evaluate((h) => { location.hash = h; }, `#${b.id}.${b.etapes}`);
      await page.waitForTimeout(400);
      out.set(b.id, new Uint8Array(await page.screenshot({ type: "jpeg", quality: 80 })));
    }
    return out;
  } finally {
    await navigateur.close();
  }
}

const enDonnee = (o: Uint8Array | undefined) => (o ? `data:image/jpeg;base64,${Buffer.from(o).toString("base64")}` : "");

/** La planche d'une livraison : le deck hérité, le pivot livré, la salle livrée. */
export async function planche(deck: string, spec: SeanceSpec, salle: string, theme: Theme): Promise<string> {
  const html = readFileSync(salle, "utf8");
  const donnees = JSON.parse(html.match(/<script type="application\/json" id="donnees">([\s\S]*?)<\/script>/)![1]!) as DonneesDeSalle;
  const source = new Map(spec.sequences.flatMap((q) => q.blocs).map((b) => [b.id, b.source.diapo]));
  const blocs = donnees.sequences.flatMap((q) => q.blocs.map((b) => ({ id: b.id, etapes: b.etapes, figure: b.figure, titre: b.titre, diapo: source.get(b.id) ?? 0 })));
  const avant = apercus(deck, blocs.map((b) => b.diapo));
  const apres = await vuesDeSalle(salle, blocs);
  const lignes = blocs.map((b) => `<section class="regle"><h3><span>Diapositive ${b.diapo} · ${esc(b.titre ?? "")}</span><small>${esc(LIBELLES[b.figure] ?? b.figure)}</small></h3>`
    + `<div class="avant-apres"><figure><img src="${enDonnee(avant.get(b.diapo))}" alt=""><figcaption>avant : le deck d'origine</figcaption></figure>`
    + `<figure><img src="${enDonnee(apres.get(b.id))}" alt=""><figcaption>après : la salle</figcaption></figure></div></section>`).join("");
  const titre = donnees.sequences.map((q) => (q.numero !== null ? `Séquence ${q.numero} · ${q.titre}` : q.titre)).join(" — ");
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Avant / après</title>
<style id="theme">${theme.jetons}\n${theme.polices}</style>
<style>${STYLE_DOCUMENT}
.page{max-width:1600px}
.avant-apres{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);padding:var(--space-4) var(--space-5)}
.avant-apres figure{margin:0}.avant-apres img{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:var(--color-surface);border:var(--border-hairline)}
.avant-apres figcaption{margin-top:var(--space-1);font-size:var(--fs-meta);color:var(--text-secondary);text-align:center}</style></head>
<body><div class="page">
<header><img src="${theme.logo}" alt="${esc(theme.nom)}"><div><h1>Avant / après</h1><p>${esc(titre)} · ${blocs.length} diapositives</p></div></header>
${lignes}
<footer>Graduis Packager · Ontaly — le deck d'origine rendu par LibreOffice, la salle livrée à son dernier dévoilement.</footer>
</div></body></html>
`;
}
