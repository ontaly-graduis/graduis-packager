// Le thème d'un procédé (un dossier de `gabarits/`) chargé pour les sorties : son identité, ses feuilles de jetons, ses polices
// embarquées, son logo, sa chasse et sa manière.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Maniere } from "./maniere";

/** L'identité du thème (`identite.json`), en attendant `theme.json` (`graduis/theme@1`, THM-1). */
const Identite = z.object({
  /** Le nom du thème : celui du thème Office du PPT, le texte de remplacement du logo. */
  nom: z.string().min(1),
  /** La famille de la police embarquée (ses fichiers dans `polices/`) et du thème Office. */
  police: z.string().min(1),
  logo: z.string().min(1),
  /** Les feuilles de jetons, dans l'ordre où elles se cascadent. */
  feuilles: z.array(z.string().min(1)).min(1),
}).strict();

export interface Theme {
  readonly nom: string;
  readonly police: string;
  /** Primitives, couche sémantique, mouvement et palette des schémas, tels quels (le seul endroit où vivent des valeurs hex). */
  readonly jetons: string;
  /** `@font-face` des polices du thème, en data-URI woff2. */
  readonly polices: string;
  /** Le logo, en data-URI SVG. */
  readonly logo: string;
  /** Chasse des polices d'origine rapportée à celle du thème (`chasse.json`). */
  readonly chasse: Readonly<Record<string, number>>;
  /** La manière des schémas redessinés (`maniere.json`). */
  readonly maniere: Maniere;
}


export function chargerTheme(dossier: string): Theme {
  const id = Identite.parse(JSON.parse(readFileSync(join(dossier, "identite.json"), "utf8")));
  const jetons = id.feuilles.map((f) => readFileSync(join(dossier, f), "utf8")).join("\n");
  const polices = readdirSync(join(dossier, "polices"))
    .filter((f) => f.endsWith(".woff2"))
    .sort()
    .map((f) => {
      const graisse = Number(f.match(/-(\d{3})-/)?.[1] ?? 400);
      const ext = f.includes("latin-ext");
      const plage = ext ? "U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF"
        : "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
      const b64 = readFileSync(join(dossier, "polices", f)).toString("base64");
      return `@font-face{font-family:${JSON.stringify(id.police)};font-style:normal;font-weight:${graisse};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2");unicode-range:${plage}}`;
    })
    .join("\n");
  const logo = "data:image/svg+xml;base64," + readFileSync(join(dossier, id.logo)).toString("base64");
  const chasse = (JSON.parse(readFileSync(join(dossier, "chasse.json"), "utf8")) as { rapports: Record<string, number> }).rapports;
  const maniere = JSON.parse(readFileSync(join(dossier, "maniere.json"), "utf8")) as Maniere;
  return { nom: id.nom, police: id.police, jetons, polices, logo, chasse, maniere };
}
