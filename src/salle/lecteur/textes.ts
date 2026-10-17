// L'ajustement des textes d'un schéma : la police du thème n'a pas la chasse de l'originale ; un texte qui déborde de sa forme
// se réduit, comme la réduction automatique de PowerPoint, jusqu'à un plancher de lisibilité.

/** En deçà, le texte déborde plutôt que de devenir illisible. */
export const REDUCTION_MIN = 0.7;
const PAS = 0.04;
const PASSES = 10;

/**
 * Le texte sort-il de sa boîte ? En hauteur, d'après ses lignes (le bloc qui les porte) ; en largeur, d'après l'étendue réelle
 * des glyphes (un débord centré part des deux côtés), mesurée à l'écran.
 */
export function deborde(b: HTMLElement): boolean {
  const l = b.firstElementChild;
  if (!l) return false;
  const c = b.getBoundingClientRect();
  const lignes = l.getBoundingClientRect();
  const r = b.ownerDocument.createRange();
  r.selectNodeContents(l);
  const glyphes = r.getBoundingClientRect();
  const e = 0.75;
  return glyphes.left < c.left - e || glyphes.right > c.right + e || lignes.top < c.top - e || lignes.bottom > c.bottom + e;
}

/**
 * Réduit `--ajuste` des boîtes de texte qui débordent ; chaque passe lit toutes les boîtes, puis les écrit (une mise en page par
 * passe). Un mot trop long pour sa forme fait réduire le texte plutôt que de se couper ; au plancher seulement, il se coupe.
 */
export function ajusterTextes(racine: Element): void {
  let boites = [...racine.querySelectorAll<HTMLElement>(".dessin .bt")];
  boites.forEach((b) => {
    b.style.removeProperty("--ajuste");
    b.classList.remove("coupe");
  });
  const ajuste = new Map<HTMLElement, number>();
  for (let passe = 0; passe < PASSES && boites.length; passe++) {
    const debordent = boites.filter(deborde);
    for (const b of debordent) {
      const k = Math.max(REDUCTION_MIN, Math.round(((ajuste.get(b) ?? 1) - PAS) * 100) / 100);
      ajuste.set(b, k);
      b.style.setProperty("--ajuste", String(k));
    }
    boites = debordent.filter((b) => (ajuste.get(b) ?? 1) > REDUCTION_MIN);
  }
  for (const b of ajuste.keys()) if (ajuste.get(b) === REDUCTION_MIN) b.classList.add("coupe");
}
