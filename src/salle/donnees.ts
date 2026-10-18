// Le pivot mis en salle : blocs projetés, étapes de dévoilement, durées, numéros dérivés, zones en `RegionMap`.
import type { Bloc, Composition, Dessin, Figure, SeanceSpec, Structure, Visuel } from "../pivot/seance-spec";
import { compenserChasse, type TableDeChasse } from "../theme/chasse";
import { habiller, type Maniere } from "../theme/maniere";
import { regionMap, type RegionMap } from "./region-map";
import { planDeDevoilement } from "./unites";

export const SCHEMA_SALLE = "graduis/salle@0";

/** Le dévoilement, coordonnée de la prise : pastille par pastille (et ligne par ligne), ou tout l'écran d'un coup. */
export type Devoilement = "pastille" | "ecran";

export interface PriseDeSalle {
  readonly devoilement: Devoilement;
}

/** Un visuel du pivot, avec ses dimensions en pixels (lues au relevé) pour une mise en page synchrone. */
export type VisuelDeSalle = Visuel & { readonly px: readonly [number, number] | null };

export interface BlocDeSalle {
  readonly id: string;
  readonly figure: Figure;
  readonly titre: string | null;
  /** Les lignes affichées (paragraphes non vides des textes), hors numéro saisi d'une transition. */
  readonly lignes: readonly string[];
  readonly visuels: readonly VisuelDeSalle[];
  readonly tableaux: readonly (readonly (readonly string[])[])[];
  readonly notes: string;
  /** Nombre de dévoilements après l'état initial. */
  readonly etapes: number;
  /** Durée annoncée en minutes (écrans d'animation, mises en pratique), pour le minuteur. */
  readonly duree: number | null;
  /** Mise en pratique : rappeler que le pas-à-pas peut servir d'aide (« Vous pouvez vous aider du pas à pas »). */
  readonly aide?: true;
  readonly regionMap?: RegionMap;
  /** Le schéma redessiné, rendu en SVG par le lecteur. */
  readonly dessin?: Dessin;
  /** L'organisation du texte (rangées, colonnes, intertitres, listes, définitions) ; ses unités se dévoilent une à une. */
  readonly structure?: Structure;
  /** Le schéma recomposé par un gabarit : la salle le compose au thème au lieu de redessiner. */
  readonly composition?: Composition;
}



export interface SequenceDeSalle {
  readonly id: string;
  /** Numéro dérivé de l'ordre des transitions (`null` pour l'ouverture). */
  readonly numero: number | null;
  readonly titre: string;
  readonly blocs: readonly BlocDeSalle[];
}

export interface DonneesDeSalle {
  readonly schema: typeof SCHEMA_SALLE;
  readonly source: SeanceSpec["source"];
  readonly prise: PriseDeSalle;
  readonly sequences: readonly SequenceDeSalle[];
}

const DEVOILEES: ReadonlySet<Figure> = new Set(["objectifs", "contenu", "etapes-cles", "synthese", "mise-en-pratique"]);
const MINUTEES: ReadonlySet<Figure> = new Set(["ecran-animation", "mise-en-pratique"]);

function lignesDe(b: Bloc): string[] {
  const lignes = b.textes.flatMap((t) => t.split("\n").map((l) => l.trim()).filter(Boolean));
  return b.figure === "transition" ? lignes.filter((l) => !/^\d{1,2}$/.test(l)) : lignes;
}

type Dimensions = (media: string) => readonly [number, number] | null;

/** Ce que le thème apporte au rendu des schémas : la chasse de sa police, sa manière. */
export interface Habillage {
  readonly chasse?: TableDeChasse;
  readonly maniere?: Maniere;
}

