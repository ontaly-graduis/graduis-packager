// Le procédé (`graduis/procede@0`) : ce qui fait une production, figé — profil de source, thème, charte, sensibilité, prise,
// versions et référence, chacun par son empreinte (I-PKG-18). Le charger vérifie que rien n'a changé en silence (G-4).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { Charte } from "../diagnostic/regles";
import { sha256, stringify2 } from "../lib/json";
import { chargerProfil, empreinteDuProfil, type ProfilSource } from "../profil/profil";
import { chargerTheme, type Theme } from "../theme/theme";

export const SCHEMA_PROCEDE = "graduis/procede@0";

const hash = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const Piece = z.object({ chemin: z.string(), empreinte: hash }).strict();

export const Procede = z.object({
  schema: z.literal(SCHEMA_PROCEDE),
  nom: z.string().regex(/^[a-z0-9-]+$/),
  /** Les chemins sont relatifs à la racine du dépôt, le dossier qui contient `procedes/`. */
  profil: Piece,
  theme: Piece,
  charte: Charte,
  /** La minimale seule en GEN-1 : la moyenne s'ouvre en ACT-1, l'élevée en REI-1. Les bornes de chaque niveau vivent dans le code. */
  sensibilite: z.enum(["minimale"]),
  prise: z.object({ devoilement: z.enum(["pastille", "ecran"]) }).strict(),
  versions: z.object({
    /** Le tag git de la bibliothèque dont la référence est le produit. */
    bibliotheque: z.string(),
    /** L'empreinte de `package-lock.json` : un autre verrou refuse le rejeu. */
    verrou: hash,
    /** Les moteurs dont dépend l'octet, tels qu'à la référence (`null` : absent). */
    moteurs: z.object({ node: z.string(), chromium: z.string().nullable(), libreoffice: z.string().nullable() }).strict(),
  }).strict(),
  /** Les empreintes attendues des sorties, par cas (`graduis/reference`). */
  reference: z.string(),
}).strict();
export type Procede = z.infer<typeof Procede>;

export interface ProcedeCharge {
  readonly procede: Procede;
  readonly empreinte: string;
  readonly racine: string;
  readonly profil: ProfilSource;
  readonly theme: Theme;
}

/** L'empreinte d'un thème chargé : celle que porte la prise au manifeste. */
export const empreinteDuTheme = (t: Theme) => sha256(stringify2(t));

/** Un chemin vers un fichier de procédé, ou le nom d'un procédé de `procedes/`. */
function fichierDuProcede(nomOuChemin: string): string {
  if (existsSync(nomOuChemin)) return nomOuChemin;
  const f = join("procedes", `${nomOuChemin}.json`);
  if (existsSync(f)) return f;
  throw new Error(`procédé introuvable : ${nomOuChemin} (ni fichier, ni ${f})`);
}

export function chargerProcede(nomOuChemin: string): ProcedeCharge {
  const fichier = fichierDuProcede(nomOuChemin);
  const procede = Procede.parse(JSON.parse(readFileSync(fichier, "utf8")));
  const racine = resolve(dirname(fichier), "..");
  const profil = chargerProfil(resolve(racine, procede.profil.chemin));
  const theme = chargerTheme(resolve(racine, procede.theme.chemin));
  const changes = [
    ...(empreinteDuProfil(profil) !== procede.profil.empreinte ? [`le profil ${procede.profil.chemin} (${empreinteDuProfil(profil)})`] : []),
    ...(empreinteDuTheme(theme) !== procede.theme.empreinte ? [`le thème ${procede.theme.chemin} (${empreinteDuTheme(theme)})`] : []),
  ];
  if (changes.length) {
    throw new Error(`procédé ${procede.nom} : ${changes.join(" et ")} ne correspond(ent) plus à l'empreinte épinglée. Un profil ou un thème ne change que par décision (G-4) : rejouer, lire le diff, puis porter la nouvelle empreinte au procédé.`);
  }
  return { procede, empreinte: sha256(stringify2(procede)), racine, profil, theme };
}

export interface Version {
  readonly quoi: string;
  readonly attendue: string | null;
  readonly trouvee: string | null;
  /** Un écart qui refuse le rejeu (le verrou) ; les autres le laissent tourner, la conformité se juge aux empreintes. */
  readonly bloquante: boolean;
}

const git = (racine: string, ...args: string[]) => {
  const r = spawnSync("git", args, { cwd: racine, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};

/** Ce qui diffère des versions épinglées : bibliothèque (le tag contre le code courant), verrou, moteurs. */
export function versionsEnEcart(p: ProcedeCharge, moteurs: { readonly chromium: string | null; readonly libreoffice: string | null }): Version[] {
  const v = p.procede.versions;
  const tag = git(p.racine, "rev-parse", `${v.bibliotheque}^{commit}`);
  const tete = git(p.racine, "rev-parse", "HEAD");
  const modifie = git(p.racine, "status", "--porcelain", "--untracked-files=no", "--", "src", "package.json", "package-lock.json");
  const courante = tete ? `${tete.slice(0, 12)}${modifie ? " (modifiée)" : ""}` : null;
  const verrou = existsSync(join(p.racine, "package-lock.json")) ? sha256(readFileSync(join(p.racine, "package-lock.json"))) : null;
  const toutes: Version[] = [
    { quoi: "bibliothèque", attendue: `${v.bibliotheque}${tag ? ` (${tag.slice(0, 12)})` : ""}`, trouvee: tag && tete === tag && !modifie ? `${v.bibliotheque} (${tag.slice(0, 12)})` : courante, bloquante: false },
    { quoi: "verrou", attendue: v.verrou, trouvee: verrou, bloquante: true },
    { quoi: "node", attendue: v.moteurs.node, trouvee: process.version, bloquante: false },
    { quoi: "chromium", attendue: v.moteurs.chromium, trouvee: moteurs.chromium, bloquante: false },
    { quoi: "libreoffice", attendue: v.moteurs.libreoffice, trouvee: moteurs.libreoffice, bloquante: false },
  ];
  return toutes.filter((x) => x.attendue !== x.trouvee);
}
