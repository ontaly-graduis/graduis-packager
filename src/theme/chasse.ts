// La compensation de chasse : un texte redessiné dans la police du thème prend le corps qui lui rend la largeur qu'il avait.
import type { Corps, Dessin } from "../pivot/seance-spec";

export type TableDeChasse = Readonly<Record<string, number>>;

/** Le rapport de chasse d'une police d'origine : nom exact, puis sans ses suffixes de graisse (« Asap Condensed Medium » → « Asap Condensed »). */
export function rapportDeChasse(chasse: Readonly<Record<string, number>>, police: string | undefined): number {
  if (!police) return 1;
  const mots = police.split(/\s+/);
  for (let n = mots.length; n > 0; n--) {
    const r = chasse[mots.slice(0, n).join(" ")];
    if (r !== undefined) return r;
  }
  return 1;
}

function corpsCompense(c: Corps, chasse: TableDeChasse): Corps {
  const k = rapportDeChasse(chasse, c.police);
  if (k === 1) return c;
  return { ...c, paragraphes: c.paragraphes.map((p) => ({ ...p, fragments: p.fragments.map((f) => ({ ...f, taille: Math.round(f.taille * k * 100) / 100 })) })) };
}

/** Le dessin aux corps compensés (textes des formes et des cellules). */
export function compenserChasse(d: Dessin, chasse: TableDeChasse): Dessin {
  return {
    ...d,
    elements: d.elements.map((e) => {
      if (e.type === "forme" && e.texte) return { ...e, texte: corpsCompense(e.texte, chasse) };
      if (e.type === "tableau") return { ...e, cellules: e.cellules.map((l) => l.map((c) => ({ ...c, texte: corpsCompense(c.texte, chasse) }))) };
      return e;
    }),
  };
}
