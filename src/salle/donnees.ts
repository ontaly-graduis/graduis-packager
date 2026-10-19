// Le pivot mis en salle : blocs projetés, étapes de dévoilement, durées, numéros dérivés, zones en `RegionMap`.
import { blocsDe, estActivite, verifierSequences, type Activite, type Bloc, type Composition, type Derivation, type Dessin, type Figure, type Geste, type SeanceSpec, type Structure, type Visuel } from "../pivot/seance-spec";
import { deriver, type ContenuDActivite } from "../activites/deriver";
import { textesDActivite } from "../emission/grammaire";
import { compenserChasse, type TableDeChasse } from "../theme/chasse";
import { habiller, type Maniere } from "../theme/maniere";
import { regionMap, type RegionMap, type Zone } from "./region-map";
import { planDeDevoilement } from "./unites";
import { motif, type PratiqueDOrigine } from "../profil/profil";

export const SCHEMA_SALLE = "graduis/salle@0";

/** Le dévoilement, coordonnée de la prise : pastille par pastille (et ligne par ligne), ou tout l'écran d'un coup. */
export type Devoilement = "pastille" | "ecran";

export interface PriseDeSalle {
  readonly devoilement: Devoilement;
}

/** Un visuel du pivot, avec ses dimensions en pixels (lues au relevé) pour une mise en page synchrone. */
export type VisuelDeSalle = Visuel & { readonly px: readonly [number, number] | null };

/** Une activité dérivée, en salle : son contenu tiré de sa source, l'habillage qui la présente. */
export interface ActiviteDeSalle {
  readonly derivation: Derivation;
  readonly geste: Geste;
  readonly consigne: string;
  /** « D'après : <titre de la source> ». */
  readonly source: string;
  readonly contenu: ContenuDActivite;
}

export interface BlocDeSalle {
  readonly id: string;
  readonly figure: Figure | "activite";
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
  /** Une activité dérivée : la régie la pilote (ACT-1). */
  readonly activite?: ActiviteDeSalle;
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

/**
 * Ce qui habille le rendu : du thème, la chasse de sa police et sa manière (les schémas) ; du profil de source, l'habillage
 * d'origine d'une mise en pratique, que la salle retire parce que le sien le dit déjà.
 */
export interface Habillage {
  readonly chasse?: TableDeChasse;
  readonly maniere?: Maniere;
  readonly pratique?: PratiqueDOrigine;
}

function blocDeSalle(b: Bloc, prise: PriseDeSalle, px: Dimensions, h: Habillage): BlocDeSalle {
  let lignes = lignesDe(b);
  let titre = b.titre;
  let aide = false;
  if (b.figure === "mise-en-pratique" && h.pratique) {
    // Le titre générique d'origine : la pastille de la salle le dit déjà ; l'énoncé prend sa place. Le renvoi au pas-à-pas
    // devient la ligne d'aide.
    const [generique, renvoi] = [motif(h.pratique.titre), motif(h.pratique.aide)];
    aide = [titre ?? "", ...lignes].some((l) => renvoi.teste(l));
    lignes = lignes.filter((l) => !generique.teste(l) && !renvoi.teste(l));
    if (generique.teste(titre ?? "") && lignes.length) [titre, lignes] = [lignes[0]!, lignes.slice(1)];
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
 * Une activité en salle : sa consigne, puis son corrigé (deux étapes) ; une Sélection sur image, la consigne de chaque pas
 * puis sa zone. Elle se joue ainsi quelle que soit la prise : c'est la régie qui la pilote, la télécommande y suffit. Le
 * présentateur lit le corrigé dans ses notes ; la Sélection sur image a sa `RegionMap`, des zones `act` jouées en `find`.
 */
function activiteDeSalle(a: Activite, source: Bloc, px: Dimensions): BlocDeSalle {
  const contenu = deriver(a, source);
  if (!contenu) throw new Error(`${a.id} : le bloc ${source.id} ne permet pas l'activité « ${a.derivation} »`);
  const t = textesDActivite(a, contenu, source.titre ?? source.id);
  const pas = contenu.geste === "selection-sur-image" ? contenu.pas : [];
  const captures = [...new Set(pas.map((p) => p.capture))];
  const zones: Record<string, Zone[]> = {};
  for (const p of pas) (zones[p.capture] ??= []).push({ id: `${a.id}-p${p.numero}`, role: "act", required: true, rect: p.zone, step: `P${p.numero}`, consigne: p.consigne });
  return {
    id: a.id,
    figure: "activite",
    titre: t.titre,
    lignes: [],
    visuels: captures.map((h) => { const v = source.visuels.find((x) => x.media === h); return { media: h, capture: true, ...(v?.rognage ? { rognage: v.rognage } : {}), px: px(h) }; }),
    tableaux: [],
    notes: t.notes,
    etapes: contenu.geste === "selection-sur-image" ? 2 * pas.length : 2,
    duree: a.duree,
    ...(pas.length ? { regionMap: { captures: zones, pas: pas.map((p) => ({ id: `P${p.numero}`, libelle: p.consigne })) } } : {}),
    activite: { derivation: a.derivation, geste: contenu.geste, consigne: t.consigne, source: t.source, contenu },
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
  if (retenues) verifierSequences(spec, retenues);
  const sources = new Map(blocsDe(spec).map((b) => [b.id, b]));
  let rang = 0;
  const sequences: SequenceDeSalle[] = [];
  for (const s of spec.sequences) {
    const transition = blocsDe(s).find((b) => b.figure === "transition");
    if (transition) rang += 1;
    if (retenues && !retenues.includes(s.id)) continue;
    const blocs = s.blocs.filter((b) => estActivite(b) || !b.masquee).map((b) => (estActivite(b) ? activiteDeSalle(b, sources.get(b.derive_de)!, px) : blocDeSalle(b, prise, px, habillage)));
    if (blocs.length) sequences.push({ id: s.id, numero: transition ? rang : null, titre: transition?.titre ?? "Ouverture", blocs });
  }
  return { schema: SCHEMA_SALLE, source: spec.source, prise, sequences };
}
