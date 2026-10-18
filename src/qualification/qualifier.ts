// Relevé → pivot₀ (`seance-spec`) : un bloc par diapositive, des séquences coupées aux transitions, des pas en % de capture.
import type { Boite, Forme } from "../ooxml/formes";
import type { Releve, DiapositiveReleve, FormeReleve } from "../releve/releve";
import { POUCE, aCadreTexte, dedans, estCapture, estPastille, estZone, texteDe } from "../releve/geometrie";
import { SCHEMA_SEANCE, SeanceSpec, type Bloc, type Pas, type Sequence, type Visuel } from "../pivot/seance-spec";
import { dessinDe } from "./dessin";
import { roleDe } from "./roles";
import { textesDeStructure } from "../pivot/textes";
import { composerCas, composerTableau, harmoniser } from "./gabarits";
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

/** Seuils des visuels (points, proportions), réglés sur le deck acheteur (17/10). */
export const SEUILS_VISUELS = {
  /** Un logo : allongé, bas, dans le bandeau du haut. */
  logoRapport: 1.8, logoHauteur: 40, bandeau: 0.2,
  /** L'icône de la durée : petite et à peu près carrée, sur une diapositive qui dit des minutes. */
  dureeMax: 48,
  /** L'icône de section : petite, héritée de la disposition, dans le coin haut droit. */
  sectionMax: 72, coin: 0.8,
  /** Une légende : un texte qui commence sous le visuel (à tant de points au plus), centré sur lui (à tant près). */
  legendeEcart: 48, legendeCentre: 24,
} as const;

/** Les figures dont l'image principale est un pictogramme (un écran), pas une capture. */
const ECRANS: ReadonlySet<string> = new Set(["couverture", "ecran-animation", "demonstration", "transition", "renvoi"]);
const RASTER = /^(png|jpe?g|gif|bmp|tiff?|webp)$/;
const PT = 12700;

/**
 * Les visuels d'une diapositive (PKG-B6) : ses images et celles de sa disposition, hors logos ; chacune avec son rôle —
 * l'icône de la durée, l'icône de section, le pictogramme (la plus grande illustration d'un écran ou d'une disposition) —
 * et, sur un écran, la légende posée sous elle quand plusieurs images en portent une (une galerie : la météo).
 * Une capture est une image matricielle large, hors couverture et écrans d'animation : un pictogramme vectoriel n'en est pas une.
 */
function visuelsDe(d: DiapositiveReleve, r: Releve, figure: string, textes: readonly FormeReleve[]): { visuels: Visuel[]; legendes: Set<FormeReleve> } {
  const S = SEUILS_VISUELS;
  const { largeur, hauteur } = r.deck;
  const heritees = new Set(d.heritees ?? []);
  const images = ordreDeLecture([...d.formes, ...(d.heritees ?? [])].filter((f) => f.nature === "image" && f.media), (f) => f.boite);
  const pts = (v: number) => v / PT;
  const logo = (f: FormeReleve) => f.boite[2] / f.boite[3] >= S.logoRapport && pts(f.boite[3]) <= S.logoHauteur && f.boite[1] + f.boite[3] <= S.bandeau * hauteur;
  const minutes = textes.some((t) => /\b\d+\s*min/i.test(texteDe(t as Forme)));
  const ext = (f: FormeReleve) => r.medias[f.media!]?.ext ?? "";
  const role = (f: FormeReleve): Visuel["role"] => {
    const [x, y, w, h] = f.boite;
    if (minutes && pts(Math.max(w, h)) <= S.dureeMax && w / h >= 0.75 && w / h <= 1.33) return "duree";
    if (heritees.has(f) && pts(Math.max(w, h)) <= S.sectionMax && x >= S.coin * largeur && y <= S.bandeau * hauteur) return "section";
    return undefined;
  };
  const retenues = images.filter((f) => !logo(f));
  const capture = (f: FormeReleve) => estCapture(f as Forme, largeur) && RASTER.test(ext(f)) && figure !== "couverture" && figure !== "ecran-animation";
  const roles = new Map(retenues.map((f) => [f, role(f)]));
  // Une galerie : sur un écran, plusieurs images légendées par le texte posé sous chacune.
  const legendes = new Map<FormeReleve, FormeReleve>();
  if (ECRANS.has(figure)) {
    const pris = new Set<FormeReleve>();
    for (const f of retenues.filter((x) => !roles.get(x))) {
      const [x, y, w, h] = f.boite;
      const t = textes.filter((t) => !pris.has(t) && t.boite[1] >= y + h - 4 * PT && t.boite[1] <= y + h + S.legendeEcart * PT
        && Math.abs(t.boite[0] + t.boite[2] / 2 - (x + w / 2)) <= S.legendeCentre * PT)
        .sort((a, b) => a.boite[1] - b.boite[1])[0];
      if (t) { legendes.set(f, t); pris.add(t); }
    }
    if (legendes.size < 2) legendes.clear();
  }
  // Le pictogramme : sur un écran, la plus grande image (hors galerie) ; ailleurs, la plus grande illustration héritée.
  const candidates = retenues.filter((f) => !roles.get(f) && !capture(f) && !legendes.has(f) && (ECRANS.has(figure) ? figure !== "couverture" : heritees.has(f)));
  const picto = [...candidates].sort((a, b) => b.boite[2] * b.boite[3] - a.boite[2] * a.boite[3])[0];
  if (picto && !legendes.size) roles.set(picto, "pictogramme");
  // L'aplat d'un pictogramme ou d'une icône de section : la plus petite forme pleine, sans texte, qui le contient.
  const aplats = [...d.formes, ...(d.heritees ?? [])].filter((f) => f.nature !== "image" && !texteDe(f as Forme)
    && f.style?.fond && f.style.fond !== "aucun" && (f.style.fond.alpha ?? 100000) >= 50000);
  const fondDe = (f: FormeReleve) => {
    const c: [number, number] = [f.boite[0] + f.boite[2] / 2, f.boite[1] + f.boite[3] / 2];
    const a = aplats.filter((x) => x.boite[2] * x.boite[3] >= 0.8 * f.boite[2] * f.boite[3]
      && c[0] >= x.boite[0] && c[0] <= x.boite[0] + x.boite[2] && c[1] >= x.boite[1] && c[1] <= x.boite[1] + x.boite[3])
      .sort((x, y) => x.boite[2] * x.boite[3] - y.boite[2] * y.boite[3])[0];
    return a?.style?.fond && a.style.fond !== "aucun" ? roleDe(a.style.fond) : undefined;
  };
  return {
    visuels: retenues.map((f) => {
      const ro = roles.get(f);
      const l = legendes.get(f);
      const fond = ro === "pictogramme" || ro === "section" ? fondDe(f) : undefined;
      return {
        media: f.media!, capture: capture(f),
        ...(f.rognage ? { rognage: [...f.rognage] as [number, number, number, number] } : {}),
        ...(ro ? { role: ro } : {}),
        ...(l ? { legende: texteDe(l as Forme) } : {}),
        ...(fond ? { fond } : {}),
      };
    }),
    legendes: new Set(legendes.values()),
  };
}

