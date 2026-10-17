// Le défilement d'une colonne qui déborde : pages d'un contenu statique, pile qui suit l'item courant d'un dévoilement.

/** Un item (ligne de liste, rangée de tableau) en pixels de scène, relatif au haut du rail. */
export interface Item {
  readonly haut: number;
  readonly bas: number;
}

/** Les débuts de page d'un contenu statique : une page s'ouvre au premier item qui ne tient plus dans la fenêtre. */
export function debutsDePages(items: readonly Item[], fenetre: number): number[] {
  const debuts = [0];
  for (const it of items) {
    const debut = debuts[debuts.length - 1]!;
    if (it.bas - debut > fenetre + 0.5 && it.haut > debut) debuts.push(it.haut);
  }
  return debuts;
}

const borne = (v: number, total: number, fenetre: number) => Math.max(0, Math.min(v, Math.max(0, total - fenetre)));

/** Le décalage d'une page ; la dernière s'aligne sur le bas du contenu pour garder du contexte au-dessus. */
export function decalagePage(debuts: readonly number[], page: number, total: number, fenetre: number): number {
  return borne(debuts[Math.min(page, debuts.length - 1)] ?? 0, total, fenetre);
}

/**
 * Le décalage qui montre l'item courant en entier en gardant au-dessus le plus de prédécesseurs possible :
 * la pile monte d'un cran quand le nouvel item ne tient plus. Un item plus haut que la fenêtre s'aligne sur son haut.
 */
export function decalageCourant(courant: Item, total: number, fenetre: number): number {
  return borne(Math.min(courant.haut, Math.max(0, courant.bas - fenetre)), total, fenetre);
}
