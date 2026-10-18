// La grammaire du PPT de validation (PKG-C) : ce que `emettre` écrit et que `lire` lit, en un seul endroit. Une
// disposition par figure, nommée par elle ; des formes nommées (pastille, zone, capture) ; des espaces réservés
// (titre, contenu, consignes) ; l'identité du bloc dans des étiquettes OOXML, la source dans les propriétés du document.
import { FIGURES, ROLES, ROLES_DE_VISUEL, type Figure, type Role } from "../pivot/seance-spec";

export const LIBELLES: Readonly<Record<Figure, string>> = {
  couverture: "Couverture", "ecran-animation": "Écran d'animation", transition: "Transition", objectifs: "Objectifs",
  contenu: "Contenu", processus: "Processus", schema: "Schéma", demonstration: "Démonstration", "pas-a-pas": "Pas-à-pas",
  capture: "Capture", "mise-en-pratique": "Mise en pratique", "etapes-cles": "Étapes clés", synthese: "Synthèse",
  glossaire: "Glossaire", renvoi: "Renvoi",
};

/** Le nom de la disposition d'une figure : le contrat que `lire` lit, sans rien deviner. */
export const disposition = (f: Figure) => `G · ${LIBELLES[f]}`;
const FIGURE_DE_DISPOSITION = new Map(FIGURES.map((f) => [disposition(f), f]));
export const figureDeDisposition = (nom: string): Figure | undefined => FIGURE_DE_DISPOSITION.get(nom.trim());

/** Les figures dont la capture occupe la diapositive, consignes à droite. */
export const FIGURES_A_CAPTURE: ReadonlySet<Figure> = new Set(["pas-a-pas", "capture", "demonstration"]);

/** Les noms des formes de la grammaire (volet Sélection de PowerPoint). */
export const NOMS = {
  pastille: "G·pastille",
  zone: "G·zone",
  capture: "G·capture",
  visuel: "G·visuel",
  tableau: "G·tableau",
  /** Une colonne de la structure d'un texte (une fiche) : « G·colonne r.c », rangée et colonne comptées de 1. */
  colonne: "G·colonne",
  /** Le dessin d'un schéma (PKG-C3) : un groupe dont le repère enfant est celui du dessin, en EMU. */
  schema: "G·schéma",
  forme: "G·forme",
  image: "G·image",
  /** Un tableau du dessin : hors du groupe (PowerPoint ne groupe pas les tableaux), « G·grille · <groupe> · rang k ». */
  grille: "G·grille",
  /** Les formes d'une composition : « G·cas n » (bandeau), « G·étape n », « G·phase n », « G·couloir n », « G·signal ». */
  cas: "G·cas",
  etape: "G·étape",
  phase: "G·phase",
  couloir: "G·couloir",
  signal: "G·signal",
  /** Les vignettes d'une composition, en groupes : « G·signe n » (d'un couloir), « G·illustration ». */
  signe: "G·signe",
  illustration: "G·illustration",
  /** Une entrée de légende : « G·légende n » (son texte) et « G·légende n · case | · triangle » (son échantillon). */
  legende: "G·légende",
  /** Ce qui habille sans rien dire (le fond d'un couloir) : jamais relu. */
  decor: "G·décor",
  /** L'étiquette de la diapositive annexe. */
  etiquette: "G·étiquette",
} as const;

/** La diapositive annexe d'un schéma recomposé : masquée, elle montre le dessin d'origine, pour contrôle uniquement. */
export const ANNEXE = { etiquette: "Pour contrôle uniquement", suffixeDeTitre: " — dessin d'origine" } as const;

/** Le dévoilement d'un dessin se lit dans le nom de son groupe : « G·schéma · colonnes · 4 pas », « · étapes · 9 pas ». */
const MODES = { colonnes: "colonnes", etapes: "étapes" } as const;
type Partition = { mode: keyof typeof MODES; pas: number };
export const nomDeSchema = (p?: Partition) => NOMS.schema + (p ? ` · ${MODES[p.mode]} · ${p.pas} pas` : "");
export function partitionDeNom(nom: string): Partition | undefined {
  const m = nom.match(/· (colonnes|étapes) · (\d+) pas/);
  return m ? { mode: m[1] === "étapes" ? "etapes" : "colonnes", pas: Number(m[2]) } : undefined;
}

/** Le pas, le rang et la marque d'un élément de dessin se lisent dans son nom : « G·forme · pas 2 · ordre 1 · pastille ». */
interface Marques { readonly pas?: number | undefined; readonly ordre?: number | undefined; readonly marque?: "pastille" | undefined }
export const nomDElement = (base: string, e: Marques) =>
  base + (e.pas !== undefined ? ` · pas ${e.pas}` : "") + (e.ordre !== undefined ? ` · ordre ${e.ordre}` : "") + (e.marque ? " · pastille" : "");