function blocDeSalle(b: Bloc, prise: PriseDeSalle, px: Dimensions, h: Habillage): BlocDeSalle {
  let lignes = lignesDe(b);
  let titre = b.titre;
  let aide = false;
  if (b.figure === "mise-en-pratique") {
    // L'écran « À vous de jouer » : la pastille le dit déjà ; l'énoncé prend la place du titre générique.
    aide = [titre ?? "", ...lignes].some((l) => /aider du/i.test(l));
    lignes = lignes.filter((l) => !/vous de jouer|aider du/i.test(l));
    if (/vous de jouer/i.test(titre ?? "") && lignes.length) [titre, lignes] = [lignes[0]!, lignes.slice(1)];
  }
  // La durée d'un écran se dit dans sa puce (avec l'icône du minuteur) : la ligne qui ne dit qu'elle n'est pas répétée.
  const minutes = MINUTEES.has(b.figure) ? lignes.join(" ").match(/(\d{1,3})\s*min/i) : null;
  if (minutes) lignes = lignes.filter((l) => !/^\s*\d{1,3}\s*min(utes?)?\s*\.?\s*$/i.test(l));
  const pastille = prise.devoilement === "pastille";
  const etapes = !pastille ? 0 : b.figure === "pas-a-pas" ? b.pas.length
    : b.figure === "schema" ? (b.composition ? (b.composition.gabarit === "cas" ? b.composition.cas.length : b.composition.colonnes.length) : b.dessin?.partition?.pas ?? 0)
      : DEVOILEES.has(b.figure) ? (b.structure ? planDeDevoilement(b.structure).total : lignes.length) : 0;
  const dessin = b.dessin ? compenserChasse(b.dessin, h.chasse ?? {}) : undefined;
  return {
    id: b.id,
    figure: b.figure,
    titre,
    lignes,
    visuels: b.visuels.map((v) => ({ ...v, px: px(v.media) })),
    tableaux: b.tableaux,
    notes: b.notes,
    etapes,
    duree: minutes ? Number(minutes[1]) : null,
    ...(aide ? { aide: true as const } : {}),
    ...(b.figure === "pas-a-pas" ? { regionMap: regionMap(b) } : {}),
    ...(dessin ? { dessin: h.maniere ? habiller(dessin, h.maniere) : dessin } : {}),
    ...(b.structure ? { structure: b.structure } : {}),
    ...(b.composition ? { composition: b.composition } : {}),
  };
}

/**
 * Les médias qu'un bloc montre : ses visuels, et les images de son dessin et des vignettes de sa composition (depuis PKG-C3,
 * une image que le dessin porte n'est plus un visuel de plus).
 */
export function mediasDuBloc(b: Pick<BlocDeSalle, "visuels" | "dessin" | "composition">): string[] {
  const images = (elements: readonly { type: string; media?: string }[] | undefined) => (elements ?? []).flatMap((e) => (e.type === "image" && e.media ? [e.media] : []));
  const c = b.composition;
  const vignettes = c?.gabarit === "tableau" ? [...c.lignes.flatMap((l) => images(l.signe?.elements)), ...images(c.illustration?.elements)] : [];
  return [...b.visuels.map((v) => v.media), ...images(b.dessin?.elements), ...vignettes];
}

/** Met un pivot en salle : séquences retenues (toutes par défaut), blocs masqués écartés, textes des schémas à la chasse du thème. */
export function mettreEnSalle(spec: SeanceSpec, prise: PriseDeSalle, px: Dimensions, retenues?: readonly string[], habillage: Habillage = {}): DonneesDeSalle {
  let rang = 0;
  const sequences: SequenceDeSalle[] = [];
  for (const s of spec.sequences) {
    const transition = s.blocs.find((b) => b.figure === "transition");
    if (transition) rang += 1;
    if (retenues && !retenues.includes(s.id)) continue;
    const blocs = s.blocs.filter((b) => !b.masquee).map((b) => blocDeSalle(b, prise, px, habillage));
    if (blocs.length) sequences.push({ id: s.id, numero: transition ? rang : null, titre: transition?.titre ?? "Ouverture", blocs });
  }
  return { schema: SCHEMA_SALLE, source: spec.source, prise, sequences };
}
