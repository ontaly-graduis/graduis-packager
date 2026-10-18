// L'assemblage de la salle : un fichier HTML unique — thème, feuille, données, médias et lecteur inline, sans requête réseau.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { stringify2 } from "../lib/json";
import type { SeanceSpec } from "../pivot/seance-spec";
import type { Theme } from "../theme/theme";
import { mediasDuBloc, mettreEnSalle, type PriseDeSalle } from "./donnees";
import { STYLE_SALLE } from "./style";

const MIME: Readonly<Record<string, string>> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp",
};

export interface MediaSource {
  readonly ext: string;
  readonly octets: Uint8Array;
  readonly px: readonly [number, number] | null;
}

export interface OptionsDeSalle {
  readonly prise: PriseDeSalle;
  readonly theme: Theme;
  readonly media: (hash: string) => MediaSource | undefined;
  /** Les séquences retenues (identifiants `sNNN`) ; toutes si absent. */
  readonly sequences?: readonly string[];
  /** Convertit un média que le navigateur n'affiche pas (EMF, WMF) en SVG ; sans lui, il reste « à convertir ». */
  readonly convertir?: ((hash: string, ext: string, octets: Uint8Array) => Uint8Array | null) | null;
}

/** Le lecteur, regroupé en un script : même source et même version d'esbuild ⇒ mêmes octets. */
async function lecteur(): Promise<string> {
  const r = await build({
    entryPoints: [fileURLToPath(new URL("./lecteur/main.ts", import.meta.url))],
    bundle: true, format: "iife", minify: true, write: false, target: "es2020", legalComments: "none", charset: "utf8",
  });
  return r.outputFiles[0]!.text;
}

/** JSON sûr dans un `<script>` : aucun `<` ne peut y fermer la balise. */
const jsonInline = (v: unknown) => stringify2(v).replace(/</g, "\\u003c");

export async function construireSalle(spec: SeanceSpec, o: OptionsDeSalle): Promise<{ html: string; nonAffichables: string[] }> {
  const donnees = mettreEnSalle(spec, o.prise, (h) => o.media(h)?.px ?? null, o.sequences, { chasse: o.theme.chasse, maniere: o.theme.maniere });
  const medias: Record<string, string> = { logo: o.theme.logo };
  const nonAffichables: string[] = [];
  for (const h of [...new Set(donnees.sequences.flatMap((s) => s.blocs.flatMap(mediasDuBloc)))].sort()) {
    const m = o.media(h);
    const mime = m && MIME[m.ext];
    const converti = m && !mime ? o.convertir?.(h, m.ext, m.octets) : null;
    if (m && mime) medias[h] = `data:${mime};base64,${Buffer.from(m.octets).toString("base64")}`;
    else if (converti) medias[h] = `data:image/svg+xml;base64,${Buffer.from(converti).toString("base64")}`;
    else nonAffichables.push(h);
  }
  const titre = donnees.sequences.length === 1 ? donnees.sequences[0]!.titre : donnees.source.nom.replace(/\.pptx?$/i, "");
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titre.replace(/[<&]/g, "")}</title>
<style id="theme">${o.theme.jetons}\n${o.theme.polices}</style>
<style id="salle">${STYLE_SALLE}</style></head>
<body><div id="scene"></div><div id="surcouche"></div>
<script type="application/json" id="donnees">${jsonInline(donnees)}</script>
<script type="application/json" id="medias">${jsonInline(medias)}</script>
<script>${await lecteur()}</script>
</body></html>
`;
  return { html, nonAffichables };
}
