// La conversion des médias que le navigateur n'affiche pas (EMF, WMF : les pictogrammes vectoriels de PowerPoint) en SVG,
// par LibreOffice quand il est installé (PKG-B6). Hors salle : la salle reste un fichier sans dépendance ; la conversion
// se fait à la construction, une fois par média, et se garde dans un cache (même hash, même SVG).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const CONVERTIBLES: ReadonlySet<string> = new Set(["emf", "wmf"]);

/** LibreOffice pose le dessin sur une page A4 : on recadre le SVG sur la boîte de son graphique. */
export function recadrer(svg: string): string {
  const g = svg.indexOf('class="Graphic"');
  const boite = g >= 0 ? svg.slice(g).match(/<rect class="BoundingBox"[^>]*x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)"/) : null;
  if (!boite) return svg;
  const [, x, y, w, h] = boite;
  return svg.replace(/<svg([^>]*?) width="[^"]*" height="[^"]*" viewBox="[^"]*"/, `<svg$1 width="${Number(w) / 100}mm" height="${Number(h) / 100}mm" viewBox="${x} ${y} ${w} ${h}"`);
}

/** Un convertisseur EMF/WMF → SVG, avec son cache ; `null` si LibreOffice n'est pas là. */
export function convertisseur(cache: string): ((hash: string, ext: string, octets: Uint8Array) => Uint8Array | null) | null {
  const soffice = ["soffice", "libreoffice"].find((c) => spawnSync(c, ["--version"], { stdio: "ignore" }).status === 0);
  if (!soffice) return null;
  mkdirSync(cache, { recursive: true });
  return (hash, ext, octets) => {
    if (!CONVERTIBLES.has(ext)) return null;
    const cible = join(cache, `${hash.slice(7)}.svg`);
    if (existsSync(cible)) return new Uint8Array(readFileSync(cible));
    const dossier = mkdtempSync(join(tmpdir(), "pkg-emf-"));
    try {
      writeFileSync(join(dossier, `m.${ext}`), octets);
      const r = spawnSync(soffice, ["--headless", `-env:UserInstallation=file://${join(dossier, "profil")}`, "--convert-to", "svg", "--outdir", dossier, join(dossier, `m.${ext}`)], { stdio: "ignore", timeout: 120000 });
      const sortie = join(dossier, "m.svg");
      if (r.status !== 0 || !existsSync(sortie)) return null;
      const svg = new TextEncoder().encode(recadrer(readFileSync(sortie, "utf8")));
      writeFileSync(cible, svg);
      return svg;
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  };
}
