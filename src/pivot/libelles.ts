// Le nom lisible de chaque figure : les dispositions du PPT de validation, le rapport, la planche, le plan de la salle.
import type { Figure, Geste } from "./seance-spec";

export const LIBELLES: Readonly<Record<Figure, string>> = {
  couverture: "Couverture", "ecran-animation": "Écran d'animation", transition: "Transition", objectifs: "Objectifs",
  contenu: "Contenu", processus: "Processus", schema: "Schéma", demonstration: "Démonstration", "pas-a-pas": "Pas-à-pas",
  capture: "Capture", "mise-en-pratique": "Mise en pratique", "etapes-cles": "Étapes clés", synthese: "Synthèse",
  glossaire: "Glossaire", renvoi: "Renvoi",
};

/** Le nom lisible d'un geste : les dispositions `G · <geste>`, le plan de la salle, la fiche du livret. */
export const LIBELLES_DE_GESTE: Readonly<Record<Geste, string>> = {
  rappel: "Rappel", classement: "Classement", categorisation: "Catégorisation", "selection-sur-image": "Sélection sur image",
};

/** Le nom lisible d'un bloc de la salle ou du papier : sa figure, ou le geste de son activité. */
export const libelleDeBloc = (b: { readonly figure: Figure | "activite"; readonly activite?: { readonly geste: Geste } }): string =>
  (b.activite ? `Activité · ${LIBELLES_DE_GESTE[b.activite.geste]}` : b.figure === "activite" ? "Activité" : LIBELLES[b.figure]);
