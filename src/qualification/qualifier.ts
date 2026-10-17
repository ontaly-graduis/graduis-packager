// Relevé → pivot₀ (`seance-spec`) : un bloc par diapositive, des séquences coupées aux transitions, des pas en % de capture.
import type { Boite, Forme } from "../ooxml/formes";
import type { Releve, DiapositiveReleve, FormeReleve } from "../releve/releve";
import { POUCE, aCadreTexte, dedans, estCapture, estPastille, estZone, texteDe } from "../releve/geometrie";
import { SCHEMA_SEANCE, type Bloc, type Pas, type SeanceSpec, type Sequence, type Visuel } from "../pivot/seance-spec";
import { dessinDe } from "./dessin";
import { structurer } from "./structure";
import { estDeService, qualifier as qualifierDiapo, type Qualification } from "./figures";

/** Tolérance d'une rangée pour l'ordre de lecture : deux boîtes dont les hauts diffèrent de moins sont sur la même ligne. */
const RANGEE = 0.15 * POUCE;

const trois = (n: number) => String(n).padStart(3, "0");

/** Les figures de texte, dont la qualification lit l'organisation (`structure`). */
const TEXTUELLES: ReadonlySet<string> = new Set(["contenu", "objectifs", "synthese", "etapes-cles"]);
const normal = (s: string) => s.replace(/\s+/g, " ").trim();
const centieme = (v: number) => Math.round(v * 100) / 100;

/** Ordre de lecture : par rangées de haut en bas, puis de gauche à droite dans une rangée. */
export function ordreDeLecture<T>(items: readonly T[], boite: (t: T) => Boite): T[] {
  const tries = [...items].sort((a, b) => boite(a)[1] - boite(b)[1] || boite(a)[0] - boite(b)[0]);
  const rangees: T[][] = [];
  for (const t of tries) {
    const derniere = rangees[rangees.length - 1];
    if (derniere && Math.abs(boite(t)[1] - boite(derniere[0]!)[1]) < RANGEE) derniere.push(t);
    else rangees.push([t]);
  }
  return rangees.flatMap((r) => r.sort((a, b) => boite(a)[0] - boite(b)[0]));
}

/** Un rectangle absolu ramené en pourcentage de la capture, borné à la capture. */
function enPourcent(z: Boite, c: Boite): [number, number, number, number] {
  const x = Math.min(100, Math.max(0, ((z[0] - c[0]) / c[2]) * 100));
  const y = Math.min(100, Math.max(0, ((z[1] - c[1]) / c[3]) * 100));
  const w = Math.min(100 - x, Math.max(0, (z[2] / c[2]) * 100));
  const h = Math.min(100 - y, Math.max(0, (z[3] / c[3]) * 100));
  return [centieme(x), centieme(y), centieme(w), centieme(h)];
}

function titreDe(d: DiapositiveReleve, hauteur: number): FormeReleve | undefined {
  const espace = d.formes.find((f) => f.espace && ["title", "ctrTitle"].includes(f.espace.type) && texteDe(f as Forme));
  if (espace) return espace;
  const candidats = d.formes.filter((f) => aCadreTexte(f as Forme) && !estDeService(f) && !estPastille(f as Forme)
    && texteDe(f as Forme) && f.boite[1] < hauteur * 0.22);
  return ordreDeLecture(candidats, (f) => f.boite)[0];
}

/** Les pas du relevé, zones en % de leur capture, puis les zones libres proposées par ordre de lecture. */
function pasDe(d: DiapositiveReleve, largeur: number): Pas[] {
  const releve = d.pas_a_pas?.pas ?? [];
  const captures = d.formes.filter((f) => estCapture(f as Forme, largeur) && f.media);
  const captureDe = (hash: string | null, b: Boite | null): FormeReleve | undefined => {
    const memes = captures.filter((c) => c.media === hash);
    return (b && memes.find((c) => dedans(b, c.boite))) ?? memes[0];
  };
  const zones = d.formes.filter((f) => estZone(f as Forme)).map((f) => f.boite);
  const prises = new Set(releve.flatMap((p) => (p.zone ? [p.zone.join(",")] : [])));

  const pas: { p: Pas; capture: FormeReleve | undefined }[] = releve.map((p) => {
    const capture = captureDe(p.capture, p.repere ?? p.legende);
    return {
      capture,
      p: {
        numero: p.numero,
        capture: p.capture,
        zone: p.zone && capture ? enPourcent(p.zone, capture.boite) : null,
        ancrage: p.zone ? (p.repere ? "repere" : "legende") : null,
        consigne: p.consigne,
      },
    };
  });

  // Les zones libres de toutes les captures, par ordre de lecture, vont aux pas sans zone, par numéro croissant.
  const libres = ordreDeLecture(zones.filter((z) => !prises.has(z.join(",")) && captures.some((c) => dedans(z, c.boite))), (z) => z);
  const sansZone = pas.filter((x) => !x.p.zone).sort((a, b) => a.p.numero - b.p.numero);
  sansZone.forEach((x, i) => {
    const z = libres[i];
    const c = z && captures.find((k) => dedans(z, k.boite));
    if (z && c) x.p = { ...x.p, capture: c.media ?? null, zone: enPourcent(z, c.boite), ancrage: "proposee" };
  });
  return pas.map((x) => x.p);
}

