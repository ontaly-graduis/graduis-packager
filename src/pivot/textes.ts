// Les textes d'un bloc organisé (PKG-C2) : l'inventaire se dérive de la structure — un texte par colonne, ses nœuds ligne à
// ligne, sans les marques de graisse. Le même calcul à la qualification et à la lecture : le pivot ne garde pas deux
// fois la même chose sous deux formes (I-PKG-1).
import type { Composition, Corps, Dessin, Noeud, Structure } from "./seance-spec";

const nu = (s: string) => s.replace(/\*\*/g, "");

function lignes(n: Noeud): string[] {
  switch (n.type) {
    case "titre":
    case "paragraphe":
      return [nu(n.texte)];
    case "liste":
      return n.items.flatMap((i) => [nu(i.texte), ...(i.details ?? []).map(nu)]);
    case "definitions":
      return n.entrees.flatMap((e) => [`${nu(e.terme)} : ${nu(e.texte)}`, ...(e.details ?? []).map(nu)]);
  }
}

export function textesDeStructure(s: Structure): string[] {
  return s.rangees.flatMap((r) => r.colonnes.map((c) => c.noeuds.flatMap(lignes).join("\n"))).filter((t) => t.trim() !== "");
}

// Les textes d'un schéma (PKG-C3) : son inventaire se dérive de ce qui le montre — la composition quand un gabarit l'a
// recomposé (c'est elle qu'ONET relit et que la salle joue), sinon le dessin ; ses tableaux, des tableaux du dessin.

/** Tolérance d'une rangée pour l'ordre de lecture, en points (0,15 pouce, comme à la qualification). */
const RANGEE = 10.8;

/** Le texte d'un cadre : ses paragraphes, fragments mis bout à bout. */
export const texteDeCorps = (c: Corps) => c.paragraphes.map((p) => p.fragments.map((f) => f.texte).join("")).join("\n").trim();

function ordreDeLecture<T>(items: readonly T[], boite: (t: T) => readonly number[]): T[] {
  const tries = [...items].sort((a, b) => boite(a)[1]! - boite(b)[1]! || boite(a)[0]! - boite(b)[0]!);
  const rangees: T[][] = [];
  for (const t of tries) {
    const derniere = rangees[rangees.length - 1];
    if (derniere && Math.abs(boite(t)[1]! - boite(derniere[0]!)[1]!) < RANGEE) derniere.push(t);
    else rangees.push([t]);
  }
  return rangees.flatMap((r) => r.sort((a, b) => boite(a)[0]! - boite(b)[0]!));
}

/** Les textes d'un dessin, dans l'ordre de lecture, hors pastilles (leur numéro n'est pas un texte). */
export function textesDeDessin(d: Dessin): string[] {
  const formes = d.elements.flatMap((e) => (e.type === "forme" && e.texte && !e.marque ? [{ boite: e.boite, texte: texteDeCorps(e.texte) }] : []));
  return ordreDeLecture(formes, (f) => f.boite).map((f) => f.texte).filter((t) => t !== "");
}

/** Les tableaux d'un dessin : le texte de chaque cellule. */
export function tableauxDeDessin(d: Dessin): string[][][] {
  return d.elements.flatMap((e) => (e.type === "tableau" ? [e.cellules.map((l) => l.map((c) => texteDeCorps(c.texte)))] : []));
}

export function textesDeComposition(c: Composition): string[] {
  const legende = (c.legende ?? []).map((l) => l.texte);
  if (c.gabarit === "cas") return [...c.cas.flatMap((k) => [k.titre, ...k.etapes.flatMap((e) => [e.texte, ...(e.detail ? [e.detail] : [])])]), ...legende];
  return [...c.colonnes.map((k) => k.titre), ...c.lignes.map((l) => l.titre), ...c.etapes.map((e) => e.texte), ...legende];
}

/** L'inventaire d'un schéma : textes et tableaux. */
export function inventaireDeSchema(d: Dessin | undefined, c: Composition | undefined): { textes: string[]; tableaux: string[][][] } {
  return { textes: (c ? textesDeComposition(c) : d ? textesDeDessin(d) : []).filter((t) => t.trim() !== ""), tableaux: d ? tableauxDeDessin(d) : [] };
}
