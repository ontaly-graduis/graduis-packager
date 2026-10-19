// Le corpus d'épreuve (`graduis/corpus@0`, hors dépôt) : ses decks épinglés, leur famille et leur client, le profil de mesure ;
// et la vérité de terrain de chaque deck, un tableur préremplie de la figure des règles, que l'humain corrige (GEN-0).
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { z } from "zod";
import { sha256 } from "../lib/json";
import { chargerProfil, empreinteDuProfil, type ProfilSource } from "../profil/profil";
import { FIGURES, type SeanceSpec } from "../pivot/seance-spec";
import { LIBELLES } from "../pivot/libelles";
import type { Qualification } from "../qualification/figures";

const SCHEMA_CORPUS = "graduis/corpus@0";

/** Les familles de decks du corpus d'épreuve (spec § 10.2, GEN-0). */
export const FAMILLES_DE_DECK = ["procedural-logiciel", "comportemental", "reglementaire", "metier"] as const;
export type FamilleDeDeck = (typeof FAMILLES_DE_DECK)[number];

/** Les figures candidates au cercle de référence (spec § 4.5), que la vérité de terrain peut nommer. */
export const CANDIDATES = [
  "citation", "chiffre-cle", "comparaison", "chronologie", "graphique", "video", "consigne-atelier", "quiz", "programme",
] as const;

const hash = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const Corpus = z.object({
  schema: z.literal(SCHEMA_CORPUS),
  nom: z.string().regex(/^[a-z0-9-]+$/),
  /** Les chemins sont relatifs au manifeste. */
  profil: z.object({ chemin: z.string(), empreinte: hash }).strict(),
  decks: z.array(z.object({
    chemin: z.string(),
    empreinte: hash,
    famille: z.enum(FAMILLES_DE_DECK),
    /** Le client ou l'éditeur : l'hypothèse « peu de gabarits par client » se confronte par lui. */
    client: z.string().min(1),
    /** `tableau` : mesuré et comparé ; `gabarit` : ne sert qu'à l'hypothèse des gabarits. */
    role: z.enum(["tableau", "gabarit"]),
    /** La vérité de terrain : lue seulement une fois revue ; `a-revoir` par défaut. */
    verite: z.enum(["a-revoir", "revue"]).optional(),
  }).strict()).min(1),
}).strict();
export type Corpus = z.infer<typeof Corpus>;
export type DeckDuCorpus = Corpus["decks"][number];

export interface DeckCharge {
  readonly deck: DeckDuCorpus;
  /** Le chemin absolu du deck. */
  readonly chemin: string;
  readonly nom: string;
  readonly octets: Uint8Array;
  /** Le tableur de la vérité de terrain, à côté du deck. */
  readonly verite: string;
}

export interface CorpusCharge {
  readonly corpus: Corpus;
  readonly empreinte: string;
  readonly profil: ProfilSource;
  readonly decks: readonly DeckCharge[];
}

export function chargerCorpus(fichier: string): CorpusCharge {
  const brut = readFileSync(fichier);
  const corpus = Corpus.parse(JSON.parse(brut.toString("utf8")));
  const dossier = dirname(fichier);
  const profil = chargerProfil(resolve(dossier, corpus.profil.chemin));
  const changes: string[] = [];
  if (empreinteDuProfil(profil) !== corpus.profil.empreinte) changes.push(`le profil ${corpus.profil.chemin} (${empreinteDuProfil(profil)})`);
  const decks = corpus.decks.map((deck): DeckCharge => {
    const chemin = resolve(dossier, deck.chemin);
    if (!existsSync(chemin)) throw new Error(`corpus ${corpus.nom} : deck introuvable, ${deck.chemin}`);
    const octets = new Uint8Array(readFileSync(chemin));
    if (sha256(octets) !== deck.empreinte) changes.push(`le deck ${deck.chemin} (${sha256(octets)})`);
    return { deck, chemin, nom: basename(chemin), octets, verite: chemin.replace(/\.pptx$/i, "") + ".verite.csv" };
  });
  if (changes.length) {
    throw new Error(`corpus ${corpus.nom} : ${changes.join(" et ")} ne correspond(ent) plus à l'empreinte épinglée. Un deck ou un profil ne change que par décision : porter la nouvelle empreinte au manifeste.`);
  }
  return { corpus, empreinte: sha256(brut), profil, decks };
}

// ——— La vérité de terrain ———

/** Une ligne du tableur de vérité, telle qu'écrite (les colonnes absentes d'un tableur réenregistré se lisent vides). */
export interface LigneDeVerite {
  readonly diapo: string;
  readonly titre: string;
  readonly regles: string;
  readonly signal: string;
  readonly verite: string;
  /** « 1 » quand l'humain a vu la diapositive (la revue en suit l'avancement). */
  readonly vue: string;
  readonly note: string;
}

const COLONNES = ["diapo", "titre", "regles", "signal", "verite", "vue", "note"] as const;