function blocDe(d: DiapositiveReleve, r: Releve, q: Qualification): { bloc: Bloc; q: Qualification } {
  const { largeur, hauteur } = r.deck;
  const titre = titreDe(d, hauteur);
  const pas = q.figure === "pas-a-pas" ? pasDe(d, largeur) : [];
  const consignes = pas.flatMap((p) => (p.consigne ? [normal(p.consigne)] : []));
  const textes = ordreDeLecture(
    d.formes.filter((f) => f !== titre && aCadreTexte(f as Forme) && !estDeService(f) && !estPastille(f as Forme)
      && texteDe(f as Forme) && !consignes.some((c) => normal(texteDe(f as Forme)).includes(c))),
    (f) => f.boite,
  ).map((f) => texteDe(f as Forme));
  const visuels: Visuel[] = ordreDeLecture(d.formes.filter((f) => f.nature === "image" && f.media), (f) => f.boite)
    .map((f) => ({ media: f.media!, capture: estCapture(f as Forme, largeur), ...(f.rognage ? { rognage: [...f.rognage] as [number, number, number, number] } : {}) }));
  const tableaux = d.formes.filter((f) => f.nature === "tableau").map((f) => (f.lignes ?? []).map((l) => [...l]));
  // Écartés du dessin : le titre, les espaces de service, un numéro de page saisi à la main en bas de diapositive.
  const numeroSaisi = (f: FormeReleve) => texteDe(f as Forme) === String(d.n) && f.boite[1] > hauteur * 0.85;
  const ecartees = new Set(d.formes.filter((f) => f === titre || estDeService(f) || numeroSaisi(f)));
  const schema = q.figure === "schema" ? dessinDe(d, ecartees) : undefined;
  const structure = TEXTUELLES.has(q.figure)
    ? structurer(
      d.formes.filter((f) => f !== titre && aCadreTexte(f as Forme) && !estDeService(f) && !estPastille(f as Forme) && texteDe(f as Forme)),
      d.formes.filter((f) => f.nature === "image" && f.media && !estCapture(f as Forme, largeur)),
      d.formes.filter((f) => estPastille(f as Forme)),
    )
    : null;
  const dessin = schema?.dessin;
  const bloc: Bloc = {
    id: `b${trois(d.n)}`,
    figure: q.figure,
    source: { diapo: d.n },
    ...(d.masquee ? { masquee: true as const } : {}),
    titre: titre ? texteDe(titre as Forme) : null,
    textes,
    visuels,
    tableaux,
    pas,
    ...(dessin ? { dessin } : {}),
    ...(structure ? { structure } : {}),
    notes: d.notes,
  };
  return { bloc, q: schema ? { ...q, projection: schema.projection } : q };
}

export interface Qualifie {
  readonly spec: SeanceSpec;
  /** Diapositive → la figure retenue et le signal qui l'a décidée (pour le rapport). */
  readonly qualifications: ReadonlyMap<number, Qualification>;
}

export function qualifierReleve(r: Releve): Qualifie {
  const qualifications = new Map<number, Qualification>();
  const sequences: Sequence[] = [];
  for (const d of r.diapositives) {
    const titre = titreDe(d, r.deck.hauteur);
    const { bloc, q } = blocDe(d, r, qualifierDiapo(d, r.deck.largeur, titre ? texteDe(titre as Forme) : null));
    qualifications.set(d.n, q);
    const courante = sequences[sequences.length - 1];
    if (!courante || q.figure === "transition") sequences.push({ id: `s${trois(d.n)}`, blocs: [bloc] });
    else courante.blocs.push(bloc);
  }
  return {
    spec: { schema: SCHEMA_SEANCE, source: { nom: r.deck.nom, empreinte: r.deck.empreinte }, sequences },
    qualifications,
  };
}

