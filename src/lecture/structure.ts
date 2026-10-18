// La lecture de la structure d'un texte dans le PPT de validation (PKG-C2) : les cadres « G·colonne r.c », rangée par
// rangée ; dans chacun, les paragraphes en nœuds selon la grammaire des puces et des corps ; l'illustration d'une colonne,
// l'image posée à sa gauche.
import type { Forme } from "../ooxml/formes";
import type { Paragraphe } from "../ooxml/styles";
import type { Noeud, Structure } from "../pivot/seance-spec";
import { CORPS_DE_STRUCTURE, NOMS, PUCES } from "../emission/grammaire";

type Boite = readonly [number, number, number, number];

/** Le texte d'un paragraphe, la graisse en `**…**` (espaces hors des marques), comme à la qualification. */
export function texteRiche(p: Paragraphe): string {
  let t = "";
  for (const f of p.fragments) {
    if (f.gras && f.texte.trim()) {
      const [, avant, coeur, apres] = f.texte.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
      t += `${avant}**${coeur}**${apres}`;
    } else t += f.texte;
  }
  return t.replace(/\*\*\*\*/g, "").replace(/\*\*(\s+)\*\*/g, "$1").replace(/[ \t]+/g, " ").trim();
}

const toutGras = (p: Paragraphe) => p.fragments.some((f) => f.texte.trim()) && p.fragments.every((f) => !f.texte.trim() || f.gras);

/** Les paragraphes d'un cadre en nœuds : intertitres, paragraphes, listes (et leurs détails), définitions. */
export function noeudsDeParagraphes(ps: readonly Paragraphe[]): Noeud[] {
  const out: Noeud[] = [];
  for (const p of ps) {
    const texte = texteRiche(p);
    if (!texte) continue;
    const dernier = out[out.length - 1];
    if (p.niveau >= 1) {
      const porteur = dernier?.type === "liste" ? dernier.items[dernier.items.length - 1] : dernier?.type === "definitions" ? dernier.entrees[dernier.entrees.length - 1] : undefined;
      if (porteur) { porteur.details = [...(porteur.details ?? []), texte]; continue; }
    }
    if (p.puce === "car" && p.car === PUCES.definition) {
      const m = texte.match(/^\*\*([\s\S]+?)\*\*\s*:\s*([\s\S]*)$/) ?? texte.match(/^([^:]+?)\s*:\s*([\s\S]*)$/);
      const entree = m ? { terme: m[1]!.trim(), texte: m[2]! } : { terme: texte, texte: "" };
      if (dernier?.type === "definitions") dernier.entrees.push(entree);
      else out.push({ type: "definitions", entrees: [entree] });
      continue;
    }
    if (p.puce === "car" || p.puce === "num") {
      const numerotee = p.puce === "num";
      if (dernier?.type === "liste" && (dernier.numerotee === true) === numerotee) dernier.items.push({ texte });
      else out.push({ type: "liste", ...(numerotee ? { numerotee: true as const } : {}), items: [{ texte }] });
      continue;
    }
    const taille = Math.max(...p.fragments.filter((f) => f.texte.trim()).map((f) => f.taille));
    if (p.niveau === 0 && toutGras(p) && taille >= CORPS_DE_STRUCTURE.seuilIntertitre) out.push({ type: "titre", texte: texte.replace(/\*\*/g, "") });
    else out.push({ type: "paragraphe", texte });
  }
  return out;
}

/** La place d'un cadre de colonne : « G·colonne r.c », sinon sa position. */
function place(f: Forme): [number, number] | null {
  const m = f.nom.slice(NOMS.colonne.length).trim().match(/^(\d+)\.(\d+)$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** La structure lue dans les cadres de colonne d'une diapositive, et les images qui illustrent une colonne. */
export function lireStructure(formes: readonly Forme[], hashDe: (f: Forme) => string | undefined): { structure: Structure | null; illustrations: Set<Forme> } {
  const cadres = formes.filter((f) => f.nom.startsWith(NOMS.colonne));
  const illustrations = new Set<Forme>();
  if (!cadres.length) return { structure: null, illustrations };
  const ordonnes = [...cadres].sort((a, b) => {
    const [pa, pb] = [place(a), place(b)];
    return pa && pb ? pa[0] - pb[0] || pa[1] - pb[1] : a.boite[1] - b.boite[1] || a.boite[0] - b.boite[0];
  });
  const images = formes.filter((f) => f.nature === "image" && f.media && f.nom.startsWith(NOMS.visuel) && !f.nom.includes(" · "));
  const rangees: { r: number; colonnes: Structure["rangees"][number]["colonnes"][number][] }[] = [];
  ordonnes.forEach((f, i) => {
    const r = place(f)?.[0] ?? i + 1;
    // L'illustration : une image posée à gauche du cadre, à sa hauteur.
    const b: Boite = f.boite;
    const image = images.find((im) => !illustrations.has(im) && im.boite[0] + im.boite[2] <= b[0] + 45720 && b[0] - (im.boite[0] + im.boite[2]) <= 457200
      && Math.min(im.boite[1] + im.boite[3], b[1] + b[3]) - Math.max(im.boite[1], b[1]) > 0.5 * Math.min(im.boite[3], b[3]));
    const visuel = image ? hashDe(image) : undefined;
    if (image) illustrations.add(image);
    const colonne = { ...(visuel ? { visuel } : {}), noeuds: noeudsDeParagraphes((f.style?.corps?.paragraphes ?? []) as readonly Paragraphe[]) };
    const rangee = rangees.find((x) => x.r === r);
    if (rangee) rangee.colonnes.push(colonne);
    else rangees.push({ r, colonnes: [colonne] });
  });
  return { structure: { rangees: rangees.map((x) => ({ colonnes: x.colonnes })) }, illustrations };
}
