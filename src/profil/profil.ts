// Le profil de source (`graduis/profil-source@0`) : ce qu'une famille de gabarit dit d'elle-même — dispositions, formules,
// habillage d'origine, marqueurs d'inachèvement, projection des couleurs. Une donnée figée et hashée, jamais du code (GEN-1).
import { readFileSync } from "node:fs";
import { z } from "zod";
import { sha256, stringify2 } from "../lib/json";
import { FAMILLES, FIGURES } from "../pivot/seance-spec";

export const SCHEMA_PROFIL = "graduis/profil-source@0";

/** Un motif : un texte cherché tel quel (sensible à la casse), ou une expression écrite `/…/drapeaux`. */
const Motif = z.string().min(1);
const figure = z.enum(FIGURES);

const Disposition = z.object({
  /** Le nom de la disposition d'origine. */
  disposition: Motif,
  figure,
  /** Un texte de la diapositive (en minuscules) qui décide d'une autre figure ; `libelle` le nomme au rapport. */
  formules: z.array(z.object({ texte: Motif, figure, libelle: z.string() }).strict()).optional(),
  /** Un titre qui décide d'une autre figure. */
  titres: z.array(z.object({ titre: Motif, figure, libelle: z.string() }).strict()).optional(),
}).strict();

export const ProfilSource = z.object({
  schema: z.literal(SCHEMA_PROFIL),
  nom: z.string(),
  /** Règles ordonnées : la première dont la disposition répond décide. */
  dispositions: z.array(Disposition),
  /** Ce qui, propre au client, fait d'un tableau un processus (en plus de « processus » et « étape »). */
  processus: Motif.optional(),
  /** L'habillage d'origine d'une mise en pratique : son titre générique (l'énoncé prend sa place, H6 l'ignore), son renvoi au pas-à-pas (il devient la ligne d'aide). */
  pratique: z.object({ titre: Motif, aide: Motif }).strict().optional(),
  /** Les marqueurs d'inachèvement (H8, bloquant). */
  inacheve: z.array(Motif),
  /** La projection des couleurs d'origine sur les rôles du thème (règle DESSIN) : seuils OKLab et familles de teinte TSL. */
  projection: z.object({
    seuils: z.object({
      saturationNeutre: z.number(), chromaNeutre: z.number(), papier: z.number(), encre: z.number(), fort: z.number(),
      fortVif: z.number(), vif: z.number(), pale: z.number(), chromaPale: z.number(), fusion: z.number(), teinteFusion: z.number(),
    }).strict(),
    teintes: z.array(z.tuple([z.number(), z.number(), z.enum(FAMILLES)])),
  }).strict(),
}).strict();
export type ProfilSource = z.infer<typeof ProfilSource>;
export type ReglesDeProjection = ProfilSource["projection"];
export type PratiqueDOrigine = NonNullable<ProfilSource["pratique"]>;

export interface MotifCompile {
  readonly teste: (texte: string) => boolean;
  /** Le passage qui répond, tel qu'il est écrit dans le texte ; `null` sinon. */
  readonly trouve: (texte: string) => string | null;
}

const compiles = new Map<string, MotifCompile>();

export function motif(source: string): MotifCompile {
  let m = compiles.get(source);
  if (m) return m;
  const expr = source.match(/^\/(.+)\/([imsu]*)$/s);
  if (expr) {
    const re = new RegExp(expr[1]!, expr[2]);
    m = { teste: (t) => re.test(t), trouve: (t) => t.match(re)?.[0] ?? null };
  } else {
    m = { teste: (t) => t.includes(source), trouve: (t) => (t.includes(source) ? source : null) };
  }
  compiles.set(source, m);
  return m;
}

/** L'empreinte d'un profil : sha256 de sa sérialisation figée, après normalisation par son schéma. */
export const empreinteDuProfil = (p: ProfilSource) => sha256(stringify2(p));

export function chargerProfil(chemin: string): ProfilSource {
  const p = ProfilSource.parse(JSON.parse(readFileSync(chemin, "utf8")));
  for (const s of [...p.dispositions.flatMap((d) => [d.disposition, ...(d.formules ?? []).map((f) => f.texte), ...(d.titres ?? []).map((t) => t.titre)]),
    ...(p.processus ? [p.processus] : []), ...(p.pratique ? [p.pratique.titre, p.pratique.aide] : []), ...p.inacheve]) motif(s);
  return p;
}
