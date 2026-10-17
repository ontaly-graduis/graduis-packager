// La grammaire du PPT de validation (PKG-C) : ce que `emettre` écrit et que `lire` lit, en un seul endroit. Une
// disposition par figure, nommée par elle ; des formes nommées (pastille, zone, capture) ; des espaces réservés
// (titre, contenu, consignes) ; l'identité du bloc dans des étiquettes OOXML, la source dans les propriétés du document.
import { FIGURES, type Figure } from "../pivot/seance-spec";

export const LIBELLES: Readonly<Record<Figure, string>> = {
  couverture: "Couverture", "ecran-animation": "Écran d'animation", transition: "Transition", objectifs: "Objectifs",
  contenu: "Contenu", processus: "Processus", schema: "Schéma", demonstration: "Démonstration", "pas-a-pas": "Pas-à-pas",
  capture: "Capture", "mise-en-pratique": "Mise en pratique", "etapes-cles": "Étapes clés", synthese: "Synthèse",
  glossaire: "Glossaire", renvoi: "Renvoi",
};

/** Le nom de la disposition d'une figure : le contrat que `lire` lit, sans rien deviner. */
export const disposition = (f: Figure) => `G · ${LIBELLES[f]}`;
const FIGURE_DE_DISPOSITION = new Map(FIGURES.map((f) => [disposition(f), f]));
export const figureDeDisposition = (nom: string): Figure | undefined => FIGURE_DE_DISPOSITION.get(nom.trim());

/** Les figures dont la capture occupe la diapositive, consignes à droite. */
export const FIGURES_A_CAPTURE: ReadonlySet<Figure> = new Set(["pas-a-pas", "capture", "demonstration"]);

/** Les noms des formes de la grammaire (volet Sélection de PowerPoint). */
export const NOMS = {
  pastille: "G·pastille",
  zone: "G·zone",
  capture: "G·capture",
  visuel: "G·visuel",
  tableau: "G·tableau",
} as const;

/** L'ancrage d'une zone se lit dans son nom : « G·zone » (repère), « G·zone · légende », « G·zone · proposée ✦ » (à valider). */
export const SUFFIXES_DE_ZONE = { repere: "", legende: " · légende", proposee: " · proposée ✦" } as const;
export function ancrageDeZone(nom: string): "repere" | "legende" | "proposee" | null {
  if (!nom.startsWith(NOMS.zone)) return null;
  if (nom.includes("proposée")) return "proposee";
  if (nom.includes("légende")) return "legende";
  return "repere";
}

/** Les espaces réservés : le titre, le contenu (un paragraphe par texte), les consignes (un paragraphe par pas, par rang). */
export const ESPACES = { contenu: 1, consignes: 2 } as const;

/** Les étiquettes OOXML d'une diapositive (PowerPoint les met en capitales et les duplique avec elle). */
export const ETIQUETTES = {
  bloc: "GRADUIS.BLOC",
  source: "GRADUIS.SOURCE",
  /** Provisoire (PKG-C1) : les lectures heuristiques sans grammaire encore (dessin, structure, composition), en JSON. */
  lectures: "GRADUIS.LECTURES",
} as const;

/** Les propriétés personnalisées du document : le deck hérité dont le pivot procède. */
export const PROPRIETES = { nom: "graduis.source.nom", empreinte: "graduis.source.empreinte" } as const;

/** La diapositive 16:9 et ses unités. */
export const EMU = { largeur: 12192000, hauteur: 6858000, pouce: 914400, point: 12700 } as const;
