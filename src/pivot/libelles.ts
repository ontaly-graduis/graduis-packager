// Le nom lisible de chaque figure : les dispositions du PPT de validation, le rapport, la planche, le plan de la salle.
import type { Figure } from "./seance-spec";

export const LIBELLES: Readonly<Record<Figure, string>> = {
  couverture: "Couverture", "ecran-animation": "Écran d'animation", transition: "Transition", objectifs: "Objectifs",
  contenu: "Contenu", processus: "Processus", schema: "Schéma", demonstration: "Démonstration", "pas-a-pas": "Pas-à-pas",
  capture: "Capture", "mise-en-pratique": "Mise en pratique", "etapes-cles": "Étapes clés", synthese: "Synthèse",
  glossaire: "Glossaire", renvoi: "Renvoi",
};
