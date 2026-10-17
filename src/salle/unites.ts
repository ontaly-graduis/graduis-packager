// Le dévoilement d'un texte organisé, par niveau de hiérarchie 1 (comme « par paragraphes de niveau 1 » dans
// PowerPoint) : une fiche paraît entière ; une section paraît avec son intertitre et tout ce qu'elle annonce ; hors
// section, chaque élément de premier rang (paragraphe, item et ses détails, définition) paraît seul.
import type { Structure } from "../pivot/seance-spec";

export interface PlanDeDevoilement {
  /** Le nombre d'unités : les étapes du dévoilement. */
  readonly total: number;
  /** Pour chaque atome (intertitre, paragraphe, item, définition), dans l'ordre du rendu : son unité. */
  readonly atomes: readonly number[];
}

export function planDeDevoilement(s: Structure): PlanDeDevoilement {
  const atomes: number[] = [];
  let u = -1;
  for (const r of s.rangees) {
    for (const c of r.colonnes) {
      const fiche = r.colonnes.length > 1 || !!c.visuel;
      if (fiche) u += 1;
      let section = false;
      let titreSeul = false;
      for (const n of c.noeuds) {
        const nombre = n.type === "liste" ? n.items.length : n.type === "definitions" ? n.entrees.length : 1;
        if (fiche) {
          for (let k = 0; k < nombre; k++) atomes.push(u);
          continue;
        }
        if (n.type === "titre") {
          // Des intertitres qui se suivent ouvrent une seule section.
          if (!titreSeul) u += 1;
          section = true;
          titreSeul = true;
          atomes.push(u);
          continue;
        }
        titreSeul = false;
        for (let k = 0; k < nombre; k++) {
          if (!section) u += 1;
          atomes.push(u);
        }
      }
    }
  }
  return { total: u + 1, atomes };
}
