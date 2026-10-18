// L'assemblage du papier : une page HTML unique — thème, feuille, données, médias et lecteur inline — que Chromium imprime.
// Elle se construit comme la salle (mêmes données, même rendu) ; elle signale les captures que l'imprimé montrerait en
// deçà de 150 ppp, sans les masquer.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { stringify2 } from "../lib/json";
import type { SeanceSpec } from "../pivot/seance-spec";
import type { MediaSource } from "../salle/construire";
import { mediasDuBloc, type BlocDeSalle } from "../salle/donnees";
import type { Theme } from "../theme/theme";
import { mettreSurPapier, textesAttendus, type DonneesDePapier } from "./donnees";
import { STYLE_PAPIER } from "./style";

const MIME: Readonly<Record<string, string>> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp",
};

/** La largeur utile d'une page (178 mm) en pixels CSS, et la hauteur au plus d'une capture : celles du lecteur du papier. */
const LARGEUR = 672;
const HAUTEUR_CAPTURE = 560;
/** En deçà, une capture imprimée se lit mal : elle est signalée. */
export const PPP_MIN = 150;

export interface OptionsDePapier {
  readonly theme: Theme;
  readonly media: (hash: string) => MediaSource | undefined;
  readonly sequences?: readonly string[];
  readonly convertir?: ((hash: string, ext: string, octets: Uint8Array) => Uint8Array | null) | null;
}

export interface SousResolue {
  readonly bloc: string;
  readonly media: string;
  readonly ppp: number;
}

export interface Papier {
  readonly html: string;
  readonly donnees: DonneesDePapier;
  /** L'oracle de la recette : les lignes que le PDF doit porter. */
  readonly attendus: readonly string[];
  readonly nonAffichables: readonly string[];
  readonly sousResolues: readonly SousResolue[];
}

async function lecteur(): Promise<string> {
  const r = await build({
    entryPoints: [fileURLToPath(new URL("./lecteur/main.ts", import.meta.url))],
    bundle: true, format: "iife", minify: true, write: false, target: "es2020", legalComments: "none", charset: "utf8",
  });
  return r.outputFiles[0]!.text;
}

const jsonInline = (v: unknown) => stringify2(v).replace(/</g, "\\u003c");

/** La résolution d'une capture imprimée : ses pixels utiles rapportés à sa largeur sur la page (le calcul de `capture`). */
function ppp(b: BlocDeSalle): SousResolue[] {
  return b.visuels.filter((v) => v.capture && v.px).flatMap((v) => {
    const [nl, nh] = v.px!;
    const [g, h, dr, bas] = (v.rognage ?? [0, 0, 0, 0]).map((x) => x / 100000) as [number, number, number, number];
    const s = Math.min(LARGEUR / (nl * (1 - g - dr)), HAUTEUR_CAPTURE / (nh * (1 - h - bas)));
    const r = Math.round(96 / s);
    return r < PPP_MIN ? [{ bloc: b.id, media: v.media, ppp: r }] : [];
  });
}

export async function construirePapier(spec: SeanceSpec, o: OptionsDePapier): Promise<Papier> {
  const donnees = mettreSurPapier(spec, (h) => o.media(h)?.px ?? null, o.sequences, { chasse: o.theme.chasse, maniere: o.theme.maniere });
  const blocs = [...(donnees.couverture ? [donnees.couverture] : []), ...donnees.sequences.flatMap((s) => [...(s.intercalaire ? [s.intercalaire] : []), ...s.blocs]), ...donnees.annexes];
  const medias: Record<string, string> = { logo: o.theme.logo };
  const nonAffichables: string[] = [];
  for (const h of [...new Set(blocs.flatMap(mediasDuBloc))].sort()) {
    const m = o.media(h);
    const mime = m && MIME[m.ext];
    const converti = m && !mime ? o.convertir?.(h, m.ext, m.octets) : null;
    if (m && mime) medias[h] = `data:${mime};base64,${Buffer.from(m.octets).toString("base64")}`;
    else if (converti) medias[h] = `data:image/svg+xml;base64,${Buffer.from(converti).toString("base64")}`;
    else nonAffichables.push(h);
  }
  const titre = `${donnees.titre} — support participant${donnees.extrait ? ` (${donnees.extrait})` : ""}`;
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titre.replace(/[<&]/g, "")}</title>
<style id="theme">${o.theme.jetons}\n${o.theme.polices}</style>
<style id="papier">${STYLE_PAPIER}</style></head>
<body><main id="feuille"></main>
<script type="application/json" id="donnees">${jsonInline(donnees)}</script>
<script type="application/json" id="medias">${jsonInline(medias)}</script>
<script>${await lecteur()}</script>
</body></html>
`;
  return { html, donnees, attendus: textesAttendus(donnees), nonAffichables, sousResolues: blocs.flatMap(ppp) };
}
