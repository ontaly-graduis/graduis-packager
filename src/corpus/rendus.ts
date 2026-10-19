// Le rendu fidèle d'un deck du corpus, pour la revue : PowerPoint l'exporte en PDF, piloté par script (macOS). PowerPoint
// n'écrit que dans ses conteneurs : le PDF passe par le conteneur partagé d'Office, puis rejoint le dossier de la mesure.
import { execFile } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";

const CONTENEUR = join(homedir(), "Library", "Group Containers", "UBF8T346G9.Office", "graduis-rendus");

const chaine = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * Exporte `deck` en PDF par PowerPoint ; `false` si PowerPoint n'est pas là ou refuse. Une présentation déjà ouverte par
 * l'humain est exportée telle quelle et laissée ouverte : seule celle que le script a ouverte est refermée, sans enregistrer.
 */
export async function rendreParPowerPoint(deck: string, pdf: string): Promise<boolean> {
  if (process.platform !== "darwin") return false;
  mkdirSync(CONTENEUR, { recursive: true });
  const provisoire = join(CONTENEUR, `${process.pid}-${Date.now()}.pdf`);
  // Les chemins se convertissent hors du bloc de PowerPoint, qui ne connaît pas `POSIX file`.
  const script = `
    set nom to ${chaine(basename(deck))}
    set source to POSIX file ${chaine(deck)}
    set cible to (POSIX file ${chaine(provisoire)}) as string
    tell application "Microsoft PowerPoint"
      set dejaOuverte to (name of every presentation) contains nom
      if not dejaOuverte then open source
      set p to presentation nom
      save p in cible as save as PDF
      if not dejaOuverte then close p saving no
    end tell`;
  try {
    await promisify(execFile)("osascript", ["-e", script], { timeout: 10 * 60_000 });
    if (!existsSync(provisoire)) return false;
    mkdirSync(dirname(pdf), { recursive: true });
    copyFileSync(provisoire, pdf);
    return true;
  } catch {
    return false;
  } finally {
    rmSync(provisoire, { force: true });
  }
}
