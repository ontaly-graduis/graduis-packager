// L'habillage d'une activité dérivée : ce que la salle, le papier et le PPT d'auteur disent autour de son contenu (titre,
// consigne, touches de la régie). Il naît au rendu, jamais au pivot : ce n'est pas un mot inventé (spec v1 § 2.2). Sans zod,
// pour que les lecteurs de la salle et du papier le reprennent.
import type { Derivation, Geste } from "../pivot/seance-spec";

/** Le titre d'une activité, par dérivation ; « qui fait quoi » ne le dit que d'une colonne d'acteurs. */
export function titreDActivite(derivation: Derivation, intitule?: string): string {
  switch (derivation) {
    case "rappel": return "Qu'avez-vous retenu ?";
    case "etapes-a-replacer": case "ordre-des-pas": return "Dans quel ordre ?";
    case "qui-fait-quoi": return /acteur|r[ôo]le|qui|responsable|intervenant|porteur/i.test(intitule ?? "") ? "Qui fait quoi ?" : "Où ranger chaque étape ?";
    case "ou-cliquez-vous": return "Où cliquez-vous ?";
  }
}

/** La consigne projetée, par dérivation. */
export const CONSIGNES_DE_SALLE: Readonly<Record<Derivation, string>> = {
  rappel: "De mémoire d'abord : on dévoile ensuite.",
  "etapes-a-replacer": "Remettez les étapes dans l'ordre.",
  "ordre-des-pas": "Remettez les pas dans l'ordre.",
  "qui-fait-quoi": "Rangez chaque étape dans sa colonne.",
  "ou-cliquez-vous": "Désignez la zone à l'écran.",
};

/** La consigne du livret, par geste : le repli papier (spec v1 § 5.2). */
export const CONSIGNES_DE_PAPIER: Readonly<Record<Geste, string>> = {
  rappel: "Notez ce que vous en retenez.",
  classement: "Numérotez dans l'ordre : 1, 2, 3…",
  categorisation: "Cochez la colonne de chaque étape.",
  "selection-sur-image": "Entourez et numérotez chaque zone sur la capture.",
};

/** Les touches de la régie, par geste : ce que le présentateur et l'aide rappellent. */
export const TOUCHES_DE_REGIE: Readonly<Record<Geste, string>> = {
  rappel: "1–9 : marquer ce qui sort · ⌫ : annuler · → : dévoiler le reste",
  classement: "les numéros dans l'ordre dicté · ⌫ : annuler · → : le corrigé",
  categorisation: "numéro de carte, puis numéro de colonne · ⌫ : annuler · → : le corrigé",
  "selection-sur-image": "→ : dévoiler la zone, puis le pas suivant",
};

/** La mention de la source, sous le titre : l'activité pointe, elle le dit. */
export const dApres = (titre: string) => `D'après : ${titre.replace(/\s+/g, " ").trim()}`;

/** La durée, telle qu'elle s'écrit dans le PPT d'auteur et se relit (« 5 min »). */
export const ecrireDuree = (minutes: number) => `${minutes} min`;
export function lireDuree(texte: string): number | null {
  const m = texte.match(/^\s*(\d{1,3})\s*min/i);
  return m && Number(m[1]) > 0 ? Number(m[1]) : null;
}
