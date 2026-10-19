// Le tableau comparé du corpus d'épreuve (`graduis/tableau-corpus@0`) : part décidée par les seules règles génériques, par deck et
// par famille, justesse contre la vérité de terrain, figures manquantes, lectures étendues, gabarits par client — en JSON et en Markdown.
import { FIGURES } from "../pivot/seance-spec";
import { SIGNAL_POSITION, SIGNAL_REPLI, type Qualification } from "../qualification/figures";
import { CANDIDATES, FAMILLES_DE_DECK, type FamilleDeDeck } from "./corpus";
import type { Lectures } from "./lectures";

const SCHEMA_TABLEAU = "graduis/tableau-corpus@0";

/**
 * Deux decks sont d'une même famille de gabarit quand leurs noms de dispositions se recouvrent à ce point (Jaccard ; mesuré :
 * ≥ 0,81 dans une famille, ≤ 0,17 entre familles, mais 0,5 et plus entre decks partis du modèle Office par défaut) et que leurs
 * masques partagent au moins une image (mesuré : de 0,24 à 1 dans une famille, 0 entre familles) — ou n'en dessinent aucune.
 */
export const SEUIL_GABARIT = 0.5;

export interface MesureDeDeck {
  readonly nom: string;
  readonly famille: FamilleDeDeck;
  readonly client: string;
  readonly role: "tableau" | "gabarit";
  readonly lectures: Lectures;
  /** Pour un deck du tableau : la figure retenue par les règles, par diapositive. */
  readonly qualifications?: ReadonlyMap<number, Qualification>;
  /** La vérité de terrain revue, par diapositive. */
  readonly verite?: ReadonlyMap<number, string>;
}

type Compte = Record<string, number>;

interface Verite {
  /** Décidées et justes ; décidées et fausses. */
  readonly justes: number;
  readonly fausses: number;
  /** Au repli, une diapositive de contenu (le repli avait raison) ; une autre figure (à décider). */
  readonly repliContenu: number;
  readonly repliAutre: number;
  /** Ce que la vérité dit à la place des règles, « règles → vérité ». */
  readonly confusions: Compte;
  /** Les figures de la vérité hors des quinze : candidates et « autre : … ». */
  readonly manquantes: Compte;
}

interface Etendues {
  readonly smartart: number;
  readonly graphiques: number;
  readonly animees: number;
  /** Diapositives dont les formes entrent en deux temps au moins ; dont l'ordre suit la lecture. */
  readonly devoilements: number;
  readonly selonLaLecture: number;
  readonly questions: number;
  readonly duplications: number;
  /** Diapositives au repli qui portent un signal étendu (SmartArt, graphique, question → réponse, dévoilement). */
  readonly potentiel: number;
}

export interface LigneDeDeck {
  readonly deck: string;
  readonly famille: FamilleDeDeck;
  readonly client: string;
  readonly gabarit: string;
  readonly diapos: number;
  readonly position: number;
  readonly decidees: number;
  readonly repli: number;
  /** Les figures décidées (hors position et repli). */
  readonly figures: Compte;
  /** Les signaux qui ont décidé, chiffres ramenés à « N ». */
  readonly signaux: Compte;
  readonly etendues: Etendues;
  readonly verite: Verite | null;
}

export interface Tableau {
  readonly schema: typeof SCHEMA_TABLEAU;
  readonly corpus: { readonly nom: string; readonly empreinte: string; readonly profil: string };
  readonly decks: readonly LigneDeDeck[];
  readonly familles: readonly (Omit<LigneDeDeck, "deck" | "famille" | "client" | "gabarit"> & { readonly famille: FamilleDeDeck; readonly decks: number })[];
  /** Par client : ses decks, leurs empreintes de gabarit distinctes, leurs familles de gabarit. */
  readonly gabarits: readonly { readonly client: string; readonly decks: number; readonly empreintes: number; readonly familles: readonly string[] }[];
}

