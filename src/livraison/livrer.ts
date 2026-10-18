// La livraison (spec § 4) : depuis le seul PPT de validation (l'heuristique ne livre jamais, I-PKG-4), les trois sorties du
// pivot — la salle, le papier imprimé et recetté, le PPT d'animation (le PPT d'auteur réémis) — et le rapport, sous un
// manifeste qui garde leurs empreintes : la seule trace de ce qui a été livré. Un constat bloquant dans les séquences
// livrées l'arrête (H8 : rien ne se livre tant qu'il en reste).
import { emettre } from "../emission/emettre";
import { diagnostiquer, type Constat, type Rapport } from "../diagnostic/regles";
import { rapportHtml } from "../diagnostic/rapport-html";
import { estUnPptDeValidation, lire } from "../lecture/lire";
import { sha256, stringify2 } from "../lib/json";
import { construirePapier } from "../papier/construire";
import type { Impression } from "../papier/imprimer";
import { normaliser, recetter } from "../papier/recette";
import type { SeanceSpec } from "../pivot/seance-spec";
import { qualifierReleve } from "../qualification/qualifier";
import { relever, type Releve } from "../releve/releve";
import { construireSalle } from "../salle/construire";
import type { Theme } from "../theme/theme";

const SCHEMA_LIVRAISON = "graduis/livraison@0";

export interface SortieLivree {
  readonly empreinte: string;
  /** Le PDF : ses pages, l'empreinte de sa couche texte normalisée (l'identité ; ses octets sont datés par Chromium), sa recette. */
  readonly pages?: number;
  readonly texte?: string;
  readonly recette?: string;
}

export interface Manifeste {
  readonly schema: typeof SCHEMA_LIVRAISON;
  /** Le deck hérité dont tout procède. */
  readonly source: SeanceSpec["source"];
  /** Le PPT d'auteur lu (le PPT de validation revu). */
  readonly ppt: { readonly nom: string; readonly empreinte: string };
  readonly pivot: string;
  readonly prise: { readonly devoilement: "pastille"; readonly theme: string };
  readonly sequences: readonly string[] | null;
  /** Les écarts de la lecture grammaticale (ce qu'ONET a fait hors grammaire), tels quels. */
  readonly ecarts: readonly string[];
  readonly sorties: Readonly<Record<string, SortieLivree>>;
}

export interface OptionsDeLivraison {
  readonly theme: Theme;
  readonly sequences?: readonly string[];
  /** Le relevé du deck hérité, pour le rapport (sa trace de qualification, ses mesures) ; sans lui, pas de rapport. */
  readonly releveSource?: Releve;
  readonly convertir?: ((hash: string, ext: string, octets: Uint8Array) => Uint8Array | null) | null;
  /** L'imprimante (Chromium) ; sans elle, le papier reste à imprimer. */
  readonly imprimer?: (html: string) => Promise<Impression>;
}

export interface Livraison {
  readonly manifeste: Manifeste;
  /** Nom de fichier → contenu, prêts à écrire dans le dossier de la livraison. */
  readonly fichiers: ReadonlyMap<string, Uint8Array | string>;
  readonly bloquants: readonly Constat[];
  readonly rapport: Rapport | null;
  /** Les lignes que la recette du papier n'a pas retrouvées. */
  readonly manquants: readonly string[];
}

/** Le pivot réduit aux séquences livrées (le PPT d'animation d'un extrait). */
const extrait = (s: SeanceSpec, sequences?: readonly string[]): SeanceSpec =>
  (sequences ? { ...s, sequences: s.sequences.filter((q) => sequences.includes(q.id)) } : s);

export async function livrer(octets: Uint8Array, nom: string, o: OptionsDeLivraison): Promise<Livraison> {
  if (!estUnPptDeValidation(octets)) throw new Error(`${nom} n'est pas un PPT de validation : l'heuristique ne livre jamais (I-PKG-4)`);
  const { spec, ecarts } = lire(octets);
  const pivot = sha256(stringify2(spec));
  const { releve, medias } = relever(octets, nom);
  const media = (h: string) => { const m = medias.get(h); return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined; };
  const suffixe = o.sequences ? `-${o.sequences.join("-")}` : "";
  const fichiers = new Map<string, Uint8Array | string>();
  const sorties: Record<string, SortieLivree> = {};
  const poser = (fichier: string, contenu: Uint8Array | string, en: Partial<SortieLivree> = {}) => {
    fichiers.set(fichier, contenu);
    sorties[fichier] = { empreinte: sha256(contenu), ...en };
  };

  // Le rapport, sur toute la journée ; ses bloquants, dans les séquences livrées.
  let rapport: Rapport | null = null;
  let bloquants: Constat[] = [];
  if (o.releveSource && o.releveSource.deck.empreinte === spec.source.empreinte) {
    rapport = diagnostiquer(spec, o.releveSource, qualifierReleve(o.releveSource).qualifications);
    bloquants = rapport.constats.filter((k) => k.niveau === "bloquant" && (!o.sequences || (k.sequence !== null && o.sequences.includes(k.sequence))));
  }
  const manifeste = (): Manifeste => ({
    schema: SCHEMA_LIVRAISON, source: spec.source, ppt: { nom, empreinte: sha256(octets) }, pivot,
    prise: { devoilement: "pastille", theme: sha256(stringify2(o.theme)) }, sequences: o.sequences ?? null,
    ecarts: ecarts.map((e) => `diapo ${e.diapo} : ${e.message}`), sorties,
  });
  if (bloquants.length) return { manifeste: manifeste(), fichiers, bloquants, rapport, manquants: [] };

  fichiers.set("seance-spec.json", stringify2(spec));
  const salle = await construireSalle(spec, { prise: { devoilement: "pastille" }, theme: o.theme, media, ...(o.sequences ? { sequences: o.sequences } : {}), convertir: o.convertir ?? null });
  poser(`salle${suffixe}.html`, salle.html);
  const papier = await construirePapier(spec, { theme: o.theme, media, ...(o.sequences ? { sequences: o.sequences } : {}), convertir: o.convertir ?? null });
  let manquants: readonly string[] = [];
  if (o.imprimer) {
    const i = await o.imprimer(papier.html);
    const r = recetter(papier.attendus, i.lu.pages);
    manquants = r.manquants;
    poser(`participant${suffixe}.pdf`, i.pdf, { pages: i.lu.pages.length, texte: sha256(normaliser(i.lu.pages.join(""))), recette: `${r.trouves}/${r.cherches}` });
  } else {
    poser(`papier${suffixe}.html`, papier.html);
  }
  poser(`animation${suffixe}.pptx`, emettre(extrait(spec, o.sequences), { jetons: o.theme.jetons, media }));
  if (rapport) {
    poser("rapport.html", rapportHtml(rapport, o.theme));
    fichiers.set("rapport.json", stringify2(rapport));
  }
  const m = manifeste();
  fichiers.set("manifeste.json", stringify2(m));
  return { manifeste: m, fichiers, bloquants, rapport, manquants };
}
