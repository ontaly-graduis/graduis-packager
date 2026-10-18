// Rejouer un procédé (I-PKG-18) : sur un deck, et le PPT revu s'il y en a un, la chaîne entière — relever, qualifier, émettre,
// livrer — puis chaque empreinte comparée à la référence du procédé. Le rejeu dit ce qui diffère ; monter de version reste un
// acte, que le rejeu outille en écrivant, à la demande, les empreintes obtenues dans une nouvelle référence.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { arch, platform } from "node:os";
import { basename, join, resolve } from "node:path";
import { diagnostiquer } from "../diagnostic/regles";
import { rapportHtml } from "../diagnostic/rapport-html";
import type { Ecart } from "../ecart/ecart";
import { emettre } from "../emission/emettre";
import { sha256, stringify2 } from "../lib/json";
import { livrer, type Livraison } from "../livraison/livrer";
import type { Impression } from "../papier/imprimer";
import { qualifierReleve } from "../qualification/qualifier";
import { relever } from "../releve/releve";
import { versionsEnEcart, type ProcedeCharge, type Version } from "./procede";

/** Ce que la référence attend d'une livraison : ses empreintes, ou son refus. */
interface LivraisonAttendue {
  readonly refusee?: readonly string[];
  readonly ppt?: string;
  readonly pivot?: string;
  readonly sorties?: Readonly<Record<string, string | { readonly texte: string; readonly pages: number; readonly recette: string }>>;
  readonly "rapport.json"?: string;
  readonly ecarts?: number;
}

/** Ce qu'une référence attend d'un cas : la qualification (deck seul), le PPT de validation, et chaque livraison par extrait. */
type CasAttendu = { qualification?: Record<string, string>; "validation.pptx": string; entrees?: string } & Record<string, unknown>;

/** La référence d'un procédé (`golden/`) : par cas, les empreintes de chaque étape. */
interface Reference {
  nom: string;
  version: { tag: string; commit: string | null };
  date: string;
  environnement: Record<string, string | null>;
  deck: { nom: string; empreinte: string };
  cas: Record<string, CasAttendu>;
}

interface Comparaison {
  readonly quoi: string;
  readonly attendue: string | null;
  readonly obtenue: string | null;
}

export interface Rejeu {
  readonly procede: string;
  readonly cas: "deck" | "revue";
  /** `journee`, ou les séquences livrées jointes par des tirets. */
  readonly extrait: string;
  readonly versions: readonly Version[];
  readonly comparaisons: readonly Comparaison[];
  readonly ecart: Ecart;
  readonly refus: readonly string[];
  readonly conforme: boolean;
}

interface OptionsDeRejeu {
  readonly deck: string;
  /** Le PPT de validation revu : les décisions humaines, d'où l'on repart (sans lui, le PPT émis, sans revue). */
  readonly revue?: string;
  readonly sequences?: readonly string[];
  readonly sortie: string;
  readonly imprimer?: (html: string) => Promise<Impression>;
  readonly convertir?: ((hash: string, ext: string, octets: Uint8Array) => Uint8Array | null) | null;
  readonly moteurs: { readonly chromium: string | null; readonly libreoffice: string | null };
  /** Monter de version : le fichier de la nouvelle référence où écrire les empreintes obtenues (le cas et l'extrait rejoués). */
  readonly nouvelleReference?: string;
}

const refusEnLignes = (l: Livraison) => l.bloquants.map((k) => `diapo ${k.diapo ?? "—"} · ${k.regle} · ${k.message}`);

