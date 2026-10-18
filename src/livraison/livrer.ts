// La livraison (spec § 4) : depuis le seul PPT de validation (l'heuristique ne livre jamais, I-PKG-4), les trois sorties du
// pivot — la salle, le papier imprimé et recetté, le PPT d'animation (le PPT d'auteur réémis) — et le rapport, sous un
// manifeste qui garde leurs empreintes : la seule trace de ce qui a été livré. Un constat bloquant dans les séquences
// livrées l'arrête (H8 : rien ne se livre tant qu'il en reste), comme une borne de l'écart à la source franchie (I-PKG-19).
// Tout ce qui fait la production vient du procédé : prise, thème, profil de source, charte, sensibilité.
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
import { ecartDeLivraison, type Ecart } from "../ecart/ecart";
import { empreinteDuTheme, type ProcedeCharge } from "../procede/procede";

const SCHEMA_LIVRAISON = "graduis/livraison@1";

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
  /** Le procédé dont la livraison procède. */
  readonly procede: { readonly nom: string; readonly empreinte: string };
  readonly prise: { readonly devoilement: "pastille" | "ecran"; readonly theme: string };
  readonly sequences: readonly string[] | null;
  /** Les écarts de la lecture grammaticale (ce que le client a fait hors grammaire), tels quels. */
  readonly ecarts: readonly string[];
  /** L'écart à la source, en bref (le détail dans `ecart.json`). */
  readonly ecart: {
    readonly sensibilite: Ecart["sensibilite"];
    readonly chaine: { readonly inventes: number; readonly inversions: number };
    readonly revue: { readonly inventes: number; readonly inversions: number; readonly retirees: number; readonly ajoutes: number; readonly dupliques: number };
    readonly conserve: number;
    readonly franchies: readonly string[];
  };
  readonly sorties: Readonly<Record<string, SortieLivree>>;
}

export interface OptionsDeLivraison {
  readonly procede: ProcedeCharge;
  readonly sequences?: readonly string[];
  /** Le relevé du deck hérité : le rapport (sa trace de qualification) et l'écart à la source, sans quoi rien ne se livre. */
  readonly releveSource: Releve;
  readonly convertir?: ((hash: string, ext: string, octets: Uint8Array) => Uint8Array | null) | null;
  /** L'imprimante (Chromium) ; sans elle, le papier reste à imprimer. */
  readonly imprimer?: (html: string) => Promise<Impression>;
}

export interface Livraison {
  readonly manifeste: Manifeste;
  /** Nom de fichier → contenu, prêts à écrire dans le dossier de la livraison. */
  readonly fichiers: ReadonlyMap<string, Uint8Array | string>;
  /** Les constats bloquants du rapport dans les séquences livrées, et les bornes de l'écart franchies (règle ECART). */
  readonly bloquants: readonly Constat[];
  readonly ecart: Ecart;
  readonly rapport: Rapport;
  /** Les lignes que la recette du papier n'a pas retrouvées. */
  readonly manquants: readonly string[];
}

/** Le pivot réduit aux séquences livrées (le PPT d'animation d'un extrait). */
const extrait = (s: SeanceSpec, sequences?: readonly string[]): SeanceSpec =>
  (sequences ? { ...s, sequences: s.sequences.filter((q) => sequences.includes(q.id)) } : s);

export async function livrer(octets: Uint8Array, nom: string, o: OptionsDeLivraison): Promise<Livraison> {
  if (!estUnPptDeValidation(octets)) throw new Error(`${nom} n'est pas un PPT de validation : l'heuristique ne livre jamais (I-PKG-4)`);
  const { procede: p, profil, theme } = o.procede;
  const { spec, ecarts } = lire(octets, profil);
  if (o.releveSource.deck.empreinte !== spec.source.empreinte) {
    throw new Error(`le relevé donné (${o.releveSource.deck.nom}) n'est pas celui du deck dont procède ${nom} : l'écart à la source ne se mesure pas (I-PKG-19)`);
  }
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

  // Le rapport, sur toute la journée ; ses bloquants, dans les séquences livrées. L'écart : la chaîne contre le relevé, puis la revue.
  const qualifie = qualifierReleve(o.releveSource, profil);
  const rapport: Rapport = diagnostiquer(spec, o.releveSource, qualifie.qualifications, { charte: p.charte, profil });
  const ecart = ecartDeLivraison(o.releveSource, qualifie.spec, spec, p.sensibilite);
  const bloquants: Constat[] = [
    ...rapport.constats.filter((k) => k.niveau === "bloquant" && (!o.sequences || (k.sequence !== null && o.sequences.includes(k.sequence)))),
    ...ecart.franchies.map((message) => ({ regle: "ECART", niveau: "bloquant" as const, diapo: null, sequence: null, message })),
  ];
  const manifeste = (): Manifeste => ({
    schema: SCHEMA_LIVRAISON, source: spec.source, ppt: { nom, empreinte: sha256(octets) }, pivot,
    procede: { nom: p.nom, empreinte: o.procede.empreinte },
    prise: { devoilement: p.prise.devoilement, theme: empreinteDuTheme(theme) }, sequences: o.sequences ?? null,
    ecarts: ecarts.map((e) => `diapo ${e.diapo} : ${e.message}`),
    ecart: {
      sensibilite: ecart.sensibilite,
      chaine: { inventes: ecart.chaine.inventes.length, inversions: ecart.chaine.inversions },
      revue: {
        inventes: ecart.revue.inventes.length, inversions: ecart.revue.inversions, retirees: ecart.revue.retirees.length,
        ajoutes: ecart.revue.ajoutes.length, dupliques: ecart.revue.dupliques.length,
      },
      conserve: ecart.revue.conserve,
      franchies: ecart.franchies,
    },
    sorties,
  });
  if (bloquants.length) return { manifeste: manifeste(), fichiers, bloquants, ecart, rapport, manquants: [] };

  fichiers.set("seance-spec.json", stringify2(spec));
  const commun = { theme, media, ...(o.sequences ? { sequences: o.sequences } : {}), convertir: o.convertir ?? null, ...(profil.pratique ? { pratique: profil.pratique } : {}) };
  const salle = await construireSalle(spec, { ...commun, prise: p.prise });
  poser(`salle${suffixe}.html`, salle.html);
  const papier = await construirePapier(spec, commun);
  let manquants: readonly string[] = [];
  if (o.imprimer) {
    const i = await o.imprimer(papier.html);
    const r = recetter(papier.attendus, i.lu.pages);
    manquants = r.manquants;
    poser(`participant${suffixe}.pdf`, i.pdf, { pages: i.lu.pages.length, texte: sha256(normaliser(i.lu.pages.join(""))), recette: `${r.trouves}/${r.cherches}` });
  } else {
    poser(`papier${suffixe}.html`, papier.html);
  }
  poser(`animation${suffixe}.pptx`, emettre(extrait(spec, o.sequences), { theme, media }));
  poser("rapport.html", rapportHtml(rapport, theme, p.charte));
  fichiers.set("rapport.json", stringify2(rapport));
  fichiers.set("ecart.json", stringify2(ecart));
  const m = manifeste();
  fichiers.set("manifeste.json", stringify2(m));
  return { manifeste: m, fichiers, bloquants, ecart, rapport, manquants };
}
