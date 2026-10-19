// Le pivot `graduis/seance-spec@1` : le signifié d'une séance présentielle, source unique des trois sorties ; ses blocs de
// contenu, et les activités dérivées qui pointent vers eux (ACT-1).
import { z } from "zod";

export const SCHEMA_SEANCE = "graduis/seance-spec@1";

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

/**
 * Le rôle d'un visuel qui n'est pas une capture (PKG-B6) : le pictogramme d'un écran ou d'une diapositive, l'icône de sa
 * section (en tête), l'icône de la durée (à côté des minutes). Sans rôle : une illustration, une photo.
 */
export const ROLES_DE_VISUEL = ["pictogramme", "section", "duree"] as const;

export const Visuel = z.object({
  media: hash,
  capture: z.boolean(),
  rognage: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  role: z.enum(ROLES_DE_VISUEL).optional(),
  /** Le libellé posé sous le visuel (« Grand soleil ») : il le légende, il n'est plus un texte de la diapositive. */
  legende: z.string().optional(),
  /** L'aplat sur lequel le pictogramme est posé à l'origine (une icône blanche sur un disque de couleur), en rôle. */
  fond: role.optional(),
}).strict();

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
  /** Une pastille numérotée : le thème la dessine à sa manière (le badge d'étape). */
  marque: z.literal("pastille").optional(),
  /** Le pas de la partition où l'élément paraît (absent : il est là dès l'entrée, c'est le décor). */
  pas: z.number().int().positive().optional(),
  /** Son rang dans le pas : le numéro de la pastille qui l'annonce (les indications numérales priment). */
  ordre: z.number().int().nonnegative().optional(),
}).strict();

export const ImageDeDessin = z.object({
  type: z.literal("image"),
  boite,
  media: hash,
  rognage: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  geometrie: z.string().optional(),
  pas: z.number().int().positive().optional(),
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
  pas: z.number().int().positive().optional(),
}).strict();

export const ElementDeDessin = z.discriminatedUnion("type", [FormeDeDessin, ImageDeDessin, TableauDeDessin]);

/**
 * Un schéma dessiné, en points, dans l'ordre d'empilement ; `cadre` = la région de la diapositive qu'il occupe.
 * `partition` dit comment il se dévoile : par colonnes (de gauche à droite) ou par étapes numérotées ; ses pas sont
 * portés par les éléments.
 */
export const Dessin = z.object({
  cadre: boite,
  elements: z.array(ElementDeDessin),
  partition: z.object({ mode: z.enum(["colonnes", "etapes"]), pas: z.number().int().positive() }).strict().optional(),
}).strict();

/**
 * L'organisation d'une diapositive de texte (figures `contenu`, `objectifs`, `synthese`) : des rangées de haut en bas,
 * des colonnes de gauche à droite, des nœuds dans l'ordre de lecture. Les textes gardent leur graisse en `**…**`.
 */
export const Noeud = z.discriminatedUnion("type", [
  z.object({ type: z.literal("titre"), texte: z.string() }).strict(),
  z.object({ type: z.literal("paragraphe"), texte: z.string() }).strict(),
  z.object({
    type: z.literal("liste"),
    numerotee: z.literal(true).optional(),
    items: z.array(z.object({ texte: z.string(), details: z.array(z.string()).optional() }).strict()),
  }).strict(),
  z.object({
    type: z.literal("definitions"),
    entrees: z.array(z.object({ terme: z.string(), texte: z.string(), details: z.array(z.string()).optional() }).strict()),
  }).strict(),
]);

export const Structure = z.object({
  rangees: z.array(z.object({
    /** Une colonne peut porter l'image qui l'illustre (portrait, icône d'un rôle) : elle est alors une fiche. */
    colonnes: z.array(z.object({ visuel: hash.optional(), noeuds: z.array(Noeud) }).strict()),
  }).strict()),
}).strict();

/** La manière d'une étape ou d'un échantillon de légende : son fond (un rôle) et son bord. */
const maniereDEtape = { fond: role.optional(), bord: z.enum(["plein", "tirets", "aucun"]) };

/** Une entrée de légende : un échantillon (une case, ou un triangle de signal) à la manière qu'il nomme. */
const EntreeDeLegende = z.object({ texte: z.string(), forme: z.literal("triangle").optional(), ...maniereDEtape }).strict();

/** Une vignette : un petit dessin repris tel quel (l'icône d'un couloir, le portrait d'un persona), en points. */
export const Vignette = z.object({ cadre: boite, elements: z.array(ElementDeDessin) }).strict();

/**
 * Un schéma recomposé par un gabarit du wizard (PKG-B4, B5).
 * `cas` : des colonnes en regard, chacune annoncée par son bandeau (numéro, titre, couleur), faite d'étapes numérotées
 * (texte, description, manière) ; la légende nomme les manières.
 * `tableau` : des lignes nommées (et leur signe) sous des colonnes nommées ; dans ses cases, des étapes placées par
 * (ligne, colonne), numérotées dans leur colonne, chacune à sa manière et, s'il y a lieu, avec le signal (le triangle
 * d'alerte du wizard, dont la couleur dit le degré) ; une illustration (le persona) et la légende.
 */
