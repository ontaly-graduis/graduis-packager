// Les lectures étendues d'un deck (`graduis/lectures@0`), à côté du relevé : SmartArt, graphiques natifs, ordre des animations,
// paires question → réponse, empreinte du gabarit. Hors de la chaîne : seul le tableau comparé du corpus les lit (GEN-0).
import type { Element } from "@xmldom/xmldom";
import { sha256, stringify2 } from "../lib/json";
import type { Boite, Forme } from "../ooxml/formes";
import { NS, Paquet, chemin, elementsEnfants, enfant, enfants, entier } from "../ooxml/paquet";
import { texteDe } from "../releve/geometrie";
import type { DiapositiveReleve, Releve } from "../releve/releve";
import { estDeService } from "../qualification/figures";
import { ordreDeLecture } from "../qualification/qualifier";

export const SCHEMA_LECTURES = "graduis/lectures@0";

const DGM = "http://schemas.openxmlformats.org/drawingml/2006/diagram";
const CHART = "http://schemas.openxmlformats.org/drawingml/2006/chart";

/** Un SmartArt : sa disposition (le dernier segment de son `uniqueId`), ses nœuds porteurs de texte, sa profondeur. */
export interface SmartArt {
  readonly disposition: string;
  readonly noeuds: number;
  readonly profondeur: number;
}

/** Un graphique natif : son type, ses séries, ses catégories, et si ses valeurs sont dans le fichier. */
export interface Graphique {
  readonly type: string;
  readonly series: number;
  readonly categories: number;
  readonly donnees: boolean;
}

/**
 * Les animations d'une diapositive (séquence principale) : clics, effets, et le dévoilement qu'elles disent — le nombre de
 * temps où des formes entrent ; s'il suit l'ordre de lecture (`null` : une cible introuvable au relevé).
 */
export interface Animation {
  readonly clics: number;
  readonly effets: number;
  readonly devoilement: number;
  readonly selonLaLecture: boolean | null;
}

export interface LectureDiapo {
  readonly n: number;
  readonly smartart?: readonly SmartArt[];
  readonly graphiques?: readonly Graphique[];
  readonly animation?: Animation;
}

/** Deux diapositives consécutives, d'une même disposition, dont la seconde reprend tout le texte de la première et en dit plus. */
export interface Paire {
  readonly question: number;
  readonly reponse: number;
  /** La première pose une question (« ? ») : une paire question → réponse ; sinon, un dévoilement par duplication. */
  readonly interrogative: boolean;
}

export interface Lectures {
  readonly schema: typeof SCHEMA_LECTURES;
  readonly deck: { readonly nom: string; readonly empreinte: string };
  /**
   * Le gabarit : l'empreinte de ses masques, dispositions, couleurs et polices (spec § 4.3), son thème, les noms de ses
   * dispositions et les empreintes des images que dessinent ses masques et ses dispositions (son identité visuelle).
   */
  readonly gabarit: { readonly empreinte: string; readonly theme: string; readonly dispositions: readonly string[]; readonly images: readonly string[] };
  readonly diapositives: readonly LectureDiapo[];
  readonly paires: readonly Paire[];
}

const dernier = (uri: string) => uri.split("/").pop() ?? "";
const descendants = (el: Element, ns: string, local: string) => Array.from(el.getElementsByTagNameNS(ns, local)) as Element[];

function smartartsDe(paquet: Paquet, diapo: string): SmartArt[] {
  const rels = new Map(paquet.relations(diapo).map((r) => [r.id, r.cible]));
  return descendants(paquet.racine(diapo), DGM, "relIds").flatMap((ids): SmartArt[] => {
    const donnees = rels.get(ids.getAttributeNS(NS.r, "dm") ?? "");
    const disposition = rels.get(ids.getAttributeNS(NS.r, "lo") ?? "");
    if (!donnees || !paquet.octets(donnees)) return [];
    const modele = paquet.racine(donnees);
    const points = descendants(modele, DGM, "pt");
    const types = new Map(points.map((p) => [p.getAttribute("modelId") ?? "", p.getAttribute("type") || "node"]));
    const porteurs = points.filter((p) => (p.getAttribute("type") || "node") === "node"
      && descendants(p, NS.a, "t").some((t) => (t.textContent ?? "").trim()));
    // La hiérarchie : les liens `parOf` (le type par défaut) du document vers ses nœuds.
    const enfantsDe = new Map<string, string[]>();
    for (const c of descendants(modele, DGM, "cxn")) {
      if ((c.getAttribute("type") || "parOf") !== "parOf") continue;
      const src = c.getAttribute("srcId") ?? "";
      enfantsDe.set(src, [...(enfantsDe.get(src) ?? []), c.getAttribute("destId") ?? ""]);
    }
    const profondeur = (id: string, vus: Set<string>): number => {
      if (vus.has(id)) return 0;
      vus.add(id);
      const e = (enfantsDe.get(id) ?? []).filter((x) => types.get(x) === "node");
      return e.length ? 1 + Math.max(...e.map((x) => profondeur(x, vus))) : 0;
    };
    const racine = points.find((p) => p.getAttribute("type") === "doc")?.getAttribute("modelId") ?? "";
    const uid = disposition && paquet.octets(disposition) ? paquet.racine(disposition).getAttribute("uniqueId") ?? "" : "";
    return [{ disposition: dernier(uid), noeuds: porteurs.length, profondeur: profondeur(racine, new Set()) }];
  });
}

