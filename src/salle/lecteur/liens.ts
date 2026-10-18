// Les liens d'un tableau composé, tracés une fois la grille posée (la salle et le papier).

/** Les liens d'un tableau : de la pastille d'une étape à celle de la suivante, mesurés une fois la grille posée. */
export function relier(grille: HTMLElement): void {
  const g = grille.getBoundingClientRect();
  const s = g.width / (grille.offsetWidth || 1) || 1;
  const svg = grille.querySelector<SVGSVGElement>(".tab-flux");
  if (!svg) return;
  svg.setAttribute("viewBox", `0 0 ${grille.offsetWidth} ${grille.offsetHeight}`);
  const point = (k: string): [number, number] | null => {
    const n = grille.querySelector(`.tab-etape[data-k="${k}"] .cas-numero`);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return [(r.left + r.width / 2 - g.left) / s, (r.top + r.height / 2 - g.top) / s];
  };
  svg.querySelectorAll<SVGPathElement>(".tab-lien").forEach((l) => {
    const a = point(l.dataset["de"] ?? "");
    const b = point(l.dataset["a"] ?? "");
    if (a && b) l.setAttribute("d", `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`);
  });
}
