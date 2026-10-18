// Le diagnostic d'un pivot : règles d'harmonisation H1–H9, anomalies de la source, état des pas (rapport `graduis/rapport@0`).
import { z } from "zod";
import type { Forme } from "../ooxml/formes";
import { sha256, stringify2 } from "../lib/json";
import type { Releve } from "../releve/releve";
import { estCapture } from "../releve/geometrie";
import { FIGURES, TEMPS_DE_FIGURE, type Bloc, type Figure, type SeanceSpec, type Temps } from "../pivot/seance-spec";
import type { Qualification } from "../qualification/figures";
import { GEOMETRIES } from "../dessin/geometries";
import { motif, type ProfilSource } from "../profil/profil";

export const SCHEMA_RAPPORT = "graduis/rapport@0";

/** La charte d'harmonisation : les seuils de H2, H3 et H9, validés avec le client sur son démonstrateur ; elle vit au procédé. */
export const Charte = z.object({
  motsParEcran: z.number().int().positive(),
  pastillesParCapture: z.number().int().positive(),
  ecartSequence: z.number().positive(),
}).strict();
export type Charte = z.infer<typeof Charte>;

export const NIVEAUX = ["bloquant", "avis", "a-valider", "info"] as const;
export type Niveau = (typeof NIVEAUX)[number];

export interface Constat {
  readonly regle: string;
  readonly niveau: Niveau;
  readonly diapo: number | null;
  readonly sequence: string | null;
  readonly message: string;
}

export interface LigneSequence {
  readonly id: string;
  /** Le numéro dérivé de l'ordre des transitions (`null` pour l'ouverture). */
  readonly numero: number | null;
  readonly titre: string;
  readonly diapositives: number;
  readonly operatoire: boolean;
  readonly temps: { readonly E: boolean; readonly R: boolean; readonly "R*": boolean };
  readonly demonstrations: number;
  readonly pas: number;
  readonly mots: number;
}

export interface Rapport {
  readonly schema: typeof SCHEMA_RAPPORT;
  readonly source: { readonly nom: string; readonly empreinte: string };
  readonly pivot: string;
  readonly synthese: {
    readonly diapositives: number;
    readonly figures: Readonly<Record<string, number>>;
    readonly pas: { readonly total: number; readonly repere: number; readonly legende: number; readonly proposee: number; readonly sansZone: number; readonly sansConsigne: number };
    readonly constats: Readonly<Record<Niveau, number>>;
  };
  readonly sequences: readonly LigneSequence[];
  readonly constats: readonly Constat[];
  readonly qualification: readonly { readonly diapo: number; readonly figure: Figure; readonly temps: Temps | null; readonly signal: string; readonly titre: string | null }[];
}

/** Les règles telles que le rapport les présente, à la charte du procédé : leur libellé et ce qu'on fait d'un constat. */
export const regles = (charte: Charte): Readonly<Record<string, { readonly libelle: string; readonly action: string }>> => ({
  H1: { libelle: "Une séquence opératoire a ses trois temps", action: "Exposition (pas-à-pas ou démonstration), Réalisation (mise en pratique), Régulation (étapes clés)." },
  H2: { libelle: `Au plus ${charte.motsParEcran} mots par écran projeté`, action: "Le surplus descend aux notes de l'animateur ou au papier du participant." },
  H3: { libelle: `Au plus ${charte.pastillesParCapture} pastilles par capture`, action: "Au-delà, la capture se découpe." },
  H4: { libelle: "La numérotation se dérive", action: "Les numéros saisis sont ignorés : l'ordre les donne." },
  H5: { libelle: "Des captures lisibles et commentées", action: "Recapturer ce qui est trop pauvre pour le zoom (moins d'un pixel source par pixel affiché à 1920) ; commenter ou passer en pas-à-pas ce qui est muet." },
  H6: { libelle: "Chaque mise en pratique a son propre énoncé", action: "Un énoncé repris d'un autre cas est une erreur de copie." },
  H8: { libelle: "Aucun marqueur d'inachèvement ne sort", action: "Bloquant : rien ne se livre tant qu'il en reste." },
  H9: { libelle: "Des séquences comparables", action: "Signalé au-delà du double, ou en deçà de la moitié, de la médiane des séquences opératoires." },
  PAS: { libelle: "Les pas à ancrer dans le PPT de validation", action: "Confirmer les zones proposées par ordre de lecture ; compléter les zones et consignes manquantes." },
  VIDE: { libelle: "Les diapositives sans contenu", action: "À supprimer ou à compléter." },
  DESSIN: { libelle: "Les schémas redessinés au thème", action: "Relire chaque schéma dans le PPT de validation : les couleurs d'origine regroupées sur un même rôle y perdent leur distinction ; une géométrie non prise en charge est dessinée en rectangle ; le dévoilement proposé et la recomposition en gabarit sont des lectures à confirmer." },
});

