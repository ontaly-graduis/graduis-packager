// Les mesures d'un relevé (§ 0.2 et § 0.3 de la spec) : parité avec `scripts/releve_pptx.py`, et appariement.
import type { Releve } from "./releve";
import type { Forme } from "../ooxml/formes";
import { SEUILS, aCadreTexte, dedans, distanceCentres, ecartBord, estCapture, estPastille, estTexte, estZone, texteDe } from "./geometrie";

export const INACHEVE = ["a rédiger", "a supprimer", "insérer", "xxx"] as const;

export interface Sequence {
  readonly n0: number;
  readonly titre: string;
  readonly diapositives: number;
  readonly demonstrations: number;
  readonly pasAPas: number;
  readonly captures: number;
  readonly aVousDeJouer: number;
  readonly reglesDuJeu: number;
  readonly etapesCles: number;
  readonly mots: number;
}

export interface Mesures {
  readonly diapositives: number;
  readonly dispositions: number;
  readonly masques: number;
  readonly mots: number;
  readonly denses: readonly (readonly [number, number])[];
  readonly notes: number;
  readonly pasAPas: number;
  readonly capturesSeules: number;
  readonly autres: number;
  readonly pastillesSur: number;
  readonly pastillesSurZone: number;
  readonly pastillesHors: number;
  readonly pastillesHorsTexte: number;
  readonly resolutions: readonly number[];
  readonly capturesIllisibles: number;
  readonly inacheves: readonly (readonly [number, string])[];
  readonly appariement: { readonly pas: number; readonly paires: number; readonly reperesSeuls: number; readonly legendesSeules: number; readonly avecZone: number; readonly avecConsigne: number; readonly complets: number };
  /** Médias des diapositives qu'un navigateur n'affiche pas (EMF, WDP…), par extension : à convertir pour la salle. */
  readonly nonWeb: Readonly<Record<string, number>>;
  /** Cadres graphiques autres que les tableaux (OLE, graphiques, SmartArt), par type. */
  readonly graphiques: Readonly<Record<string, number>>;
  readonly sequences: readonly Sequence[];
}

const WEB = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp"]);

