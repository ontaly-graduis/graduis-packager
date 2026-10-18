// Les textes d'un bloc organisé (PKG-C2) : l'inventaire se dérive de la structure — un texte par colonne, ses nœuds ligne à
// ligne, sans les marques de graisse. Le même calcul à la qualification et à la lecture : le pivot ne garde pas deux
// fois la même chose sous deux formes (I-PKG-1).
import type { Noeud, Structure } from "./seance-spec";

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
