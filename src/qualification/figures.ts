// La figure d'une diapositive héritée, par règles (disposition × contenu), avec le signal qui l'a décidée : celles du profil
// de source d'abord (ses dispositions, formules et titres), puis les règles génériques.
import type { DiapositiveReleve, FormeReleve } from "../releve/releve";
import type { Forme } from "../ooxml/formes";
import { estCapture, texteDe } from "../releve/geometrie";
import type { Harmonisation } from "./gabarits";
import type { Projection } from "./roles";
import type { Figure } from "../pivot/seance-spec";
import { LIBELLES } from "../pivot/libelles";
import { motif, type ProfilSource } from "../profil/profil";

export interface Qualification {
  readonly figure: Figure;
  /** La règle qui a décidé, en clair : elle s'affiche au rapport. */
  readonly signal: string;
  /** Pour un schéma : la projection de ses couleurs d'origine sur les rôles du thème (pour le rapport). */
  readonly projection?: Projection;
  /** Pour un schéma recomposé : ce que l'harmonisation sur sa légende a changé (pour le rapport). */
  readonly harmonisations?: readonly Harmonisation[];
}

/** Espaces réservés qui ne portent pas de contenu : numéro, date, pied. */
export const ESPACES_DE_SERVICE: ReadonlySet<string> = new Set(["sldNum", "dt", "ftr"]);

/** Le signal de la première diapositive : une couverture par sa seule position (GEN-0 la compte à part). */
export const SIGNAL_POSITION = "première diapositive";

/** Le signal du repli : aucune règle n'a décidé (GEN-0 : une diapositive au repli n'est pas décidée). */
export const SIGNAL_REPLI = "aucune règle particulière";

/** Le seuil au-delà duquel un assemblage de formes est un schéma (mesuré : fiches personae 56 à 88 formes). */
export const SEUIL_SCHEMA = 20;

export function estDeService(f: FormeReleve): boolean {
  return f.espace !== undefined && ESPACES_DE_SERVICE.has(f.espace.type);
}

/** Tout le texte porteur de la diapositive, en minuscules (espaces de service exclus). */
function texteDiapo(d: DiapositiveReleve): string {
  return d.formes.filter((f) => !estDeService(f)).map((f) => texteDe(f as Forme)).join(" ").toLowerCase();
}

/** La règle du profil qui répond à une diapositive : la figure qu'elle décide, par quoi, et le signal qui le dit au rapport. */
export function figureDuProfil(profil: ProfilSource, disposition: string, texte: string, titre: string | null): { figure: Figure; signal: string; par: "disposition" | "formule" | "titre" } | null {
  const r = profil.dispositions.find((x) => motif(x.disposition).teste(disposition));
  if (!r) return null;
  const nom = LIBELLES[r.figure].toLowerCase();
  const f = r.formules?.find((x) => motif(x.texte).teste(texte));
  if (f) return { figure: f.figure, signal: `${nom}, texte « ${f.libelle} »`, par: "formule" };
  const t = r.titres?.find((x) => motif(x.titre).teste(titre ?? ""));
  if (t) return { figure: t.figure, signal: `${nom} titrée « ${t.libelle} »`, par: "titre" };
  return { figure: r.figure, signal: `disposition « ${disposition} »`, par: "disposition" };
}

export function qualifier(d: DiapositiveReleve, largeur: number, titre: string | null, profil: ProfilSource): Qualification {
  const t = texteDiapo(d);
  const q = (figure: Figure, signal: string): Qualification => ({ figure, signal });
  if (d.n === 1) return q("couverture", SIGNAL_POSITION);
  const parProfil = figureDuProfil(profil, d.disposition, t, titre);
  if (parProfil) return q(parProfil.figure, parProfil.signal);
  if (d.pas_a_pas) return q("pas-a-pas", `capture et ${d.pas_a_pas.pas.length} pas numérotés`);
  const liens = d.liens.some((l) => /\.pptx?(\?|$)/i.test(l));
  if (liens || /lien vers|insérer lien/.test(t)) return q("renvoi", liens ? "lien vers un autre deck" : "texte « lien vers »");
  // Le dessin passe avant le tableau : un logigramme peut porter un petit tableau de légende (diapo 31).
  const dessin = d.formes.filter((f) => ["forme", "texte", "libre", "trait"].includes(f.nature) && !estDeService(f)).length;
  if (dessin >= SEUIL_SCHEMA) return q("schema", `${dessin} formes dessinées`);
  if (d.formes.some((f) => f.nature === "tableau")) {
    const processus = /processus|étape/.test(t) || (profil.processus !== undefined && motif(profil.processus).teste(t));
    return processus ? q("processus", "tableau d'étapes de processus") : q("contenu", "tableau");
  }
  if (d.formes.some((f) => estCapture(f as Forme, largeur))) return q("capture", "capture sans pastille");
  if (/^objectifs?\b/i.test(titre ?? "")) return q("objectifs", "titre « Objectifs »");
  return q("contenu", SIGNAL_REPLI);
}