function graphiquesDe(paquet: Paquet, diapo: string): Graphique[] {
  const rels = new Map(paquet.relations(diapo).map((r) => [r.id, r.cible]));
  return descendants(paquet.racine(diapo), CHART, "chart").flatMap((c): Graphique[] => {
    const partie = rels.get(c.getAttributeNS(NS.r, "id") ?? "");
    if (!partie || !paquet.octets(partie)) return [];
    const zone = descendants(paquet.racine(partie), CHART, "plotArea")[0];
    const traces = zone ? elementsEnfants(zone).filter((e) => e.namespaceURI === CHART && /Chart$/.test(e.localName ?? "")) : [];
    const series = traces.flatMap((t) => enfants(t, CHART, "ser"));
    const categories = Math.max(0, ...series.flatMap((s) => descendants(s, CHART, "cat").flatMap((k) => descendants(k, CHART, "ptCount")))
      .map((p) => entier(p, "val") ?? 0));
    return [{
      type: traces.map((t) => (t.localName ?? "").replace(/Chart$/, "")).join("+") || "inconnu",
      series: series.length,
      categories,
      donnees: series.some((s) => descendants(s, CHART, "numCache").some((n) => descendants(n, CHART, "pt").length > 0)),
    }];
  });
}

/** La boîte d'une cible d'animation au relevé : la forme de cet id, ou l'union des formes du groupe de cet id. */
function boiteDeCible(d: DiapositiveReleve, spid: number): Boite | null {
  const formes = d.formes.filter((f) => f.id === spid || f.groupe === spid);
  if (!formes.length) return null;
  const x = Math.min(...formes.map((f) => f.boite[0]));
  const y = Math.min(...formes.map((f) => f.boite[1]));
  return [x, y, Math.max(...formes.map((f) => f.boite[0] + f.boite[2])) - x, Math.max(...formes.map((f) => f.boite[1] + f.boite[3])) - y];
}

function animationDe(paquet: Paquet, diapo: string, d: DiapositiveReleve): Animation | undefined {
  const timing = enfant(paquet.racine(diapo), NS.p, "timing");
  const principale = timing && descendants(timing, NS.p, "cTn").find((c) => c.getAttribute("nodeType") === "mainSeq");
  if (!principale) return undefined;
  const effets = descendants(principale, NS.p, "cTn").filter((c) => c.hasAttribute("presetClass"));
  if (!effets.length) return undefined;
  // Un temps commence à chaque clic ; les effets d'avant le premier clic sont au temps 0 (à l'apparition de la diapositive).
  let temps = 0;
  const entrees = new Map<number, number>();
  for (const e of effets) {
    if (e.getAttribute("nodeType") === "clickEffect") temps++;
    const spid = entier(descendants(e, NS.p, "spTgt")[0], "spid");
    if (e.getAttribute("presetClass") === "entr" && spid !== null && !entrees.has(spid)) entrees.set(spid, temps);
  }
  const boites = [...entrees].map(([spid, t]) => ({ t, boite: boiteDeCible(d, spid) }));
  const lues = boites.every((b) => b.boite) ? ordreDeLecture(boites, (b) => b.boite!) : null;
  return {
    clics: effets.filter((e) => e.getAttribute("nodeType") === "clickEffect").length,
    effets: effets.length,
    devoilement: new Set(entrees.values()).size,
    selonLaLecture: lues ? lues.every((b, i) => i === 0 || lues[i - 1]!.t <= b.t) : null,
  };
}

const normal = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** Les textes d'une diapositive, normalisés, hors espaces de service et numéros saisis. */
function textesDe(d: DiapositiveReleve): Set<string> {
  return new Set(d.formes.filter((f) => !estDeService(f)).flatMap((f) => [
    ...(f.texte ? [texteDe(f as Forme)] : []),
    ...(f.lignes ?? []).flat(),
  ]).map(normal).filter((t) => t && !/^\d+$/.test(t)));
}

function pairesDe(r: Releve): Paire[] {
  const textes = r.diapositives.map(textesDe);
  return r.diapositives.slice(0, -1).flatMap((d, i): Paire[] => {
    // Un intercalaire suivi du contenu qui reprend son titre n'est pas un dévoilement : la disposition change (mesuré, GEN-0).
    if (d.disposition !== r.diapositives[i + 1]!.disposition) return [];
    const a = textes[i]!;
    const b = textes[i + 1]!;
    // Le texte d'une forme qu'on complète (la réponse écrite sous la question, dans la même forme) compte comme repris.
    const reprise = (t: string) => b.has(t) || [...b].some((x) => x.startsWith(t));
    const plus = [...b].join(" ").length > [...a].join(" ").length;
    if (!a.size || !plus || ![...a].every(reprise)) return [];
    return [{ question: d.n, reponse: d.n + 1, interrogative: [...a].some((t) => t.includes("?")) }];
  });
}

