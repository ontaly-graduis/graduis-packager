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