const plus = (c: Compte, k: string, n = 1) => { c[k] = (c[k] ?? 0) + n; };
const trie = (c: Compte): Compte => Object.fromEntries(Object.entries(c).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const somme = (cs: readonly Compte[]): Compte => { const t: Compte = {}; for (const c of cs) for (const [k, v] of Object.entries(c)) plus(t, k, v); return trie(t); };

function jaccard(a: readonly string[], b: readonly string[]): number {
  const B = new Set(b);
  const inter = a.filter((x) => B.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union ? inter / union : 1;
}

/** Les familles de gabarit : composantes connexes des decks de même gabarit (ou de même empreinte), nommées G1, G2… dans l'ordre du manifeste. */
function famillesDeGabarit(mesures: readonly MesureDeDeck[]): string[] {
  const famille: number[] = mesures.map((_, i) => i);
  const racine = (i: number): number => (famille[i] === i ? i : (famille[i] = racine(famille[i]!)));
  mesures.forEach((a, i) => mesures.slice(0, i).forEach((b, j) => {
    const ga = a.lectures.gabarit, gb = b.lectures.gabarit;
    const memeIdentite = (!ga.images.length && !gb.images.length) || ga.images.some((x) => gb.images.includes(x));
    if (ga.empreinte === gb.empreinte || (jaccard(ga.dispositions, gb.dispositions) >= SEUIL_GABARIT && memeIdentite)) famille[racine(i)] = racine(j);
  }));
  const noms = new Map<number, string>();
  return mesures.map((_, i) => {
    const r = racine(i);
    if (!noms.has(r)) noms.set(r, `G${noms.size + 1}`);
    return noms.get(r)!;
  });
}

function etenduesDe(l: Lectures, repli: ReadonlySet<number>): Etendues {
  const d = l.diapositives;
  const devoile = d.filter((x) => (x.animation?.devoilement ?? 0) >= 2);
  const questions = l.paires.filter((p) => p.interrogative);
  const signal = new Set([
    ...d.filter((x) => x.smartart?.length || x.graphiques?.length).map((x) => x.n),
    ...devoile.map((x) => x.n),
    ...questions.flatMap((p) => [p.question, p.reponse]),
  ]);
  return {
    smartart: d.reduce((n, x) => n + (x.smartart?.length ?? 0), 0),
    graphiques: d.reduce((n, x) => n + (x.graphiques?.length ?? 0), 0),
    animees: d.filter((x) => x.animation).length,
    devoilements: devoile.length,
    selonLaLecture: devoile.filter((x) => x.animation!.selonLaLecture === true).length,
    questions: questions.length,
    duplications: l.paires.length - questions.length,
    potentiel: [...signal].filter((n) => repli.has(n)).length,
  };
}

/** La clé d'un nom libre : sans accents, sans ponctuation ni espaces, sans « s » final par mot. */
const cleDeNom = (v: string) => v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .split(/[^a-z0-9]+/).filter(Boolean).map((m) => m.replace(/s$/, "")).join("");

/**
 * Les graphies d'une même figure « autre : … » (mesuré : quatre graphies d'un même nom sous la main d'un seul relecteur) se
 * comptent ensemble, sous la plus fréquente (à égalité, la première dans l'ordre alphabétique).
 */
function graphies(mesures: readonly MesureDeDeck[]): Map<string, string> {
  const parCle = new Map<string, Compte>();
  for (const m of mesures) for (const v of m.verite?.values() ?? []) {
    if (!v.startsWith("autre : ")) continue;
    const k = cleDeNom(v);
    parCle.set(k, { ...(parCle.get(k) ?? {}), [v]: (parCle.get(k)?.[v] ?? 0) + 1 });
  }
  const canon = new Map<string, string>();
  for (const c of parCle.values()) {
    const choisie = Object.entries(c).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]![0];
    for (const v of Object.keys(c)) canon.set(v, choisie);
  }
  return canon;
}

function ligneDe(m: MesureDeDeck, gabarit: string, canon: ReadonlyMap<string, string>): LigneDeDeck {
  const q = m.qualifications!;
  const figures: Compte = {};
  const signaux: Compte = {};
  const repli = new Set<number>();
  let position = 0;
  for (const [n, x] of q) {
    if (x.signal === SIGNAL_POSITION) position++;
    else if (x.signal === SIGNAL_REPLI) repli.add(n);
    else { plus(figures, x.figure); plus(signaux, `${x.figure} · ${x.signal.replace(/\d+/g, "N")}`); }
  }
  let verite: Verite | null = null;
  if (m.verite) {
    let justes = 0, fausses = 0, repliContenu = 0, repliAutre = 0;
    const confusions: Compte = {};
    const manquantes: Compte = {};
    for (const [n, x] of q) {
      const v = canon.get(m.verite.get(n)!) ?? m.verite.get(n)!;
      if (!(FIGURES as readonly string[]).includes(v)) plus(manquantes, v);
      if (x.signal === SIGNAL_POSITION) continue;
      if (repli.has(n)) { if (v === "contenu") repliContenu++; else { repliAutre++; plus(confusions, `repli → ${v}`); } }
      else if (v === x.figure) justes++;
      else { fausses++; plus(confusions, `${x.figure} → ${v}`); }
    }
    verite = { justes, fausses, repliContenu, repliAutre, confusions: trie(confusions), manquantes: trie(manquantes) };
  }
  return {
    deck: m.nom, famille: m.famille, client: m.client, gabarit,
    diapos: q.size, position, decidees: q.size - position - repli.size, repli: repli.size,
    figures: trie(figures), signaux: trie(signaux), etendues: etenduesDe(m.lectures, repli), verite,
  };
}

export function tableauDuCorpus(corpus: Tableau["corpus"], mesures: readonly MesureDeDeck[]): Tableau {
  const gabarits = famillesDeGabarit(mesures);
  const canon = graphies(mesures);
  const decks = mesures.flatMap((m, i) => (m.role === "tableau" && m.qualifications ? [ligneDe(m, gabarits[i]!, canon)] : []));
  const familles = FAMILLES_DE_DECK.flatMap((famille) => {
    const ls = decks.filter((l) => l.famille === famille);
    if (!ls.length) return [];
    const n = (k: "diapos" | "position" | "decidees" | "repli") => ls.reduce((s, l) => s + l[k], 0);
    const e = (k: keyof Etendues) => ls.reduce((s, l) => s + l.etendues[k], 0);
    const vs = ls.flatMap((l) => (l.verite ? [l.verite] : []));
    const v = (k: "justes" | "fausses" | "repliContenu" | "repliAutre") => vs.reduce((s, x) => s + x[k], 0);
    return [{
      famille, decks: ls.length, diapos: n("diapos"), position: n("position"), decidees: n("decidees"), repli: n("repli"),
      figures: somme(ls.map((l) => l.figures)), signaux: somme(ls.map((l) => l.signaux)),
      etendues: {
        smartart: e("smartart"), graphiques: e("graphiques"), animees: e("animees"), devoilements: e("devoilements"),
        selonLaLecture: e("selonLaLecture"), questions: e("questions"), duplications: e("duplications"), potentiel: e("potentiel"),
      },
      verite: vs.length ? {
        justes: v("justes"), fausses: v("fausses"), repliContenu: v("repliContenu"), repliAutre: v("repliAutre"),
        confusions: somme(vs.map((x) => x.confusions)), manquantes: somme(vs.map((x) => x.manquantes)),
      } : null,
    }];
  });
  const clients = [...new Set(mesures.map((m) => m.client))];
  return {
    schema: SCHEMA_TABLEAU,
    corpus,
    decks,
    familles,
    gabarits: clients.map((client) => {
      const idx = mesures.flatMap((m, i) => (m.client === client ? [i] : []));
      return {
        client, decks: idx.length,
        empreintes: new Set(idx.map((i) => mesures[i]!.lectures.gabarit.empreinte)).size,
        familles: [...new Set(idx.map((i) => gabarits[i]!))],
      };
    }),
  };
}

// ——— En Markdown ———

const LIB_FAMILLE: Readonly<Record<FamilleDeDeck, string>> = {
  "procedural-logiciel": "Procédural logiciel", comportemental: "Comportemental", reglementaire: "Réglementaire", metier: "Métier",
};
/** Un nombre à la française, sans dépendre de la langue du poste. */
const fr = (x: number) => String(x).replace(".", ",");
const pc = (n: number, d: number) => (d ? `${fr(Math.round((1000 * n) / d) / 10)} %` : "—");
const part = (n: number, d: number) => `${n} (${pc(n, d)})`;
const liste = (c: Compte, max = 99) => Object.entries(c).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, max)
  .map(([k, v]) => `${k} ×${v}`).join(" · ") || "—";