export const Composition = z.discriminatedUnion("gabarit", [
  z.object({
    gabarit: z.literal("cas"),
    cas: z.array(z.object({
      numero: z.number().int(),
      titre: z.string(),
      couleur: role.optional(),
      etapes: z.array(z.object({ numero: z.number().int(), texte: z.string(), detail: z.string().optional(), ...maniereDEtape }).strict()),
    }).strict()),
    legende: z.array(EntreeDeLegende).optional(),
  }).strict(),
  z.object({
    gabarit: z.literal("tableau"),
    colonnes: z.array(z.object({ titre: z.string(), couleur: role.optional() }).strict()),
    lignes: z.array(z.object({ titre: z.string(), signe: Vignette.optional() }).strict()),
    etapes: z.array(z.object({
      ligne: z.number().int().nonnegative(),
      colonne: z.number().int().nonnegative(),
      numero: z.number().int().optional(),
      texte: z.string(),
      signal: role.optional(),
      ...maniereDEtape,
    }).strict()),
    illustration: Vignette.optional(),
    legende: z.array(EntreeDeLegende).optional(),
  }).strict(),
]);

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
  /** L'organisation du texte (figures de texte). */
  structure: Structure.optional(),
  /** Le schéma recomposé par un gabarit, quand il en relève (le dessin reste, source et repli). */
  composition: Composition.optional(),
  notes: z.string(),
}).strict();

/** Les gestes que joue une activité dérivée (spec v1 § 5.2) : ceux du dictionnaire, et la Sélection sur image, sa variante. */
export const GESTES = ["rappel", "classement", "categorisation", "selection-sur-image"] as const;
export type Geste = (typeof GESTES)[number];

/**
 * Les dérivations sans invention (spec v1 § 5.3) : chacune lit une figure source et joue un geste. Le geste se dérive de la
 * dérivation, le repli papier du geste : le pivot ne garde ni l'un ni l'autre (I-PKG-1).
 */
export const DERIVATIONS = ["rappel", "etapes-a-replacer", "qui-fait-quoi", "ordre-des-pas", "ou-cliquez-vous"] as const;
export type Derivation = (typeof DERIVATIONS)[number];

export const DERIVATION: Readonly<Record<Derivation, { readonly geste: Geste; readonly source: Figure }>> = {
  rappel: { geste: "rappel", source: "etapes-cles" },
  "etapes-a-replacer": { geste: "classement", source: "schema" },
  "qui-fait-quoi": { geste: "categorisation", source: "processus" },
  "ordre-des-pas": { geste: "classement", source: "pas-a-pas" },
  "ou-cliquez-vous": { geste: "selection-sur-image", source: "pas-a-pas" },
};

/** Le temps MFAP d'un geste : le Rappel régule, les autres réalisent. */
export const TEMPS_DE_GESTE: Readonly<Record<Geste, Temps>> = { rappel: "R*", classement: "R", categorisation: "R", "selection-sur-image": "R" };

/**
 * Une activité dérivée (I-PKG-12) : elle pointe vers son bloc source et ne copie rien — remplacer la source met l'activité à
 * jour. Sa durée, en minutes, est son contrat de temps (I-PKG-14).
 */
export const Activite = z.object({
  id: z.string().regex(/^a\d{3}$/),
  figure: z.literal("activite"),
  derivation: z.enum(DERIVATIONS),
  derive_de: z.string().regex(/^b\d{3}$/),
  duree: z.number().int().positive(),
}).strict();

export const Sequence = z.object({
  id: z.string().regex(/^s\d{3}$/),
  blocs: z.array(z.union([Bloc, Activite])).min(1),
}).strict();

export const SeanceSpec = z.object({
  schema: z.literal(SCHEMA_SEANCE),
  source: z.object({ nom: z.string(), empreinte: hash }).strict(),
  sequences: z.array(Sequence),
}).strict();

export type SeanceSpec = z.infer<typeof SeanceSpec>;

/** Les séquences retenues (`--sequences`) sont des séquences de la séance : une inconnue arrête tout, et l'erreur dit les bonnes. */
export function verifierSequences(spec: SeanceSpec, retenues: readonly string[]): void {
  const ids = spec.sequences.map((q) => q.id);
  const inconnues = retenues.filter((r) => !ids.includes(r));
  if (inconnues.length) throw new Error(`séquence inconnue : ${inconnues.join(", ")} — celles de la séance : ${ids.join(", ")}`);
}
export type Sequence = z.infer<typeof Sequence>;
export type Bloc = z.infer<typeof Bloc>;
export type Activite = z.infer<typeof Activite>;

export const estActivite = (b: Bloc | Activite): b is Activite => b.figure === "activite";
/** Les blocs de contenu d'un pivot ou d'une séquence, sans ses activités. */
export const blocsDe = (s: { readonly sequences: readonly Sequence[] } | Sequence): Bloc[] =>
  ("sequences" in s ? s.sequences.flatMap((q) => q.blocs) : s.blocs).filter((b): b is Bloc => !estActivite(b));
/** Les activités d'un pivot. */
export const activitesDe = (s: { readonly sequences: readonly Sequence[] }): Activite[] => s.sequences.flatMap((q) => q.blocs).filter(estActivite);
export type Pas = z.infer<typeof Pas>;
export type Visuel = z.infer<typeof Visuel>;
export type Dessin = z.infer<typeof Dessin>;
export type ElementDeDessin = z.infer<typeof ElementDeDessin>;
export type FormeDeDessin = z.infer<typeof FormeDeDessin>;
export type TraitDeDessin = z.infer<typeof TraitDeDessin>;
export type Corps = z.infer<typeof Corps>;
export type Structure = z.infer<typeof Structure>;
export type Composition = z.infer<typeof Composition>;
export type Vignette = z.infer<typeof Vignette>;
export type Noeud = z.infer<typeof Noeud>;