export async function rejouer(p: ProcedeCharge, o: OptionsDeRejeu): Promise<Rejeu> {
  const versions = versionsEnEcart(p, o.moteurs);
  const verrou = versions.find((v) => v.bloquante);
  if (verrou) throw new Error(`le ${verrou.quoi} diffère de celui du procédé (${verrou.trouvee ?? "absent"} au lieu de ${verrou.attendue}) : npm ci d'abord, ou monter de version`);
  const reference = JSON.parse(readFileSync(resolve(p.racine, p.procede.reference), "utf8")) as Reference;
  const cas = o.revue ? "revue" : "deck";
  const extrait = o.sequences ? o.sequences.join("-") : "journee";
  const attendu = reference.cas[cas];
  const comparaisons: Comparaison[] = [];
  const comparer = (quoi: string, attendue: string | null | undefined, obtenue: string | null) => comparaisons.push({ quoi, attendue: attendue ?? null, obtenue });
  mkdirSync(o.sortie, { recursive: true });

  // Relever et qualifier le deck : le pivot₀ et son rapport.
  const { releve, medias } = relever(new Uint8Array(readFileSync(o.deck)), basename(o.deck));
  const { spec: pivot0, qualifications } = qualifierReleve(releve, p.profil);
  const rapport = diagnostiquer(pivot0, releve, qualifications, { charte: p.procede.charte, profil: p.profil });
  const ecrits: [string, string | Uint8Array][] = [
    ["releve.json", stringify2(releve)], ["seance-spec.json", stringify2(pivot0)],
    ["rapport.json", stringify2(rapport)], ["rapport.html", rapportHtml(rapport, p.theme, p.procede.charte)],
  ];
  // Émettre le PPT de validation : le support de la revue.
  const media = (h: string) => { const m = medias.get(h); return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined; };
  const emis = emettre(pivot0, { theme: p.theme, media });
  ecrits.push(["validation.pptx", emis]);
  for (const [f, c] of ecrits) writeFileSync(join(o.sortie, f), c);
  if (cas === "deck") {
    for (const [f, c] of ecrits.filter(([f]) => f !== "validation.pptx")) comparer(`qualification/${f === "seance-spec.json" ? "pivot" : f}`, attendu?.qualification?.[f === "seance-spec.json" ? "pivot" : f], sha256(c));
  }

  // Livrer depuis le PPT revu, ou depuis le PPT émis.
  const ppt = o.revue ? new Uint8Array(readFileSync(o.revue)) : emis;
  comparer("validation.pptx", attendu?.["validation.pptx"], sha256(ppt));
  const l = await livrer(ppt, "validation.pptx", {
    procede: p, releveSource: releve, ...(o.sequences ? { sequences: o.sequences } : {}),
    convertir: o.convertir ?? null, ...(o.imprimer ? { imprimer: o.imprimer } : {}),
  });
  const dossier = join(o.sortie, `livraison${o.revue ? "-revue" : ""}${o.sequences ? `-${extrait}` : ""}`);
  mkdirSync(dossier, { recursive: true });
  for (const [f, c] of l.fichiers) writeFileSync(join(dossier, f), c);
  writeFileSync(join(dossier, "ecart.json"), stringify2(l.ecart));

  const voulue = attendu?.[extrait] as LivraisonAttendue | undefined;
  const refus = refusEnLignes(l);
  if (voulue?.refusee || refus.length) {
    comparer("livraison refusée", voulue?.refusee ? sha256(voulue.refusee.join("\n")) : null, refus.length ? sha256(refus.join("\n")) : null);
  } else {
    const m = l.manifeste;
    comparer("livraison/ppt", voulue?.ppt, m.ppt.empreinte);
    comparer("livraison/pivot", voulue?.pivot, m.pivot);
    for (const [f, s] of Object.entries(m.sorties)) {
      const v = voulue?.sorties?.[f];
      const vu = typeof v === "object" ? `${v.texte} · ${v.pages} pages · ${v.recette}` : v;
      comparer(`livraison/${f}`, vu, s.texte ? `${s.texte} · ${s.pages} pages · ${s.recette}` : s.empreinte);
    }
    for (const f of Object.keys(voulue?.sorties ?? {}).filter((f) => !(f in m.sorties))) comparer(`livraison/${f}`, String(voulue?.sorties?.[f]), null);
    comparer("livraison/rapport.json", voulue?.["rapport.json"], sha256(stringify2(l.rapport)));
    comparer("livraison/écarts de lecture", voulue?.ecarts !== undefined ? String(voulue.ecarts) : null, String(m.ecarts.length));
  }
  const conforme = comparaisons.every((c) => c.attendue !== null && c.attendue === c.obtenue);
  const r: Rejeu = { procede: p.procede.nom, cas, extrait, versions, comparaisons, ecart: l.ecart, refus, conforme };
  writeFileSync(join(o.sortie, `rejeu-${cas}-${extrait}.json`), stringify2({ ...r, ecart: undefined }));
  if (o.nouvelleReference) {
    const qualification = cas === "deck" ? Object.fromEntries(ecrits.filter(([f]) => f !== "validation.pptx").map(([f, c]) => [f === "seance-spec.json" ? "pivot" : f, sha256(c)])) : undefined;
    const m = l.manifeste;
    const livraison = refus.length ? { refusee: refus, code: 1 } : {
      ppt: m.ppt.empreinte, pivot: m.pivot,
      sorties: Object.fromEntries(Object.entries(m.sorties).map(([f, s]) => [f, s.texte ? { texte: s.texte, pages: s.pages, recette: s.recette } : s.empreinte])),
      "rapport.json": sha256(stringify2(l.rapport)), ecarts: m.ecarts.length,
    };
    ecrireReference(p, o, releve.deck, cas, extrait, sha256(ppt), qualification, livraison);
  }
  return r;
}

