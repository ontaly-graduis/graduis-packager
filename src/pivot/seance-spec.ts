// Le pivot `graduis/seance-spec@0` : le signifié d'une séance présentielle, source unique des trois sorties.
import { z } from "zod";

export const SCHEMA_SEANCE = "graduis/seance-spec@0";

export const FIGURES = [
  "couverture", "ecran-animation", "transition", "objectifs", "contenu", "processus", "schema",
  "demonstration", "pas-a-pas", "capture", "mise-en-pratique", "etapes-cles", "synthese", "glossaire", "renvoi",
] as const;
export type Figure = (typeof FIGURES)[number];

/** Le temps MFAP d'une figure — dérivé de la figure, jamais stocké ; `null` pour les figures de structure. */
export const TEMPS = ["E", "R", "R*", "animation"] as const;
export type Temps = (typeof TEMPS)[number];

export const TEMPS_DE_FIGURE: Readonly<Record<Figure, Temps | null>> = {
  couverture: null, transition: null, glossaire: null, renvoi: null,
  "ecran-animation": "animation",
  objectifs: "E", contenu: "E", processus: "E", schema: "E", demonstration: "E", "pas-a-pas": "E", capture: "E",
  "mise-en-pratique": "R",
  "etapes-cles": "R*", synthese: "R*",
};

const hash = z.string().regex(/^sha256:[0-9a-f]{64}$/);
/** [x, y, largeur, hauteur] en pourcentage de la capture (contrat `RegionMap` du wizard). */
const rect = z.tuple([z.number(), z.number(), z.number(), z.number()]);

/** Comment la zone d'un pas a été trouvée : repère posé dessus, légende voisine, ou proposition par ordre de lecture. */
export const ANCRAGES = ["repere", "legende", "proposee"] as const;

export const Pas = z.object({
  numero: z.number().int(),
  capture: hash.nullable(),
  zone: rect.nullable(),
  ancrage: z.enum(ANCRAGES).nullable(),
  consigne: z.string().nullable(),
}).strict();

export const Visuel = z.object({
  media: hash,
  capture: z.boolean(),
  rognage: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
}).strict();

/**
 * Les rôles de couleur d'un dessin : six familles en trois tons, plus le papier et l'encre. Le thème donne à chaque rôle
 * sa valeur (`--dessin-<rôle>`) ; le pivot ne porte jamais de couleur.
 */
export const FAMILLES = ["marine", "ciel", "vert", "ambre", "rouge", "gris"] as const;
export const TONS = ["fort", "moyen", "pale"] as const;
export const ROLES = [
  "marine-fort", "marine-moyen", "marine-pale", "ciel-fort", "ciel-moyen", "ciel-pale", "vert-fort", "vert-moyen", "vert-pale",
  "ambre-fort", "ambre-moyen", "ambre-pale", "rouge-fort", "rouge-moyen", "rouge-pale", "gris-fort", "gris-moyen", "gris-pale",
  "papier", "encre",
] as const;
export type Role = (typeof ROLES)[number];

/** Les extrémités et les tirets d'un trait, dans le vocabulaire DrawingML (réémis tels quels). */
export const FLECHES = ["triangle", "stealth", "arrow", "diamond", "oval"] as const;
export const TIRETS = ["dot", "dash", "lgDash", "dashDot", "lgDashDot", "lgDashDotDot", "sysDash", "sysDot", "sysDashDot", "sysDashDotDot"] as const;

const role = z.enum(ROLES);
/** Une boîte de dessin [x, y, largeur, hauteur] en points, au centième. */
const boite = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const TraitDeDessin = z.object({
  couleur: role,
  /** Épaisseur en points. */
  largeur: z.number(),
  tirets: z.enum(TIRETS).optional(),
  debut: z.enum(FLECHES).optional(),
  fin: z.enum(FLECHES).optional(),
}).strict();

export const Fragment = z.object({
  texte: z.string(),
  /** Corps en points. */
  taille: z.number(),
  gras: z.literal(true).optional(),
  italique: z.literal(true).optional(),
  souligne: z.literal(true).optional(),
  couleur: role,
}).strict();

export const Paragraphe = z.object({
  alignement: z.enum(["gauche", "centre", "droite", "justifie"]),
  fragments: z.array(Fragment),
}).strict();

