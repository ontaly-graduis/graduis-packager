// La figure d'une diapositive héritée, par règles (disposition × contenu), avec le signal qui l'a décidée.
import type { DiapositiveReleve, FormeReleve } from "../releve/releve";
import type { Forme } from "../ooxml/formes";
import { estCapture, texteDe } from "../releve/geometrie";
import type { Figure } from "../pivot/seance-spec";

export interface Qualification {
  readonly figure: Figure;
  /** La règle qui a décidé, en clair : elle s'affiche au rapport. */
  readonly signal: string;
}

/** Espaces réservés qui ne portent pas de contenu : numéro, date, pied. */
export const ESPACES_DE_SERVICE: ReadonlySet<string> = new Set(["sldNum", "dt", "ftr"]);

/** Le seuil au-delà duquel un assemblage de formes est un schéma (mesuré : fiches personae 56 à 88 formes). */
export const SEUIL_SCHEMA = 20;

export function estDeService(f: FormeReleve): boolean {
  return f.espace !== undefined && ESPACES_DE_SERVICE.has(f.espace.type);
}

/** Tout le texte porteur de la diapositive, en minuscules (espaces de service exclus). */
function texteDiapo(d: DiapositiveReleve): string {
  return d.formes.filter((f) => !estDeService(f)).map((f) => texteDe(f as Forme)).join(" ").toLowerCase();
}

export function qualifier(d: DiapositiveReleve, largeur: number, titre: string | null): Qualification {
  const disp = d.disposition;
  const t = texteDiapo(d);
  const q = (figure: Figure, signal: string): Qualification => ({ figure, signal });
  if (d.n === 1) return q("couverture", "première diapositive");
  if (disp.includes("Slide transition")) return q("transition", `disposition « ${disp} »`);
  if (/Pause|Déjeuner|remerciement|Meteo/i.test(disp)) return q("ecran-animation", `disposition « ${disp} »`);
  if (disp.includes("Ecran Votre promotion")) {
    if (t.includes("démonstration")) return q("demonstration", `écran d'animation, texte « Démonstration »`);
    if (/[aà] vous de jouer/.test(t)) return q("mise-en-pratique", `écran d'animation, texte « À vous de jouer »`);
    return q("ecran-animation", `disposition « ${disp} »`);
  }
  if (disp.includes("Regles du jeu")) return q("mise-en-pratique", `disposition « ${disp} »`);
  if (disp.includes("Que retenez")) return q("etapes-cles", `disposition « ${disp} »`);
  if (disp.includes("Synthese")) {
    return /glossaire/i.test(titre ?? "") ? q("glossaire", "synthèse titrée « Glossaire »") : q("synthese", `disposition « ${disp} »`);
  }
  if (d.pas_a_pas) return q("pas-a-pas", `capture et ${d.pas_a_pas.pas.length} pas numérotés`);
  const liens = d.liens.some((l) => /\.pptx?(\?|$)/i.test(l));
  if (liens || /lien vers|insérer lien/.test(t)) return q("renvoi", liens ? "lien vers un autre deck" : "texte « lien vers »");
  // Le dessin passe avant le tableau : un logigramme peut porter un petit tableau de légende (diapo 31).
  const dessin = d.formes.filter((f) => ["forme", "texte", "libre", "trait"].includes(f.nature) && !estDeService(f)).length;
  if (dessin >= SEUIL_SCHEMA) return q("schema", `${dessin} formes dessinées`);
  if (d.formes.some((f) => f.nature === "tableau")) {
    return /processus|étape|ptp-\d/.test(t) ? q("processus", "tableau d'étapes de processus") : q("contenu", "tableau");
  }
  if (d.formes.some((f) => estCapture(f as Forme, largeur))) return q("capture", "capture sans pastille");
  if (/^objectifs?\b/i.test(titre ?? "")) return q("objectifs", "titre « Objectifs »");
  return q("contenu", "aucune règle particulière");
}