/** Écrit (ou complète) une nouvelle référence : le cas et l'extrait rejoués, sous la version et l'environnement courants. */
function ecrireReference(p: ProcedeCharge, o: OptionsDeRejeu, deck: { nom: string; empreinte: string }, cas: string, extrait: string,
  validation: string, qualification: Record<string, string> | undefined, livraison: Record<string, unknown>): void {
  const fichier = resolve(o.nouvelleReference!);
  const ref: Reference = existsSync(fichier) ? JSON.parse(readFileSync(fichier, "utf8")) as Reference : {
    nom: `Référence ${p.procede.versions.bibliotheque} — le procédé ${p.procede.nom} sur ${deck.nom}`,
    version: { tag: p.procede.versions.bibliotheque, commit: null }, date: "", environnement: {}, deck, cas: {},
  };
  if (ref.deck.empreinte !== deck.empreinte) throw new Error(`${o.nouvelleReference} porte un autre deck (${ref.deck.nom}) : une référence, un deck`);
  const git = (...args: string[]) => { const x = spawnSync("git", args, { cwd: p.racine, encoding: "utf8" }); return x.status === 0 ? x.stdout.trim() : null; };
  const modifie = git("status", "--porcelain", "--untracked-files=no", "--", "src", "package.json", "package-lock.json");
  ref.version.commit = `${git("rev-parse", "HEAD") ?? "inconnu"}${modifie ? " (modifiée)" : ""}`;
  ref.date = new Date().toISOString().slice(0, 10);
  const verrou = resolve(p.racine, "package-lock.json");
  ref.environnement = {
    systeme: `${platform()} ${arch()}`, node: process.version, verrou: existsSync(verrou) ? sha256(readFileSync(verrou)) : null,
    "playwright-core": (createRequire(resolve(p.racine, "package.json"))("playwright-core/package.json") as { version: string }).version,
    chromium: o.moteurs.chromium, libreoffice: o.moteurs.libreoffice, conversions: p.conversions?.empreinte ?? null,
  };
  const entrees = cas === "revue" ? `le deck et le PPT de validation revu (${basename(o.revue ?? "")})` : "le deck seul, sans revue";
  const c: CasAttendu = ref.cas[cas] ?? { entrees, "validation.pptx": validation };
  ref.cas[cas] = { ...c, entrees, ...(qualification ? { qualification } : {}), "validation.pptx": validation, [extrait]: livraison };
  writeFileSync(fichier, stringify2(ref));
}