/**
 * Un cadre de texte : ancrage vertical, marges (gauche, haut, droite, bas) en points, retour à la ligne ; `police` = la police
 * d'origine dominante (le thème en tire la compensation de chasse de sa propre police).
 */
export const Corps = z.object({
  police: z.string().optional(),
  ancrage: z.enum(["haut", "milieu", "bas"]),
  marges: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  retour: z.literal(false).optional(),
  paragraphes: z.array(Paragraphe),
}).strict();

/** Un chemin de forme libre, en syntaxe SVG, dans son repère `largeur × hauteur`. */
export const CheminLibre = z.object({
  largeur: z.number(),
  hauteur: z.number(),
  d: z.string(),
  remplir: z.literal(false).optional(),
  tracer: z.literal(false).optional(),
}).strict();

/**
 * Une forme : géométrie du catalogue DrawingML (`rect`, `roundRect`, `bentConnector3`…) et ses ajustements, ou chemins
 * libres ; rotation en degrés ; fond et trait par rôle (absents = sans).
 */
export const FormeDeDessin = z.object({
  type: z.literal("forme"),
  boite,
  geometrie: z.string(),
  ajustements: z.record(z.string(), z.number()).optional(),
  chemins: z.array(CheminLibre).optional(),
  rotation: z.number().optional(),
  retournement: z.enum(["h", "v", "hv"]).optional(),
  fond: role.optional(),
  trait: TraitDeDessin.optional(),
  texte: Corps.optional(),
}).strict();

export const ImageDeDessin = z.object({
  type: z.literal("image"),
  boite,
  media: hash,
  rognage: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  geometrie: z.string().optional(),
}).strict();

export const Cellule = z.object({
  fond: role.optional(),
  /** Haut, droite, bas, gauche. */
  bords: z.tuple([TraitDeDessin.nullable(), TraitDeDessin.nullable(), TraitDeDessin.nullable(), TraitDeDessin.nullable()]),
  texte: Corps,
}).strict();

export const TableauDeDessin = z.object({
  type: z.literal("tableau"),
  boite,
  /** Largeurs des colonnes, hauteurs des lignes, en points. */
  colonnes: z.array(z.number()),
  hauteurs: z.array(z.number()),
  cellules: z.array(z.array(Cellule)),
}).strict();

export const ElementDeDessin = z.discriminatedUnion("type", [FormeDeDessin, ImageDeDessin, TableauDeDessin]);

/** Un schéma dessiné, en points, dans l'ordre d'empilement ; `cadre` = la région de la diapositive qu'il occupe. */
export const Dessin = z.object({
  cadre: boite,
  elements: z.array(ElementDeDessin),
}).strict();

export const Bloc = z.object({
  id: z.string().regex(/^b\d{3}$/),
  figure: z.enum(FIGURES),
  source: z.object({ diapo: z.number().int().positive() }).strict(),
  masquee: z.literal(true).optional(),
  titre: z.string().nullable(),
  textes: z.array(z.string()),
  visuels: z.array(Visuel),
  tableaux: z.array(z.array(z.array(z.string()))),
  pas: z.array(Pas),
  /** Le schéma redessiné (figure `schema`). */
  dessin: Dessin.optional(),
  notes: z.string(),
}).strict();

export const Sequence = z.object({
  id: z.string().regex(/^s\d{3}$/),
  blocs: z.array(Bloc).min(1),
}).strict();

export const SeanceSpec = z.object({
  schema: z.literal(SCHEMA_SEANCE),
  source: z.object({ nom: z.string(), empreinte: hash }).strict(),
  sequences: z.array(Sequence),
}).strict();

export type SeanceSpec = z.infer<typeof SeanceSpec>;
export type Sequence = z.infer<typeof Sequence>;
export type Bloc = z.infer<typeof Bloc>;
export type Pas = z.infer<typeof Pas>;
export type Visuel = z.infer<typeof Visuel>;
export type Dessin = z.infer<typeof Dessin>;
export type ElementDeDessin = z.infer<typeof ElementDeDessin>;
export type FormeDeDessin = z.infer<typeof FormeDeDessin>;
export type TraitDeDessin = z.infer<typeof TraitDeDessin>;
export type Corps = z.infer<typeof Corps>;