const champ = (v: string) => `"${v.replace(/\s+/g, " ").trim().replace(/"/g, '""')}"`;

export function ecrireTableur(lignes: readonly LigneDeVerite[]): string {
  // Le BOM fait lire l'UTF-8 aux tableurs ; le point-virgule est le séparateur des tableurs en français.
  return "\uFEFF" + [COLONNES.join(";"), ...lignes.map((l) => COLONNES.map((c) => champ(l[c])).join(";"))].join("\n") + "\n";
}

/** Le tableur prérempli : une ligne par diapositive, la figure des règles recopiée en vérité, à corriger là où elle est fausse. */
export function tableurDeVerite(spec: SeanceSpec, qualifications: ReadonlyMap<number, Qualification>): string {
  const titres = new Map(spec.sequences.flatMap((s) => s.blocs).map((b) => [b.source.diapo, b.titre ?? ""]));
  return ecrireTableur([...qualifications].map(([n, q]) => ({
    diapo: String(n), titre: titres.get(n) ?? "", regles: q.figure, signal: q.signal, verite: q.figure, vue: "", note: "",
  })));
}

/** Les lignes d'un CSV : séparateur deviné sur l'en-tête (« ; », « , » ou tabulation), champs entre guillemets. */
function lignesCsv(texte: string): string[][] {
  const t = texte.replace(/^\uFEFF/, "");
  const entete = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", ",", "\t"].sort((a, b) => entete.split(b).length - entete.split(a).length)[0]!;
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = "";
  let guillemets = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (guillemets) {
      if (c === '"' && t[i + 1] === '"') { cellule += '"'; i++; }
      else if (c === '"') guillemets = false;
      else cellule += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) { ligne.push(cellule); cellule = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      ligne.push(cellule); cellule = "";
      if (ligne.some((x) => x.trim())) lignes.push(ligne);
      ligne = [];
    } else cellule += c;
  }
  ligne.push(cellule);
  if (ligne.some((x) => x.trim())) lignes.push(ligne);
  return lignes;
}

/** Le tableur de vérité, ligne à ligne, ses colonnes retrouvées par leur nom (un tableur peut les réordonner). */
export function lireTableur(fichier: string): LigneDeVerite[] {
  const [entete, ...lignes] = lignesCsv(readFileSync(fichier, "utf8"));
  const col = (nom: string) => (entete ?? []).findIndex((x) => sansAccents(x) === nom);
  if (col("diapo") < 0 || col("verite") < 0) throw new Error(`${fichier} : il faut les colonnes « diapo » et « verite »`);
  const index = Object.fromEntries(COLONNES.map((c) => [c, col(c)])) as Record<(typeof COLONNES)[number], number>;
  return lignes.map((l) => Object.fromEntries(COLONNES.map((c) => [c, index[c] >= 0 ? (l[index[c]] ?? "").trim() : ""])) as unknown as LigneDeVerite);
}

const sansAccents = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").normalize("NFKC").toLowerCase().trim();
const PAR_NOM = new Map<string, string>([
  ...FIGURES.map((f) => [sansAccents(f), f] as const),
  ...FIGURES.map((f) => [sansAccents(LIBELLES[f]), f] as const),
  ...CANDIDATES.map((f) => [sansAccents(f), f] as const),
]);

/** Une figure de la vérité : l'une des quinze, une candidate, ou « autre : <nom> » ; `null` sinon. */
export function figureDeVerite(v: string): string | null {
  const s = sansAccents(v);
  const connue = PAR_NOM.get(s);
  if (connue) return connue;
  // Un nom libre garde l'orthographe de l'humain, en minuscules.
  const autre = v.normalize("NFKC").toLowerCase().trim().match(/^autre\s*:\s*(.+)$/);
  return autre ? `autre : ${autre[1]!.replace(/\s+/g, " ")}` : null;
}

/** La vérité de terrain revue d'un deck : diapositive → figure ; refusée si une ligne manque ou ne se lit pas. */
export function lireVerite(fichier: string, diapos: number): Map<number, string> {
  const verite = new Map<number, string>();
  const lues = new Set<number>();
  const fautes: string[] = [];
  for (const l of lireTableur(fichier)) {
    const n = Number.parseInt(l.diapo, 10);
    const f = figureDeVerite(l.verite);
    if (!Number.isInteger(n) || n < 1 || n > diapos) { fautes.push(`diapositive « ${l.diapo} »`); continue; }
    lues.add(n);
    if (!f) fautes.push(`diapositive ${n} : « ${l.verite} » n'est ni une figure, ni une candidate, ni « autre : <nom> »`);
    else verite.set(n, f);
  }
  const manquantes = Array.from({ length: diapos }, (_, i) => i + 1).filter((n) => !lues.has(n));
  if (manquantes.length) fautes.push(`diapositives sans vérité : ${manquantes.join(", ")}`);
  if (fautes.length) throw new Error(`${fichier} : ${fautes.join(" ; ")}`);
  return verite;
}