const mots = (s: string) => s.match(/\S+/gu)?.length ?? 0;

/** Similarité de Dice sur les bigrammes de lettres : tolère une coquille (« Tra,sformer » ≈ « Transformer »). */
function similarite(a: string, b: string): number {
  const bigrammes = (s: string) => {
    const t = s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "");
    const m = new Map<string, number>();
    for (let i = 0; i < t.length - 1; i++) m.set(t.slice(i, i + 2), (m.get(t.slice(i, i + 2)) ?? 0) + 1);
    return { m, n: Math.max(0, t.length - 1) };
  };
  const x = bigrammes(a);
  const y = bigrammes(b);
  if (!x.n || !y.n) return 0;
  let communs = 0;
  for (const [g, k] of x.m) communs += Math.min(k, y.m.get(g) ?? 0);
  return (2 * communs) / (x.n + y.n);
}
const SIMILAIRE = 0.85;

function texteDuBloc(b: Bloc): string {
  return [b.titre ?? "", ...b.textes, ...b.tableaux.flat(2), ...b.pas.map((p) => p.consigne ?? "")].join(" ");
}

function median(v: readonly number[]): number {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Ce que le diagnostic tient du procédé : sa charte et son profil de source (marqueurs, habillage d'origine). */
interface Cadre {
  readonly charte: Charte;
  readonly profil: ProfilSource;
}

export function diagnostiquer(spec: SeanceSpec, releve: Releve, qualifications: ReadonlyMap<number, Qualification>, { charte, profil }: Cadre): Rapport {
  const constats: Constat[] = [];
  const c = (regle: string, niveau: Niveau, diapo: number | null, sequence: string | null, message: string) =>
    constats.push({ regle, niveau, diapo, sequence, message });
  const diapos = new Map(releve.diapositives.map((d) => [d.n, d]));
  const { largeur } = releve.deck;

  // Séquences : temps, démonstrations, densité (H1, H9).
  let rang = 0;
  const lignes: LigneSequence[] = spec.sequences.map((s) => {
    const figures = s.blocs.map((b) => b.figure);
    const transition = s.blocs.find((b) => b.figure === "transition");
    if (transition) rang += 1;
    return {
      id: s.id,
      numero: transition ? rang : null,
      titre: transition?.titre ?? "(ouverture)",
      diapositives: s.blocs.length,
      operatoire: figures.includes("pas-a-pas"),
      temps: {
        E: figures.some((f) => TEMPS_DE_FIGURE[f] === "E"),
        R: figures.some((f) => TEMPS_DE_FIGURE[f] === "R"),
        "R*": figures.some((f) => TEMPS_DE_FIGURE[f] === "R*"),
      },
      demonstrations: figures.filter((f) => f === "demonstration").length,
      pas: s.blocs.reduce((n, b) => n + b.pas.length, 0),
      mots: s.blocs.reduce((n, b) => n + mots(texteDuBloc(b)), 0),
    };
  });
  for (const l of lignes.filter((x) => x.operatoire)) {
    const manque = (["E", "R", "R*"] as const).filter((t) => !l.temps[t]);
    if (manque.length) c("H1", "avis", null, l.id, `« ${l.titre} » : temps manquant (${manque.join(", ")}).`);
    if (!l.demonstrations) c("H1", "info", null, l.id, `« ${l.titre} » : aucune démonstration annoncée.`);
  }
  const op = lignes.filter((l) => l.operatoire);
  if (op.length >= 3) {
    for (const [mesure, unite] of [["diapositives", "diapositives"], ["mots", "mots"]] as const) {
      const m = median(op.map((l) => l[mesure]));
      for (const l of op) {
        if (l[mesure] > charte.ecartSequence * m || l[mesure] < m / charte.ecartSequence) {
          c("H9", "avis", null, l.id, `« ${l.titre} » : ${l[mesure]} ${unite}, pour une médiane de ${m} sur les séquences opératoires.`);
        }
      }
    }
  }

  // H4 — numéros de séquence saisis sur les transitions, contre l'ordre.
  const transitions = spec.sequences.flatMap((s) => s.blocs.filter((b) => b.figure === "transition"));
  const saisis = transitions.map((b) => b.textes.find((t) => /^\d{1,2}$/.test(t.trim())) ?? null);
  if (saisis.some((n, i) => n !== null && Number(n) !== i + 1)) {
    c("H4", "avis", null, null, `Numéros saisis sur les transitions : ${saisis.map((n) => n ?? "—").join(", ")} ; l'ordre donne 1 à ${transitions.length}. La numérotation sera dérivée.`);
  }

  // H6 — un énoncé de mise en pratique repris d'un autre cas.
  const vus: { cle: string; diapo: number }[] = [];
  for (const s of spec.sequences) {
    for (const b of s.blocs.filter((x) => x.figure === "mise-en-pratique")) {
      const cle = b.textes.filter((t) => !(profil.pratique && motif(profil.pratique.titre).teste(t))).join(" ").replace(/\s+/g, " ").trim();
      if (!cle) continue;
      const deja = vus.find((v) => similarite(v.cle, cle) >= SIMILAIRE);
      if (deja) c("H6", "avis", b.source.diapo, s.id, `Énoncé repris de la diapositive ${deja.diapo} : « ${cle.slice(0, 80)} ».`);
      else vus.push({ cle, diapo: b.source.diapo });
    }
  }

  for (const s of spec.sequences) {
    for (const b of s.blocs) {
      const n = b.source.diapo;
      const texte = [texteDuBloc(b), b.notes].join(" ");
      // H8
      for (const marqueur of profil.inacheve) {
        const m = motif(marqueur).trouve(texte);
        if (m !== null) c("H8", "bloquant", n, s.id, `Marqueur « ${m} »${b.masquee ? " (diapositive masquée)" : ""}.`);
      }
      // H2
      if (!b.masquee && !["glossaire", "schema"].includes(b.figure)) {
        const nb = mots([...b.textes, ...b.pas.map((p) => p.consigne ?? "")].join(" "));
        if (nb > charte.motsParEcran) c("H2", "avis", n, s.id, `${nb} mots à l'écran.`);
      }
      // H3
      const parCapture = new Map<string, number>();
      for (const p of b.pas) if (p.capture) parCapture.set(p.capture, (parCapture.get(p.capture) ?? 0) + 1);
      for (const nb of parCapture.values()) if (nb > charte.pastillesParCapture) c("H3", "avis", n, s.id, `${nb} pas sur une même capture : à découper.`);
      // H5
      const d = diapos.get(n);
      const zoomables = b.figure === "pas-a-pas" || b.figure === "capture";
      const caps = d && zoomables ? d.formes.filter((f) => f.media && estCapture(f as Forme, largeur)) : [];
      for (const f of caps) {
        const px = releve.medias[f.media!]?.px;
        if (px && px[0] / ((f.boite[2] / largeur) * 1920) < 1) {
          c("H5", "avis", n, s.id, `Sous-résolue : ${px[0]} px pour ${Math.round((f.boite[2] / largeur) * 1920)} px affichés.`);
        }
      }
      if (b.figure === "capture" && !b.masquee) c("H5", "avis", n, s.id, "Capture muette.");
      // PAS
      const proposes = b.pas.filter((p) => p.ancrage === "proposee").map((p) => p.numero);
      if (proposes.length) c("PAS", "a-valider", n, s.id, `Zone proposée par ordre de lecture pour ${proposes.length > 1 ? "les pas" : "le pas"} ${proposes.join(", ")}.`);
      const sansZone = b.pas.filter((p) => !p.zone).map((p) => p.numero);
      if (sansZone.length) c("PAS", "avis", n, s.id, `Sans zone sur la capture : pas ${sansZone.join(", ")}.`);
      const sansConsigne = b.pas.filter((p) => !p.consigne).map((p) => p.numero);
      if (sansConsigne.length) c("PAS", "avis", n, s.id, `Sans consigne : pas ${sansConsigne.join(", ")}.`);
      // DESSIN — la projection des couleurs d'origine sur les rôles, les géométries non prises en charge.
      const projection = qualifications.get(n)?.projection;
      if (b.dessin && projection) {
        const nb = projection.roles.size;
        const roles = new Set(projection.roles.values()).size;
        const fondues = projection.fusions.map((f) => `${f.role} ← ${f.origines.join(", ")}`);
        c("DESSIN", "info", n, s.id, `${b.dessin.elements.length} éléments ; ${nb} couleurs d'origine sur ${roles} rôles${fondues.length ? ` (fondues : ${fondues.join(" ; ")})` : ""}.`);
        for (const f of projection.fusions.filter((x) => x.distinctes)) {
          c("DESSIN", "a-valider", n, s.id, `Couleurs nettement distinctes sur un même rôle, faute de ton libre : ${f.role} ← ${f.origines.join(", ")}.`);
        }
        const prises = new Set<string>([...GEOMETRIES, "libre"]);
        const autres = [...new Set(b.dessin.elements.flatMap((e) => (e.type === "forme" && !prises.has(e.geometrie) ? [e.geometrie] : [])))].sort();
        if (autres.length) c("DESSIN", "a-valider", n, s.id, `Dessinées en rectangle : ${autres.join(", ")}.`);
        const partition = b.dessin.partition;
        if (partition) c("DESSIN", "a-valider", n, s.id, `Dévoilement proposé en ${partition.pas} pas, ${partition.mode === "colonnes" ? "colonne par colonne" : "par étapes numérotées"}.`);
      }
      if (b.composition?.gabarit === "cas") {
        const etapes = b.composition.cas.flatMap((k) => k.etapes);
        const details = etapes.filter((e) => e.detail).length;
        const legende = b.composition.legende?.length ?? 0;
        c("DESSIN", "a-valider", n, s.id, `Recomposé au gabarit « cas » : ${b.composition.cas.length} colonnes, ${etapes.length} étapes${details ? ` (dont ${details} avec détail)` : ""}${legende ? `, légende de ${legende} entrées` : ""}.`);
      }
      if (b.composition?.gabarit === "tableau") {
        const t = b.composition;
        const sans = t.etapes.filter((e) => e.numero === undefined).length;
        c("DESSIN", "a-valider", n, s.id, `Recomposé au gabarit « tableau » : ${t.colonnes.length} phases, ${t.lignes.length} couloirs, ${t.etapes.length} étapes${sans ? ` (dont ${sans} sans numéro)` : ""}${t.legende?.length ? `, légende de ${t.legende.length} entrées` : ""}.`);
        // L'harmonisation sur la légende : chaque manière ou signal ramené à ce que la légende nomme.
        const h = qualifications.get(n)?.harmonisations ?? [];
        const manieres = h.filter((x) => x.quoi === "maniere");
        const signaux = h.filter((x) => x.quoi === "signal");
        const groupes = (xs: typeof h) => [...new Set(xs.map((x) => `${x.de} → ${x.vers}`))].map((g) => `${g} (${xs.filter((x) => `${x.de} → ${x.vers}` === g).length})`).join(" ; ");
        if (manieres.length) c("DESSIN", "a-valider", n, s.id, `${manieres.length} étapes harmonisées sur la légende, faute d'une manière qu'elle nomme : ${groupes(manieres)}.`);
        if (signaux.length) c("DESSIN", "a-valider", n, s.id, `${signaux.length} signaux harmonisés sur la légende : ${groupes(signaux)}.`);
      }
      // VIDE
      if (b.figure === "contenu" && !b.titre && !b.textes.length && !b.visuels.length && !b.tableaux.length) {
        c("VIDE", "avis", n, s.id, "Diapositive sans contenu.");
      }
    }
  }

  const blocs = spec.sequences.flatMap((s) => s.blocs);
  const tousPas = blocs.flatMap((b) => b.pas);
  const figures = Object.fromEntries(FIGURES.map((f) => [f, blocs.filter((b) => b.figure === f).length]).filter(([, v]) => v));
  return {
    schema: SCHEMA_RAPPORT,
    source: spec.source,
    pivot: sha256(stringify2(spec)),
    synthese: {
      diapositives: blocs.length,
      figures,
      pas: {
        total: tousPas.length,
        repere: tousPas.filter((p) => p.ancrage === "repere").length,
        legende: tousPas.filter((p) => p.ancrage === "legende").length,
        proposee: tousPas.filter((p) => p.ancrage === "proposee").length,
        sansZone: tousPas.filter((p) => !p.zone).length,
        sansConsigne: tousPas.filter((p) => !p.consigne).length,
      },
      constats: Object.fromEntries(NIVEAUX.map((n) => [n, constats.filter((x) => x.niveau === n).length])) as Record<Niveau, number>,
    },
    sequences: lignes,
    constats,
    qualification: blocs.map((b) => {
      // Un pivot lu dans le PPT de validation : la figure est celle de la disposition, que la revue a pu changer.
      const q = qualifications.get(b.source.diapo);
      const signal = q && q.figure === b.figure ? q.signal : "disposition du PPT de validation (lecture grammaticale)";
      return { diapo: b.source.diapo, figure: b.figure, temps: TEMPS_DE_FIGURE[b.figure], signal, titre: b.titre };
    }),
  };
}
