// Les géométries prédéfinies DrawingML utilisées par les schémas, traduites en chemins SVG (formules d'ECMA-376, presetShapeDefinitions).
export type Point = readonly [number, number];

export interface Trace {
  /** Le contour plein (remplissable et traçable). */
  readonly d: string;
  /** Des traits sans remplissage (barres d'un processus prédéfini…). */
  readonly traits?: string;
  /** Pour un trait ouvert : la ligne brisée (la direction de ses bouts oriente les flèches). */
  readonly points?: readonly Point[];
  /** Le rectangle de texte, relatif à la boîte : [x, y, largeur, hauteur]. */
  readonly texte?: readonly [number, number, number, number];
}

const n = (v: number) => String(Math.round(v * 100) / 100);
const M = (x: number, y: number) => `M${n(x)} ${n(y)}`;
const L = (x: number, y: number) => `L${n(x)} ${n(y)}`;

export function ligne(points: readonly Point[]): string {
  return points.map(([x, y], i) => (i ? L(x, y) : M(x, y))).join("");
}

function ouvert(points: readonly Point[]): Trace {
  return { d: ligne(points), points };
}

function polygone(points: readonly Point[]): string {
  return points.map(([x, y], i) => (i ? L(x, y) : M(x, y))).join("") + "Z";
}