export function marquesDeNom(nom: string): { pas?: number; ordre?: number; marque?: "pastille" } {
  const pas = nom.match(/· pas (\d+)/);
  const ordre = nom.match(/· ordre (\d+)/);
  return {
    ...(pas && Number(pas[1]) > 0 ? { pas: Number(pas[1]) } : {}),
    ...(ordre ? { ordre: Number(ordre[1]) } : {}),
    ...(/· pastille\b/.test(nom) ? { marque: "pastille" as const } : {}),
  };
}

/** Le numéro porté par un nom (« G·étape 3 » → 3). */
export function numeroDeNom(nom: string, base: string): number | undefined {
  const m = nom.startsWith(base) ? nom.slice(base.length).match(/^ (\d+)/) : null;
  return m ? Number(m[1]) : undefined;
}

/**
 * La structure d'un texte en paragraphes (PKG-C2) : un intertitre en gras au corps du titre ; un paragraphe sans puce ;
 * un élément de liste à la puce « • » (ou numéroté) ; une définition à la puce « ▸ », « **terme** : texte » ; un détail
 * au niveau 2, puce « – ». Les autres textes de la colonne gardent leur graisse.
 */
export const PUCES = { item: "•", definition: "▸", detail: "–" } as const;
/** Les corps de la structure, en centièmes de point : le texte courant, l'intertitre (lu comme tel à partir du seuil). */
export const CORPS_DE_STRUCTURE = { texte: 1400, intertitre: 1800, seuilIntertitre: 1600 } as const;

/** L'ancrage d'une zone se lit dans son nom : « G·zone » (repère), « G·zone · légende », « G·zone · proposée ✦ » (à valider). */
export const SUFFIXES_DE_ZONE = { repere: "", legende: " · légende", proposee: " · proposée ✦" } as const;
export function ancrageDeZone(nom: string): "repere" | "legende" | "proposee" | null {
  if (!nom.startsWith(NOMS.zone)) return null;
  if (nom.includes("proposée")) return "proposee";
  if (nom.includes("légende")) return "legende";
  return "repere";
}

/** Les espaces réservés : le titre, le contenu (un paragraphe par texte), les consignes (un paragraphe par pas, par rang). */
export const ESPACES = { contenu: 1, consignes: 2 } as const;

/** Les étiquettes OOXML d'une diapositive (PowerPoint les met en capitales et les duplique avec elle). */
export const ETIQUETTES = {
  bloc: "GRADUIS.BLOC",
  source: "GRADUIS.SOURCE",
  /** Retirée (PKG-C3) : les lectures sans grammaire d'alors (dessin, structure, composition), en JSON — encore lue. */
  lectures: "GRADUIS.LECTURES",
  /** La diapositive annexe d'un bloc : l'identifiant du bloc dont elle montre le dessin d'origine. */
  annexe: "GRADUIS.ANNEXE",
} as const;

/** Les propriétés personnalisées du document : le deck hérité dont le pivot procède. */
export const PROPRIETES = { nom: "graduis.source.nom", empreinte: "graduis.source.empreinte" } as const;

/** La diapositive 16:9 et ses unités. */
export const EMU = { largeur: 12192000, hauteur: 6858000, pouce: 914400, point: 12700 } as const;

/** Le rôle d'un visuel se lit dans son nom : « G·visuel · pictogramme », « · section », « · durée » ; sa légende est son texte de remplacement. */
export const LIBELLES_DE_ROLE: Readonly<Record<(typeof ROLES_DE_VISUEL)[number], string>> = { pictogramme: "pictogramme", section: "section", duree: "durée" };
export function roleDeVisuel(nom: string): (typeof ROLES_DE_VISUEL)[number] | undefined {
  return ROLES_DE_VISUEL.find((r) => nom.endsWith(` · ${LIBELLES_DE_ROLE[r]}`));
}

/**
 * Un rôle de couleur en couleur du thème Office : la famille par son accent (marine 1, ciel 2, vert 3, ambre 4, rouge 5,
 * gris 6), le ton par les modificateurs d'Office (« plus clair 40 % », « plus clair 80 % ») ; le papier et l'encre par
 * le fond et le texte. Aucune valeur : le thème la donne.
 */
const ACCENTS: Readonly<Record<string, string>> = { marine: "accent1", ciel: "accent2", vert: "accent3", ambre: "accent4", rouge: "accent5", gris: "accent6" };
export function couleurDeRole(r: Role): string {
  if (r === "papier") return '<a:schemeClr val="bg1"/>';
  if (r === "encre") return '<a:schemeClr val="tx1"/>';
  const [famille, ton] = r.split("-") as [string, string];
  const mods = ton === "moyen" ? '<a:lumMod val="60000"/><a:lumOff val="40000"/>' : ton === "pale" ? '<a:lumMod val="20000"/><a:lumOff val="80000"/>' : "";
  return mods ? `<a:schemeClr val="${ACCENTS[famille]}">${mods}</a:schemeClr>` : `<a:schemeClr val="${ACCENTS[famille]}"/>`;
}
export const ROLES_DE_COULEUR: readonly Role[] = ROLES;