/** Le gabarit : masques, dispositions (nom, espaces réservés et leur boîte), couleurs et polices du thème de chaque masque. */
function gabaritDe(paquet: Paquet): Lectures["gabarit"] {
  const pres = "ppt/presentation.xml";
  const rels = new Map(paquet.relations(pres).map((r) => [r.id, r.cible]));
  const liste = chemin(paquet.racine(pres), ["p:sldMasterIdLst"]);
  const masques = (liste ? enfants(liste, NS.p, "sldMasterId") : []).flatMap((m) => {
    const partie = rels.get(m.getAttributeNS(NS.r, "id") ?? "");
    return partie ? [partie] : [];
  });
  const themes: string[] = [];
  const dispositions = new Set<string>();
  const images = new Set<string>();
  const imagesDe = (partie: string) => {
    for (const r of paquet.relations(partie)) {
      const o = r.type === "image" && !r.externe ? paquet.octets(r.cible) : undefined;
      if (o) images.add(sha256(o));
    }
  };
  const description = masques.map((masque) => {
    imagesDe(masque);
    const relsMasque = new Map(paquet.relations(masque).map((r) => [r.id, r.cible]));
    const ids = chemin(paquet.racine(masque), ["p:sldLayoutIdLst"]);
    const disp = (ids ? enfants(ids, NS.p, "sldLayoutId") : []).flatMap((l) => {
      const partie = relsMasque.get(l.getAttributeNS(NS.r, "id") ?? "");
      if (!partie || !paquet.octets(partie)) return [];
      const cSld = chemin(paquet.racine(partie), ["p:cSld"]);
      const nom = cSld?.getAttribute("name") ?? "";
      dispositions.add(nom);
      imagesDe(partie);
      const arbre = cSld && enfant(cSld, NS.p, "spTree");
      const espaces = (arbre ? descendants(arbre, NS.p, "ph") : []).map((ph) => {
        const sp = ph.parentNode?.parentNode?.parentNode as Element | null;
        const xfrm = sp ? chemin(sp, ["p:spPr", "a:xfrm"]) : undefined;
        const off = xfrm && enfant(xfrm, NS.a, "off");
        const ext = xfrm && enfant(xfrm, NS.a, "ext");
        return [ph.getAttribute("type") || "obj", entier(ph, "idx") ?? 0,
          ...(off && ext ? [entier(off, "x") ?? 0, entier(off, "y") ?? 0, entier(ext, "cx") ?? 0, entier(ext, "cy") ?? 0] : [])];
      });
      return [{ nom, espaces }];
    });
    const partieTheme = paquet.relation(masque, "theme")?.cible;
    const theme = partieTheme && paquet.octets(partieTheme) ? paquet.racine(partieTheme) : undefined;
    themes.push(theme?.getAttribute("name") ?? "");
    const schema = theme && descendants(theme, NS.a, "clrScheme")[0];
    const couleurs = schema ? elementsEnfants(schema).map((c) => {
      const v = elementsEnfants(c)[0];
      return `${c.localName}:${v?.getAttribute("val") ?? ""}${v?.getAttribute("lastClr") ? `/${v.getAttribute("lastClr")}` : ""}`;
    }) : [];
    const police = (nom: string) => (theme && descendants(theme, NS.a, nom)[0]
      ? enfant(descendants(theme, NS.a, nom)[0]!, NS.a, "latin")?.getAttribute("typeface") ?? "" : "");
    return { dispositions: disp, couleurs, polices: [police("majorFont"), police("minorFont")] };
  });
  return {
    empreinte: sha256(stringify2({ taille: paquet.taille(), masques: description })),
    theme: themes[0] ?? "",
    dispositions: [...dispositions].sort(),
    images: [...images].sort(),
  };
}

export function lireEtendu(octets: Uint8Array, r: Releve): Lectures {
  const paquet = new Paquet(octets);
  const parN = new Map(r.diapositives.map((d) => [d.n, d]));
  const diapositives = paquet.diapositives().flatMap(({ n, chemin: partie }): LectureDiapo[] => {
    const d = parN.get(n)!;
    const smartart = smartartsDe(paquet, partie);
    const graphiques = graphiquesDe(paquet, partie);
    const animation = animationDe(paquet, partie, d);
    if (!smartart.length && !graphiques.length && !animation) return [];
    return [{ n, ...(smartart.length ? { smartart } : {}), ...(graphiques.length ? { graphiques } : {}), ...(animation ? { animation } : {}) }];
  });
  return {
    schema: SCHEMA_LECTURES,
    deck: { nom: r.deck.nom, empreinte: r.deck.empreinte },
    gabarit: gabaritDe(paquet),
    diapositives,
    paires: pairesDe(r),
  };
}
