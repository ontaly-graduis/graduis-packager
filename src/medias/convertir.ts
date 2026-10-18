// La conversion des médias que le navigateur n'affiche pas (EMF, WMF : les pictogrammes vectoriels de PowerPoint) en SVG :
// d'abord les conversions figées d'un procédé (MV-1, au contrat du harnais `ingest-visuels` du wizard), sinon LibreOffice
// quand il est installé (PKG-B6). Hors salle : la salle reste un fichier sans dépendance ; la conversion se fait à la
// construction, une fois par média, et se garde dans un cache (même hash, même SVG).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { sha256, stringify2 } from "../lib/json";

export const CONVERTIBLES: ReadonlySet<string> = new Set(["emf", "wmf"]);

/** Un convertisseur : le SVG d'un média que le navigateur n'affiche pas, ou `null`. */
export type Convertir = (hash: string, ext: string, octets: Uint8Array) => Uint8Array | null;

const hash = z.string().regex(/^sha256:[0-9a-f]{64}$/);

/**
 * Le manifeste des conversions figées (`graduis/conversions@0`), au contrat du harnais du wizard : l'outil et le banc de
 * serveurs conformes qui les ont produites (serveur, version), le document d'où viennent les sources, et pour chaque
 * conversion l'empreinte de sa source, son chemin, l'empreinte du SVG et la transformation.
 */
const ManifesteDeConversions = z.object({
  schema: z.literal("graduis/conversions@0"),
  outil: z.string(),
  banc_serveurs_conformes: z.record(z.object({ serveur: z.string(), version: z.string() }).strict()),
  document: z.string(),
  document_sha256: hash,
  genere_le: z.string(),
  assets: z.array(z.object({
    source_sha256: hash,
    source_ext: z.enum(["emf", "wmf"]),
    media_type: z.literal("image/svg+xml"),
    path: z.string(),
    asset_sha256: hash,
    transcode: z.string(),
  }).strict()),
}).strict();

export interface ConversionsFigees {
  /** L'empreinte du manifeste : celle que le procédé épingle. */
  readonly empreinte: string;
  /** Hash de la source → SVG, vérifié contre son empreinte au chargement. */
  readonly svg: ReadonlyMap<string, Uint8Array>;
  /** Le serveur et la version qui les ont produites, pour le dire au rejeu. */
  readonly provenance: string;
}

/** Charge des conversions figées ; un SVG qui n'est plus celui du manifeste est refusé (G-4). */
export function chargerConversions(manifeste: string): ConversionsFigees {
  const m = ManifesteDeConversions.parse(JSON.parse(readFileSync(manifeste, "utf8")));
  const svg = new Map<string, Uint8Array>();
  for (const a of m.assets) {
    const octets = new Uint8Array(readFileSync(join(dirname(manifeste), a.path)));
    if (sha256(octets) !== a.asset_sha256) throw new Error(`conversion ${a.path} : le SVG n'est plus celui du manifeste (${sha256(octets)})`);
    svg.set(a.source_sha256, octets);
  }
  const provenance = Object.entries(m.banc_serveurs_conformes).map(([capacite, s]) => `${capacite} : ${s.serveur}, ${s.version}`).join(" ; ");
  return { empreinte: sha256(stringify2(m)), svg, provenance };
}

/** Les conversions figées d'abord ; le convertisseur de repli (LibreOffice) pour un média qui n'y est pas. */
export function avecConversionsFigees(figees: ConversionsFigees | null, repli: Convertir | null): Convertir | null {
  if (!figees) return repli;
  return (h, ext, octets) => figees.svg.get(h) ?? repli?.(h, ext, octets) ?? null;
}

/** LibreOffice pose le dessin sur une page A4 : on recadre le SVG sur la boîte de son graphique. */
export function recadrer(svg: string): string {
  const g = svg.indexOf('class="Graphic"');
  const boite = g >= 0 ? svg.slice(g).match(/<rect class="BoundingBox"[^>]*x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)"/) : null;
  if (!boite) return svg;
  const [, x, y, w, h] = boite;
  return svg.replace(/<svg([^>]*?) width="[^"]*" height="[^"]*" viewBox="[^"]*"/, `<svg$1 width="${Number(w) / 100}mm" height="${Number(h) / 100}mm" viewBox="${x} ${y} ${w} ${h}"`);
}

const libreOffice = () => ["soffice", "libreoffice"].find((c) => spawnSync(c, ["--version"], { stdio: "ignore" }).status === 0);

/** La version de LibreOffice (`null` s'il n'est pas là) : le procédé l'épingle ; la salle n'en dépend que hors des conversions figées. */
export function versionDeLibreOffice(): string | null {
  const soffice = libreOffice();
  return soffice ? spawnSync(soffice, ["--version"], { encoding: "utf8" }).stdout.trim() : null;
}

/** Un convertisseur EMF/WMF → SVG, avec son cache ; `null` si LibreOffice n'est pas là. */
export function convertisseur(cache: string): Convertir | null {
  const soffice = libreOffice();
  if (!soffice) return null;
  mkdirSync(cache, { recursive: true });
  return (h, ext, octets) => {
    if (!CONVERTIBLES.has(ext)) return null;
    const cible = join(cache, `${h.slice(7)}.svg`);
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
