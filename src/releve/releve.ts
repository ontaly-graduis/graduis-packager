// Relevé d'un deck hérité (ingestion héritée, lecture seule) : diapositives, formes, notes, médias hashés, pas-à-pas.
import { posix } from "node:path";
import { imageSize } from "image-size";
import { sha256 } from "../lib/json";
import { formesDeDiapositive, type Forme } from "../ooxml/formes";
import { Paquet } from "../ooxml/paquet";
import { apparier, type PasAPas } from "./appariement";

export const SCHEMA_RELEVE = "graduis/releve@0";

export interface MediaReleve {
  readonly ext: string;
  readonly octets: number;
  /** Dimensions en pixels (en unités de l'en-tête pour un EMF) ; `null` si le format n'est pas lu. */
  readonly px: readonly [number, number] | null;
}

/** Une forme du relevé : son image désignée par le hash du média, plus par un chemin de partie. */
export type FormeReleve = Omit<Forme, "media"> & { readonly media?: string };

export interface DiapositiveReleve {
  readonly n: number;
  readonly masquee: boolean;
  readonly disposition: string;
  readonly formes: readonly FormeReleve[];
  readonly notes: string;
  readonly liens: readonly string[];
  readonly pas_a_pas?: PasAPas;
}

export interface Releve {
  readonly schema: typeof SCHEMA_RELEVE;
  readonly deck: { readonly nom: string; readonly empreinte: string; readonly largeur: number; readonly hauteur: number; readonly masques: number };
  readonly medias: Readonly<Record<string, MediaReleve>>;
  readonly diapositives: readonly DiapositiveReleve[];
}

/** Dimensions d'un EMF : `rclBounds` de l'en-tête EMR_HEADER (même lecture que Pillow). */
function pxEmf(o: Uint8Array): [number, number] | null {
  if (o.length < 44) return null;
  const v = new DataView(o.buffer, o.byteOffset, o.byteLength);
  if (v.getUint32(0, true) !== 1 || String.fromCharCode(...o.subarray(40, 44)) !== " EMF") return null;
  return [v.getInt32(16, true) - v.getInt32(8, true), v.getInt32(20, true) - v.getInt32(12, true)];
}

function pxDe(ext: string, o: Uint8Array): [number, number] | null {
  if (ext === "emf") return pxEmf(o);
  try {
    const d = imageSize(o);
    return d.width && d.height ? [d.width, d.height] : null;
  } catch {
    return null;
  }
}

export function relever(octets: Uint8Array, nom: string): { releve: Releve; medias: Map<string, { ext: string; octets: Uint8Array }> } {
  const paquet = new Paquet(octets);
  const { largeur, hauteur } = paquet.taille();
  const medias = new Map<string, { ext: string; octets: Uint8Array }>();
  const fiches: Record<string, MediaReleve> = {};
  const hashParPartie = new Map<string, string>();

  const hashDe = (partie: string | undefined): string | null => {
    if (!partie) return null;
    const connu = hashParPartie.get(partie);
    if (connu) return connu;
    const o = paquet.octets(partie);
    if (!o) return null;
    const h = sha256(o);
    const ext = posix.extname(partie).slice(1).toLowerCase();
    hashParPartie.set(partie, h);
    if (!medias.has(h)) {
      medias.set(h, { ext, octets: o });
      fiches[h] = { ext, octets: o.length, px: pxDe(ext, o) };
    }
    return h;
  };

  const diapositives = paquet.diapositives().map(({ n, chemin, masquee }): DiapositiveReleve => {
    const formes = formesDeDiapositive(paquet, chemin);
    const releves: FormeReleve[] = formes.map(({ media, ...f }) => {
      const h = hashDe(media);
      return h ? { ...f, media: h } : f;
    });
    const pas = apparier(formes, largeur, (f) => hashDe(f.media));
    return {
      n,
      masquee,
      disposition: paquet.disposition(chemin)?.nom ?? "",
      formes: releves,
      notes: paquet.notes(chemin),
      liens: paquet.relations(chemin).filter((r) => r.externe && r.type === "hyperlink").map((r) => r.cible),
      ...(pas ? { pas_a_pas: pas } : {}),
    };
  });

  const tries = Object.fromEntries(Object.keys(fiches).sort().map((h) => [h, fiches[h]!]));
  return {
    releve: {
      schema: SCHEMA_RELEVE,
      deck: { nom, empreinte: sha256(octets), largeur, hauteur, masques: paquet.nombreDeMasques() },
      medias: tries,
      diapositives,
    },
    medias,
  };
}