function blocDe(d: DiapositiveReleve, r: Releve, q: Qualification): { bloc: Bloc; q: Qualification } {
  const { largeur, hauteur } = r.deck;
  const titre = titreDe(d, hauteur);
  const pas = q.figure === "pas-a-pas" ? pasDe(d, largeur) : [];
  const consignes = pas.flatMap((p) => (p.consigne ? [normal(p.consigne)] : []));
  // Les textes de la diapositive et ceux de sa disposition (« Pause », les libellés d'une météo), hors numéro de page.
  const dansLaDiapo = (f: FormeReleve) => f.boite[1] + f.boite[3] > 0 && f.boite[1] < hauteur && f.boite[0] + f.boite[2] > 0 && f.boite[0] < largeur;
  const candidats = [
    ...d.formes,
    ...(d.heritees ?? []).filter((f) => dansLaDiapo(f) && !/^‹N°›$/.test(texteDe(f as Forme))),
  ].filter((f) => f !== titre && aCadreTexte(f as Forme) && !estDeService(f) && !estPastille(f as Forme)
    && texteDe(f as Forme) && !consignes.some((c) => normal(texteDe(f as Forme)).includes(c)));
  const { visuels, legendes } = visuelsDe(d, r, q.figure, candidats);
  const textes = ordreDeLecture(candidats.filter((f) => !legendes.has(f)), (f) => f.boite).map((f) => texteDe(f as Forme));
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
  // Un tableau s'harmonise sur sa légende ; ce qui change est tracé au rapport.
  const lue = dessin ? composerCas(dessin) ?? composerTableau(dessin) : null;
  const { composition, harmonisations } = lue ? harmoniser(lue) : { composition: null, harmonisations: [] };
  const bloc: Bloc = {
    id: `b${trois(d.n)}`,
    figure: q.figure,
    source: { diapo: d.n },
    ...(d.masquee ? { masquee: true as const } : {}),
    titre: titre ? texteDe(titre as Forme) : null,
    // Un texte organisé : son inventaire se dérive de sa structure (le même calcul que la lecture du PPT de validation).
    textes: structure ? textesDeStructure(structure) : textes,
    visuels,
    tableaux,
    pas,
    ...(dessin ? { dessin } : {}),
    ...(structure ? { structure } : {}),
    ...(composition ? { composition } : {}),
    notes: d.notes,
  };
  return { bloc, q: schema ? { ...q, projection: schema.projection, ...(harmonisations.length ? { harmonisations } : {}) } : q };
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
    // Le pivot sort normalisé par son schéma (ordre des clés compris) : lu dans le PPT de validation, il a le même hash.
    spec: SeanceSpec.parse({ schema: SCHEMA_SEANCE, source: { nom: r.deck.nom, empreinte: r.deck.empreinte }, sequences }),
    qualifications,
  };
}