const table = (entete: readonly string[], lignes: readonly (readonly (string | number)[])[]) =>
  [`| ${entete.join(" | ")} |`, `|${entete.map(() => "---").join("|")}|`, ...lignes.map((l) => `| ${l.join(" | ")} |`)].join("\n");

export function tableauEnMarkdown(t: Tableau): string {
  const juste = (x: { decidees: number; diapos: number; verite: Verite | null }) => (x.verite ? part(x.verite.justes, x.diapos) : "non revue");
  const precision = (x: { verite: Verite | null }) => (x.verite ? pc(x.verite.justes, x.verite.justes + x.verite.fausses) : "—");
  const manquantes = somme(t.decks.flatMap((l) => (l.verite ? [l.verite.manquantes] : [])));
  const revues = t.decks.filter((l) => l.verite).length;
  return [
    `# Corpus d'épreuve « ${t.corpus.nom} » — tableau comparé`,
    "",
    `Manifeste ${t.corpus.empreinte} · profil ${t.corpus.profil}. Une diapositive est **décidée** quand une règle autre que le repli (« ${SIGNAL_REPLI} ») tranche ; la couverture par la seule position (« ${SIGNAL_POSITION} ») est comptée à part. **Décidée et juste** : contre la vérité de terrain revue (${revues} deck(s) sur ${t.decks.length}).`,
    "",
    "## Part décidée par les seules règles génériques, par famille",
    "",
    table(["Famille", "Decks", "Diapos", "Position", "Décidées", "Repli", "Décidées et justes", "Justesse des décidées"],
      t.familles.map((f) => [LIB_FAMILLE[f.famille], f.decks, f.diapos, f.position, part(f.decidees, f.diapos), part(f.repli, f.diapos), juste(f), precision(f)])),
    "",
    "## Par deck",
    "",
    table(["Deck", "Famille", "Client", "Gabarit", "Diapos", "Décidées", "Repli", "Décidées et justes", "Justesse"],
      t.decks.map((l) => [l.deck, LIB_FAMILLE[l.famille], l.client, l.gabarit, l.diapos, part(l.decidees, l.diapos), part(l.repli, l.diapos), juste(l), precision(l)])),
    "",
    "## Ce qui décide",
    "",
    table(["Famille", "Signaux"], t.familles.map((f) => [LIB_FAMILLE[f.famille], liste(f.signaux)])),
    "",
    "## Ce que la vérité dit à la place des règles",
    "",
    revues ? table(["Famille", "Confusions (règles → vérité)"], t.familles.map((f) => [LIB_FAMILLE[f.famille], f.verite ? liste(f.verite.confusions, 12) : "non revue"])) : "Vérité de terrain non revue.",
    "",
    "## Figures manquantes",
    "",
    revues ? `Hors des quinze figures, nommées par la vérité de terrain (candidates du § 4.5 : ${CANDIDATES.join(", ")} ; et « autre : … ») : ${liste(manquantes)}.` : "Vérité de terrain non revue : les figures manquantes se comptent sur elle.",
    "",
    "## Lectures étendues",
    "",
    table(["Deck", "SmartArt", "Graphiques", "Diapos animées", "Dévoilements (≥ 2 temps)", "… selon la lecture", "Questions → réponses", "Duplications", "Potentiel (au repli)"],
      t.decks.map((l) => [l.deck, l.etendues.smartart, l.etendues.graphiques, l.etendues.animees, l.etendues.devoilements, l.etendues.selonLaLecture, l.etendues.questions, l.etendues.duplications, l.etendues.potentiel])),
    "",
    "## Gabarits par client",
    "",
    `Une famille de gabarit réunit les decks de même empreinte, ou dont les noms de dispositions se recouvrent à ${fr(SEUIL_GABARIT)} au moins (Jaccard) et dont les masques partagent une image (ou n'en dessinent aucune).`,
    "",
    table(["Client", "Decks", "Empreintes distinctes", "Familles de gabarit"], t.gabarits.map((g) => [g.client, g.decks, g.empreintes, g.familles.join(", ")])),
    "",
  ].join("\n");
}