function rectangleArrondi(x: number, y: number, w: number, h: number, r: number): string {
  if (r <= 0) return polygone([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
  const a = (dx: number, dy: number) => `A${n(r)} ${n(r)} 0 0 1 ${n(dx)} ${n(dy)}`;
  return M(x + r, y) + L(x + w - r, y) + a(x + w, y + r) + L(x + w, y + h - r) + a(x + w - r, y + h)
    + L(x + r, y + h) + a(x, y + h - r) + L(x, y + r) + a(x + r, y) + "Z";
}

function ellipse(x: number, y: number, w: number, h: number): string {
  const [rx, ry] = [w / 2, h / 2];
  return M(x, y + ry) + `A${n(rx)} ${n(ry)} 0 1 1 ${n(x + w)} ${n(y + ry)}` + `A${n(rx)} ${n(ry)} 0 1 1 ${n(x)} ${n(y + ry)}Z`;
}

/** La bulle à coins arrondis : la pointe sort du côté que désignent adj1/adj2 (formules `wedgeRoundRectCallout`). */
function bulle(x: number, y: number, w: number, h: number, a1: number, a2: number, a3: number): string {
  const [l, t, r, b] = [x, y, x + w, y + h];
  const ss = Math.min(w, h);
  const dxPos = (w * a1) / 100000;
  const dyPos = (h * a2) / 100000;
  const xPos = x + w / 2 + dxPos;
  const yPos = y + h / 2 + dyPos;
  const dz = Math.abs(dyPos) - Math.abs((dxPos * h) / w);
  const x1 = x + (w * (dxPos > 0 ? 7 : 2)) / 12;
  const x2 = x + (w * (dxPos > 0 ? 10 : 5)) / 12;
  const y1 = y + (h * (dyPos > 0 ? 7 : 2)) / 12;
  const y2 = y + (h * (dyPos > 0 ? 10 : 5)) / 12;
  const xl = dz > 0 ? l : dxPos > 0 ? l : xPos;
  const xt = dz > 0 ? (dyPos > 0 ? x1 : xPos) : x1;
  const xr = dz > 0 ? r : dxPos > 0 ? xPos : r;
  const xb = dz > 0 ? (dyPos > 0 ? xPos : x1) : x1;
  const yl = dz > 0 ? y1 : dxPos > 0 ? y1 : yPos;
  const yt = dz > 0 ? (dyPos > 0 ? t : yPos) : t;
  const yr = dz > 0 ? y1 : dxPos > 0 ? yPos : y1;
  const yb = dz > 0 ? (dyPos > 0 ? yPos : b) : b;
  const u1 = (ss * a3) / 100000;
  const a = (dx: number, dy: number) => `A${n(u1)} ${n(u1)} 0 0 1 ${n(dx)} ${n(dy)}`;
  return M(l, t + u1) + a(l + u1, t) + L(x1, t) + L(xt, yt) + L(x2, t) + L(r - u1, t) + a(r, t + u1)
    + L(r, y1) + L(xr, yr) + L(r, y2) + L(r, b - u1) + a(r - u1, b)
    + L(x2, b) + L(xb, yb) + L(x1, b) + L(l + u1, b) + a(l, b - u1)
    + L(l, y2) + L(xl, yl) + L(l, y1) + "Z";
}

/** Les géométries prises en charge (les autres se dessinent en rectangle et sont signalées au rapport). */
export const GEOMETRIES = [
  "rect", "roundRect", "ellipse", "flowChartConnector", "flowChartProcess", "flowChartAlternateProcess", "homePlate", "triangle",
  "line", "straightConnector1", "bentConnector2", "bentConnector3", "bentConnector4", "wedgeRoundRectCallout", "wedgeRectCallout",
  "flowChartDecision", "diamond", "flowChartPredefinedProcess", "flowChartTerminator", "chevron", "rightArrow",
] as const;

/** Le tracé d'une géométrie prédéfinie dans la boîte (x, y, w, h), ajustements en cent-millièmes. */
export function tracer(geometrie: string, x: number, y: number, w: number, h: number, adj: Readonly<Record<string, number>> = {}): Trace {
  const ss = Math.min(w, h);
  const [l, t, r, b, hc, vc] = [x, y, x + w, y + h, x + w / 2, y + h / 2];
  const plein: Trace["texte"] = [0, 0, w, h];
  switch (geometrie) {
    case "roundRect":
    case "flowChartAlternateProcess": {
      const a = Math.min(50000, Math.max(0, adj.adj ?? 16667));
      return { d: rectangleArrondi(x, y, w, h, (ss * a) / 100000), texte: plein };
    }
    case "flowChartTerminator":
      return { d: rectangleArrondi(x, y, w, h, ss / 2), texte: plein };
    case "ellipse":
    case "flowChartConnector": {
      const k = (1 - Math.SQRT1_2) / 2;
      return { d: ellipse(x, y, w, h), texte: [w * k, h * k, w * (1 - 2 * k), h * (1 - 2 * k)] };
    }
    case "homePlate": {
      const a = Math.min((100000 * w) / ss, Math.max(0, adj.adj ?? 50000));
      const x1 = r - (ss * a) / 100000;
      return { d: polygone([[l, t], [x1, t], [r, vc], [x1, b], [l, b]]), texte: [0, 0, (x1 + r) / 2 - l, h] };
    }
    case "chevron": {
      const a = Math.min((100000 * w) / ss, Math.max(0, adj.adj ?? 50000));
      const dx = (ss * a) / 100000;
      return { d: polygone([[l, t], [r - dx, t], [r, vc], [r - dx, b], [l, b], [l + dx, vc]]), texte: [dx, 0, w - 2 * dx, h] };
    }
    case "rightArrow": {
      const a1 = (adj.adj1 ?? 50000) / 100000;
      const dx = Math.min(w, (ss * (adj.adj2 ?? 50000)) / 100000);
      const [y1, y2] = [vc - (h * a1) / 2, vc + (h * a1) / 2];
      return { d: polygone([[l, y1], [r - dx, y1], [r - dx, t], [r, vc], [r - dx, b], [r - dx, y2], [l, y2]]), texte: [0, y1 - y, w - dx, y2 - y1] };
    }
    case "triangle": {
      const xa = x + (w * Math.min(100000, Math.max(0, adj.adj ?? 50000))) / 100000;
      return { d: polygone([[l, b], [xa, t], [r, b]]), texte: [w / 4, h / 2, w / 2, h / 2] };
    }
    case "flowChartDecision":
    case "diamond":
      return { d: polygone([[l, vc], [hc, t], [r, vc], [hc, b]]), texte: [w / 4, h / 4, w / 2, h / 2] };
    case "flowChartPredefinedProcess": {
      const [x1, x2] = [x + w / 8, x + (w * 7) / 8];
      return { d: polygone([[l, t], [r, t], [r, b], [l, b]]), traits: M(x1, t) + L(x1, b) + M(x2, t) + L(x2, b), texte: [w / 8, 0, (w * 3) / 4, h] };
    }
    case "wedgeRoundRectCallout":
      return { d: bulle(x, y, w, h, adj.adj1 ?? -20833, adj.adj2 ?? 62500, adj.adj3 ?? 16667), texte: plein };
    case "wedgeRectCallout":
      return { d: bulle(x, y, w, h, adj.adj1 ?? -20833, adj.adj2 ?? 62500, 0), texte: plein };
    case "line":
    case "straightConnector1":
      return ouvert([[l, t], [r, b]]);
    case "bentConnector2":
      return ouvert([[l, t], [r, t], [r, b]]);
    case "bentConnector3": {
      const x1 = x + (w * (adj.adj1 ?? 50000)) / 100000;
      return ouvert([[l, t], [x1, t], [x1, b], [r, b]]);
    }
    case "bentConnector4": {
      const x1 = x + (w * (adj.adj1 ?? 50000)) / 100000;
      const y2 = y + (h * (adj.adj2 ?? 50000)) / 100000;
      return ouvert([[l, t], [x1, t], [x1, y2], [r, y2], [r, b]]);
    }
    default:
      return { d: polygone([[l, t], [r, t], [r, b], [l, b]]), texte: plein };
  }
}

const VECTEURS: Readonly<Record<string, readonly number[]>> = {
  dot: [1, 3], dash: [4, 3], lgDash: [8, 3], dashDot: [4, 3, 1, 3], lgDashDot: [8, 3, 1, 3], lgDashDotDot: [8, 3, 1, 3, 1, 3],
  sysDash: [3, 1], sysDot: [1, 1], sysDashDot: [3, 1, 1, 1], sysDashDotDot: [3, 1, 1, 1, 1, 1],
};

/** Le motif de tirets, en unités du dessin, pour une épaisseur donnée. */
export function tirets(nom: string | undefined, largeur: number): string | undefined {
  const v = nom ? VECTEURS[nom] : undefined;
  return v ? v.map((k) => n(k * largeur)).join(" ") : undefined;
}

/** La longueur d'une pointe de flèche pour une épaisseur de trait (moyenne DrawingML : trois fois l'épaisseur, au moins 3,5 pt). */
export const longueurDePointe = (largeur: number) => Math.max(3 * largeur, 3.5);

/** La pointe d'une flèche à l'extrémité `p`, venant de `avant`. */
export function pointe(type: string, p: Point, avant: Point, largeur: number): string {
  const lg = longueurDePointe(largeur);
  const [dx, dy] = [p[0] - avant[0], p[1] - avant[1]];
  const d = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / d, dy / d];
  const [nx, ny] = [-uy * (lg / 2), ux * (lg / 2)];
  const a = (k: number, m: number): Point => [p[0] - ux * lg * k + nx * m, p[1] - uy * lg * k + ny * m];
  if (type === "oval") return ellipse(p[0] - lg / 2, p[1] - lg / 2, lg, lg);
  if (type === "diamond") return polygone([a(-0.5, 0), a(0, 1), a(0.5, 0), a(0, -1)]);
  if (type === "stealth") return polygone([p, a(1, 1), a(0.6, 0), a(1, -1)]);
  return polygone([p, a(1, 1), a(1, -1)]);
}

/** Recule une extrémité de `retrait` vers le point précédent (pour que le trait ne dépasse pas sous la pointe). */
export function recule(p: Point, avant: Point, retrait: number): Point {
  const [dx, dy] = [p[0] - avant[0], p[1] - avant[1]];
  const d = Math.hypot(dx, dy);
  if (d <= retrait) return p;
  return [p[0] - (dx / d) * retrait, p[1] - (dy / d) * retrait];
}