function median(v: readonly number[]): number {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length === 0 ? Number.NaN : s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function medianeMots(r: Releve): number {
  return median(r.diapositives.map((d) => motsDe(d.formes as readonly Forme[])));
}

export function medianeResolution(m: Mesures): number {
  return median(m.resolutions);
}

function motsDe(formes: readonly Forme[]): number {
  return formes.filter(aCadreTexte).reduce((s, f) => s + (texteDe(f).match(/\S+/gu)?.length ?? 0), 0);
}

export function mesurer(r: Releve): Mesures {
  const { largeur } = r.deck;
  let [mots, notes, pasAPas, capturesSeules, autres] = [0, 0, 0, 0, 0];
  let [sur, surZone, hors, horsTexte, illisibles] = [0, 0, 0, 0, 0];
  const resolutions: number[] = [];
  const denses: [number, number][] = [];
  const inacheves: [number, string][] = [];
  const app = { pas: 0, paires: 0, reperesSeuls: 0, legendesSeules: 0, avecZone: 0, avecConsigne: 0, complets: 0 };
  const natures = new Map<number, string>();

  for (const d of r.diapositives) {
    const formes = d.formes as readonly Forme[];
    const caps = formes.filter((f) => estCapture(f, largeur));
    const pastilles = formes.filter(estPastille);
    const zones = formes.filter(estZone).map((f) => f.boite);
    const textes = formes.filter(estTexte);
    const m = motsDe(formes);
    mots += m;
    if (m > SEUILS.dense) denses.push([d.n, m]);
    if (d.notes) notes += 1;
    const nature = caps.length && pastilles.length ? "pas-a-pas" : caps.length ? "capture" : "autre";
    natures.set(d.n, nature);
    if (nature === "pas-a-pas") pasAPas += 1;
    else if (nature === "capture") capturesSeules += 1;
    else autres += 1;
    if (caps.length) {
      for (const p of pastilles) {
        if (caps.some((c) => dedans(p.boite, c.boite))) {
          sur += 1;
          if (zones.length && Math.min(...zones.map((z) => ecartBord(p.boite, z))) < SEUILS.zoneGap) surZone += 1;
        } else {
          hors += 1;
          if (textes.length && Math.min(...textes.map((t) => distanceCentres(p.boite, t.boite))) < SEUILS.consigneDist) horsTexte += 1;
        }
      }
    }
    for (const c of caps) {
      const px = c.media ? r.medias[c.media]?.px : null;
      if (px) resolutions.push(px[0] / ((c.boite[2] / largeur) * 1920));
      else illisibles += 1;
    }
    const corpus = (formes.filter(aCadreTexte).map(texteDe).join(" ") + " " + d.notes).toLowerCase();
    for (const motif of INACHEVE) if (corpus.includes(motif)) inacheves.push([d.n, motif]);
    for (const p of d.pas_a_pas?.pas ?? []) {
      app.pas += 1;
      if (p.repere && p.legende) app.paires += 1;
      else if (p.repere) app.reperesSeuls += 1;
      else app.legendesSeules += 1;
      if (p.zone) app.avecZone += 1;
      if (p.consigne) app.avecConsigne += 1;
      if (p.zone && p.consigne) app.complets += 1;
    }
  }

  const sequences: Sequence[] = [];
  let cur: { n0: number; titre: string; d: (typeof r.diapositives)[number][] } = { n0: 1, titre: "(ouverture)", d: [] };
  const titreDe = (d: (typeof r.diapositives)[number]) =>
    (d.formes as readonly Forme[]).filter(aCadreTexte).map(texteDe).filter(Boolean).join(" | ").replace(/\n/g, " ");
  for (const d of r.diapositives) {
    if (d.disposition.includes("Slide transition")) {
      sequences.push(fermer(cur));
      cur = { n0: d.n, titre: titreDe(d), d: [] };
    }
    cur.d.push(d);
  }
  sequences.push(fermer(cur));

  function fermer(q: typeof cur): Sequence {
    const ecran = (d: (typeof q.d)[number], mot: string) =>
      d.disposition.includes("Ecran Votre promotion") && titreDe(d).toLowerCase().includes(mot);
    return {
      n0: q.n0,
      titre: q.titre,
      diapositives: q.d.length,
      demonstrations: q.d.filter((d) => ecran(d, "démonstration")).length,
      pasAPas: q.d.filter((d) => natures.get(d.n) === "pas-a-pas").length,
      captures: q.d.filter((d) => natures.get(d.n) === "capture").length,
      aVousDeJouer: q.d.filter((d) => ecran(d, "a vous de jouer")).length,
      reglesDuJeu: q.d.filter((d) => d.disposition.includes("Regles du jeu")).length,
      etapesCles: q.d.filter((d) => d.disposition.includes("Que retenez")).length,
      mots: q.d.reduce((s, d) => s + motsDe(d.formes as readonly Forme[]), 0),
    };
  }

  const nonWeb: Record<string, number> = {};
  for (const { ext } of Object.values(r.medias)) if (!WEB.has(ext)) nonWeb[ext] = (nonWeb[ext] ?? 0) + 1;
  const graphiques: Record<string, number> = {};
  for (const d of r.diapositives) for (const f of d.formes) if (f.nature === "graphique") graphiques[f.graphique ?? ""] = (graphiques[f.graphique ?? ""] ?? 0) + 1;

  return {
    diapositives: r.diapositives.length,
    dispositions: new Set(r.diapositives.map((d) => d.disposition)).size,
    masques: r.deck.masques,
    mots, denses, notes, pasAPas, capturesSeules, autres,
    pastillesSur: sur, pastillesSurZone: surZone, pastillesHors: hors, pastillesHorsTexte: horsTexte,
    resolutions, capturesIllisibles: illisibles, inacheves, appariement: app, nonWeb, graphiques, sequences,
  };
}
