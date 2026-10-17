// La manière du thème appliquée à un schéma redessiné (PE5 du wizard : le thème dit la manière) : coins, épaisseurs de
// trait, échelle des corps. Le pivot garde le dessin d'origine ; la salle et le papier le portent à la manière du thème.
import type { Corps, Dessin, ElementDeDessin } from "../pivot/seance-spec";

export interface Maniere {
  readonly schema: {
    readonly coins: "droits" | "origine";
    readonly traits: { readonly fin: number; readonly appuye: number; readonly seuil: number };
    readonly corps: { readonly titre: number; readonly libelle: number; readonly tolerance: number };
    readonly pastilles: "badge-etape" | "origine";
  };
}

/** Coins droits : les géométries arrondies prennent leur pendant à angles droits. */
const DROITES: Readonly<Record<string, string>> = {
  roundRect: "rect", flowChartAlternateProcess: "flowChartProcess", wedgeRoundRectCallout: "wedgeRectCallout",
};

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Le corps courant d'un dessin : celui qui porte le plus de caractères. */
function corpsCourant(d: Dessin): number {
  const poids = new Map<number, number>();
  const compter = (c: Corps | undefined) => {
    for (const p of c?.paragraphes ?? []) for (const f of p.fragments) poids.set(f.taille, (poids.get(f.taille) ?? 0) + f.texte.trim().length);
  };
  for (const e of d.elements) {
    if (e.type === "forme") compter(e.texte);
    if (e.type === "tableau") for (const l of e.cellules) for (const c of l) compter(c.texte);
  }
  return [...poids].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
}

/** Trois corps : le courant, un corps de titre au-dessus, un corps de libellé au-dessous — rien entre. */
function echelle(base: number, m: Maniere["schema"]["corps"]): (t: number) => number {
  if (!base) return (t) => t;
  return (t) => (t > base * (1 + m.tolerance) ? r2(base * m.titre) : t < base * (1 - m.tolerance) ? r2(base * m.libelle) : base);
}

function corpsHabille(c: Corps, taille: (t: number) => number): Corps {
  return { ...c, paragraphes: c.paragraphes.map((p) => ({ ...p, fragments: p.fragments.map((f) => ({ ...f, taille: taille(f.taille) })) })) };
}

export function habiller(d: Dessin, maniere: Maniere): Dessin {
  const m = maniere.schema;
  const taille = echelle(corpsCourant(d), m.corps);
  const trait = (l: number) => (l < m.traits.seuil ? m.traits.fin : m.traits.appuye);
  return {
    ...d,
    elements: d.elements.map((e): ElementDeDessin => {
      if (e.type === "forme") {
        const geometrie = m.coins === "droits" ? DROITES[e.geometrie] ?? e.geometrie : e.geometrie;
        const { ajustements, ...reste } = e;
        const garde = geometrie === e.geometrie || geometrie === "wedgeRectCallout";
        return {
          ...reste,
          geometrie,
          ...(garde && ajustements ? { ajustements } : {}),
          ...(e.trait ? { trait: { ...e.trait, largeur: trait(e.trait.largeur) } } : {}),
          ...(e.texte ? { texte: corpsHabille(e.texte, taille) } : {}),
        };
      }
      if (e.type === "tableau") {
        return { ...e, cellules: e.cellules.map((l) => l.map((c) => ({ ...c, bords: c.bords.map((b) => (b ? { ...b, largeur: trait(b.largeur) } : null)) as typeof c.bords, texte: corpsHabille(c.texte, taille) }))) };
      }
      return e;
    }),
  };
}
