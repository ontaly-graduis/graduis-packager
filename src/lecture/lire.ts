// `lire` : PPT de validation → pivot (PKG-C). La lecture grammaticale, déterministe : la disposition dit la figure, les
// espaces réservés le titre, les textes et les consignes ; les formes nommées les pas ; les étiquettes l'identité du bloc.
// Rien ne se devine (P2) : ce qui sort de la grammaire est un écart, signalé.
import { strFromU8 } from "fflate";
import { DOMParser, type Element } from "@xmldom/xmldom";
import { sha256 } from "../lib/json";
import { formesDeDiapositive, type Forme } from "../ooxml/formes";
import { Paquet } from "../ooxml/paquet";
import { DERIVATION, DERIVATIONS, SCHEMA_SEANCE, SeanceSpec, blocsDe, type Activite, type Bloc, type Derivation, type Geste, type Pas, type Sequence, type Visuel } from "../pivot/seance-spec";
import {
  ESPACES, ETIQUETTES, NOMS, PROPRIETES, ROLES_DE_COULEUR, ancrageDeZone, couleurDeRole, empreinteDesTextes, figureDeDisposition, gesteDeDisposition,
  partitionDeNom, roleDeVisuel, type TextesDActivite,
} from "../emission/grammaire";
import { DUREES_GRADUIS, type Durees } from "../diagnostic/regles";
import { deriver, derivationDe } from "../activites/deriver";
import { lireDuree } from "../activites/habillage";
import { idDActivite } from "../activites/proposer";
import { lireCouleur, paletteDuMasque } from "../ooxml/couleurs";
import { NS, chemin, elementsEnfants } from "../ooxml/paquet";
import { stylesDuMasque } from "../ooxml/styles";
import { inventaireDeSchema } from "../pivot/textes";
import type { Composition, Dessin } from "../pivot/seance-spec";
import { lireElement, lireElements, lireGrille, lireGroupe, repereDeGroupe, versGroupe, type LecteurDeDessin } from "./dessin";
import { lireComposition } from "./composition";
import { roleDe } from "../qualification/roles";
import { structurer } from "../qualification/structure";
import { qualifierReleve } from "../qualification/qualifier";
import type { ProfilSource } from "../profil/profil";
import { relever, type FormeReleve } from "../releve/releve";
import { textesDeStructure } from "../pivot/textes";
import { lireStructure } from "./structure";
import type { Role } from "../pivot/seance-spec";

export interface Ecart {
  readonly diapo: number;
  readonly message: string;
}

type Boite = readonly [number, number, number, number];
const centre = (b: Boite): [number, number] => [b[0] + b[2] / 2, b[1] + b[3] / 2];
const dedans = (p: readonly [number, number], b: Boite) => p[0] >= b[0] && p[0] <= b[0] + b[2] && p[1] >= b[1] && p[1] <= b[1] + b[3];
const centieme = (v: number) => Math.round(v * 100) / 100 + 0;
const trois = (n: number) => String(n).padStart(3, "0");
/** Les figures de texte, que l'heuristique organise (comme à la qualification). */
const TEXTUELLES: ReadonlySet<string> = new Set(["contenu", "objectifs", "synthese", "etapes-cles"]);
/** Une pastille va à la zone dont le coin est à moins d'un demi-pouce. */
const PORTEE = 457200;

function xml(octets: Uint8Array): Element {
  const doc = new DOMParser().parseFromString(strFromU8(octets), "text/xml");
  if (!doc.documentElement) throw new Error("partie XML vide");
  return doc.documentElement;
}

/** Les étiquettes d'une diapositive (noms en capitales, comme PowerPoint les écrit). */
function etiquettes(p: Paquet, diapo: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of p.relations(diapo).filter((x) => x.type === "tags")) {
    const o = p.octets(r.cible);
    if (!o) continue;
    for (const t of Array.from(xml(o).getElementsByTagNameNS("http://schemas.openxmlformats.org/presentationml/2006/main", "tag"))) {
      out.set((t.getAttribute("name") ?? "").toUpperCase(), t.getAttribute("val") ?? "");
    }
  }
  return out;
}

/** Les propriétés personnalisées du document. */
function proprietes(p: Paquet): Map<string, string> {
  const out = new Map<string, string>();
  const o = p.octets("docProps/custom.xml");
  if (!o) return out;
  for (const e of Array.from(xml(o).getElementsByTagName("property"))) {
    out.set(e.getAttribute("name") ?? "", e.textContent ?? "");
  }
  return out;
}

const texteDe = (f: Forme) => (f.texte ?? []).join("\n").trim();
const espace = (formes: readonly Forme[], idx: number) => formes.find((f) => f.espace && f.espace.idx === idx && f.espace.type !== "title");

/** Les pas : chaque pastille, la zone dont elle touche le coin, la capture sous la zone (ou sous la pastille), la consigne de son rang. */
function pasDe(formes: readonly Forme[], hashDe: (f: Forme) => string | undefined, ecart: (m: string) => void): Pas[] {
  const pastilles = formes.filter((f) => f.nom.startsWith(NOMS.pastille));
  const zones = formes.filter((f) => f.nom.startsWith(NOMS.zone));
  const images = formes.filter((f) => f.nature === "image" && f.media);
  const paires = pastilles.flatMap((p) => zones.map((z) => ({ p, z, d: Math.hypot(centre(p.boite)[0] - z.boite[0], centre(p.boite)[1] - z.boite[1]) })))
    .filter((x) => x.d <= PORTEE).sort((a, b) => a.d - b.d);
  const zoneDe = new Map<Forme, Forme>();
  const prises = new Set<Forme>();
  for (const { p, z } of paires) if (!zoneDe.has(p) && !prises.has(z)) { zoneDe.set(p, z); prises.add(z); }
  for (const z of zones) if (!prises.has(z)) ecart(`une zone sans pastille (« ${z.nom} ») est ignorée`);
  const consignes = espace(formes, ESPACES.consignes)?.texte ?? [];
  const pas = pastilles.map((p) => {
    const numero = Number.parseInt(texteDe(p), 10);
    if (!Number.isFinite(numero)) ecart(`une pastille sans numéro (« ${texteDe(p)} »)`);
    const z = zoneDe.get(p);
    const point = z ? centre(z.boite) : centre(p.boite);
    const image = images.find((i) => dedans(point, i.boite));
    const zone = z && image
      ? [centieme(((z.boite[0] - image.boite[0]) / image.boite[2]) * 100), centieme(((z.boite[1] - image.boite[1]) / image.boite[3]) * 100),
        centieme((z.boite[2] / image.boite[2]) * 100), centieme((z.boite[3] / image.boite[3]) * 100)] as [number, number, number, number]
      : null;
    return { numero, capture: image ? hashDe(image) ?? null : null, zone, ancrage: zone ? ancrageDeZone(z!.nom) : null };
  }).sort((a, b) => a.numero - b.numero);
  if (consignes.length > pas.length && consignes.slice(pas.length).some((c) => c.trim())) ecart(`${consignes.length - pas.length} consignes de plus que de pastilles`);
  return pas.map((p, k) => ({ ...p, consigne: consignes[k]?.trim() ? consignes[k]! : null }));
}

/**
 * Le rôle d'une couleur de remplissage : celui dont la couleur du thème (émise par la grammaire) donne ce RVB dans le
 * thème du paquet ; une autre couleur (choisie dans PowerPoint) va au rôle le plus proche, par la projection du profil.
 */
const parPaquet = new WeakMap<Paquet, Map<string, (rgb: string) => Role>>();
function rolesDeCouleur(p: Paquet, diapo: string, profil: ProfilSource): (rgb: string) => Role {
  const masque = p.masqueDe(p.disposition(diapo)?.chemin ?? "") ?? "";
  let parMasque = parPaquet.get(p);
  if (!parMasque) { parMasque = new Map(); parPaquet.set(p, parMasque); }
  let f = parMasque.get(masque);
  if (!f) {
    const palette = paletteDuMasque(p, masque || undefined);
    const table = new Map<string, Role>();
    for (const r of ROLES_DE_COULEUR) {
      const el = new DOMParser().parseFromString(`<a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${couleurDeRole(r)}</a:solidFill>`, "text/xml").documentElement!;
      const c = lireCouleur(el.firstChild as Element, palette);
      if (c && !table.has(c.rgb.toUpperCase())) table.set(c.rgb.toUpperCase(), r);
    }
    f = (rgb) => table.get(rgb.toUpperCase()) ?? roleDe({ rgb }, profil.projection);
    parMasque.set(masque, f);
  }
  return f;
}

/** Ce qu'il faut pour relire les formes d'une diapositive : thème, couleurs proches, médias. */
function lecteurDe(p: Paquet, diapo: string, profil: ProfilSource): LecteurDeDessin {
  const masque = p.masqueDe(p.disposition(diapo)?.chemin ?? "");
  const st = stylesDuMasque(p, masque);
  const proche = rolesDeCouleur(p, diapo, profil);
  const rels = new Map(p.relations(diapo).filter((r) => r.type === "image").map((r) => [r.id, r.cible]));
  const hashs = new Map<string, string | undefined>();
  return {
    roleProche: (el) => { const c = lireCouleur(el, st.palette); return c ? proche(c.rgb) : undefined; },
    media: (rId) => {
      if (!hashs.has(rId)) { const c = rels.get(rId); const o = c ? p.octets(c) : undefined; hashs.set(rId, o ? sha256(o) : undefined); }
      return hashs.get(rId);
    },
    polices: st.polices,
    largeurs: st.largeurs,
  };
}

const nomDeForme = (el: Element) => chemin(el, [`p:${({ sp: "nvSpPr", pic: "nvPicPr", cxnSp: "nvCxnSpPr", grpSp: "nvGrpSpPr", graphicFrame: "nvGraphicFramePr" } as Record<string, string>)[el.localName ?? ""] ?? "nvSpPr"}`, "p:cNvPr"]);
const estEspaceReserve = (el: Element) => el.getElementsByTagNameNS(NS.p, "ph").length > 0;

interface SchemaLu {
  readonly dessin?: Dessin;
  readonly composition?: Composition;
  /** Les identifiants des formes lues ici (groupes de la grammaire, formes ajoutées par le client) : le reste de la lecture les ignore. */
  readonly prises: ReadonlySet<number>;
}

/**
 * Le schéma d'une diapositive (PKG-C3) : le dessin du groupe « G·schéma » et ses tableaux, ou la composition posée en
 * formes. Ce que le client ajoute sur un dessin y entre (dans son repère) ; sur une composition, il est signalé et laissé.
 */
function schemaDe(arbre: Element, l: LecteurDeDessin, ecart: (m: string) => void): SchemaLu | null {
  const enfants = elementsEnfants(arbre).filter((e) => e.namespaceURI === NS.p && ["sp", "pic", "cxnSp", "grpSp", "graphicFrame"].includes(e.localName ?? ""));
  const nom = (e: Element) => nomDeForme(e)?.getAttribute("name") ?? "";
  const id = (e: Element) => Number(nomDeForme(e)?.getAttribute("id") || 0);
  const grilles = enfants.filter((e) => e.localName === "graphicFrame" && nom(e).startsWith(NOMS.grille));
  const prises = new Set<number>();
  const libres = enfants.filter((e) => !nom(e).startsWith("G·") && !estEspaceReserve(e));
  const groupe = enfants.find((e) => e.localName === "grpSp" && nom(e).startsWith(NOMS.schema));
  if (groupe) {
    const des = grilles.filter((t) => nom(t).startsWith(`${NOMS.grille} · schéma ·`));
    for (const e of [groupe, ...des]) prises.add(id(e));
    const { cadre, elements } = lireGroupe(groupe, des, l);
    const g = repereDeGroupe(groupe);
    if (g && libres.length) {
      const inverse = versGroupe(g);
      const rang = enfants.indexOf(groupe);
      const avant: typeof elements = [];
      for (const e of libres) {
        const gg = e.localName === "grpSp" ? repereDeGroupe(e) : undefined;
        const lus = gg ? lireElements(e, l, (b) => inverse.repere(gg.repere(b)))
          : [e.localName === "graphicFrame" ? lireGrille(e, l, inverse.repere, inverse.s) : lireElement(e, l, inverse.repere)].filter((x) => x !== null);
        if (!lus.length) continue;
        prises.add(id(e));
        (enfants.indexOf(e) < rang ? avant : elements).push(...lus);
      }
      elements.unshift(...avant);
      ecart(`${libres.length} forme(s) ajoutée(s) sur le schéma : reprise(s) dans son dessin (${libres.map((e) => `« ${nom(e)} »`).join(", ")})`);
    }
    const partition = partitionDeNom(nom(groupe));
    return { dessin: { cadre, elements, ...(partition ? { partition } : {}) }, prises };
  }
  const lue = lireComposition(arbre, grilles, l);
  if (!lue) return null;
  const DE_COMPOSITION = [NOMS.cas, NOMS.etape, NOMS.phase, NOMS.couloir, NOMS.signal, NOMS.legende, NOMS.decor, NOMS.signe, NOMS.illustration, NOMS.grille];
  for (const e of enfants) if (DE_COMPOSITION.some((p) => nom(e).startsWith(p))) prises.add(id(e));
  for (const m of lue.ecarts) ecart(m);
  if (libres.length) {
    for (const e of libres) prises.add(id(e));
    ecart(`${libres.length} forme(s) hors grammaire sur une composition, laissée(s) de côté : une composition se modifie dans ses formes (${libres.map((e) => `« ${nom(e)} »`).join(", ")})`);
  }
  return { composition: lue.composition, prises };
}

/** Une diapositive d'activité telle que lue : ce que disent sa disposition, ses étiquettes, sa durée et ce qu'elle montre. */
interface ActiviteLue {
  readonly n: number;
  /** Le nombre de blocs lus avant elle : elle se place juste après le dernier. */
  readonly avant: number;
  readonly geste: Geste;
  readonly id: string | undefined;
  readonly derive: string | undefined;
  readonly derivation: string | undefined;
  readonly empreinte: string | undefined;
  readonly duree: string | null;
  readonly montre: TextesDActivite;
  readonly captures: readonly string[];
}

/** Ce qu'une diapositive d'activité montre : ses textes à leur place dans la grammaire, ses captures. */
function montreDActivite(formes: readonly Forme[], notes: string, hashDe: (f: Forme) => string | undefined): { montre: TextesDActivite; captures: string[] } {
  const nommee = (nom: string) => formes.find((f) => f.nom.startsWith(nom));
  const paragraphesDe = (f: Forme | undefined) => (f?.texte ?? []).filter((t) => t.trim() !== "");
  const titre = formes.find((f) => f.espace?.type === "title" || f.espace?.type === "ctrTitle");
  const colonnes = formes.find((f) => f.nature === "tableau" && f.nom.startsWith(NOMS.colonnes));
  return {
    montre: {
      titre: titre ? texteDe(titre) : "",
      consigne: nommee(NOMS.consigne) ? texteDe(nommee(NOMS.consigne)!) : "",
      contenu: paragraphesDe(espace(formes, ESPACES.contenu)),
      consignes: paragraphesDe(espace(formes, ESPACES.consignes)),
      colonnes: colonnes?.lignes?.[0] ? [...colonnes.lignes[0]] : [],
      source: nommee(NOMS.source) ? texteDe(nommee(NOMS.source)!) : "",
      notes,
    },
    captures: formes.filter((f) => f.nature === "image" && f.media && f.nom.startsWith(NOMS.capture)).map((f) => hashDe(f)!).filter(Boolean),
  };
}

/**
 * Une activité lue rejoint le pivot si sa source s'y trouve et s'y prête : la source est celle que dit son étiquette, ou —
 * ajoutée à la main — le bloc qui la précède ; la dérivation, celle que le geste tire de la figure source. Ce qu'elle montre
 * dérive de sa source : une retouche dans PowerPoint (l'empreinte émise ne correspond plus) est signalée, non reprise.
 */
function resoudreActivite(a: ActiviteLue, blocs: readonly Bloc[], durees: Durees, pris: Set<string>, ecart: (m: string) => void): Activite | null {
  const source = a.derive ? blocs.find((b) => b.id === a.derive) : blocs[a.avant - 1];
  if (!source) {
    ecart(a.derive ? `activité dont la source (${a.derive}) n'est plus au PPT : retirée` : "activité ajoutée sans diapositive qui la précède : ignorée");
    return null;
  }
  const etiquetee = DERIVATIONS.find((d) => d === a.derivation);
  const derivation: Derivation | undefined = etiquetee && DERIVATION[etiquetee].geste === a.geste && DERIVATION[etiquetee].source === source.figure ? etiquetee : derivationDe(a.geste, source.figure);
  if (!derivation) {
    ecart(`aucune activité ne se dérive d'une diapositive « ${source.figure} » (${source.id}) par le geste « ${a.geste} » : diapositive ignorée`);
    return null;
  }
  if (!deriver({ derivation, derive_de: source.id }, source)) {
    ecart(`la diapositive ${source.id} ne se prête pas à l'activité « ${derivation} » (rien à y prendre sans inventer) : diapositive ignorée`);
    return null;
  }
  if (!a.derive) ecart(`activité ajoutée : « ${derivation} », dérivée de la diapositive qui la précède (${source.id})`);
  if (a.empreinte ? empreinteDesTextes(a.montre, a.captures) !== a.empreinte : [...Object.values(a.montre)].some((v) => (Array.isArray(v) ? v.length > 0 : v !== ""))) {
    ecart(`le contenu d'une activité ne se retouche pas dans PowerPoint : il dérive de ${source.id} — retouche non reprise (modifier la source)`);
  }
  const lue = a.duree === null ? null : lireDuree(a.duree);
  if (a.duree !== null && lue === null) ecart(`durée d'activité illisible (« ${a.duree} ») : celle de la charte`);
  const id = a.id && /^a\d{3}$/.test(a.id) && !pris.has(a.id) ? a.id : idDActivite(source.id, pris);
  pris.add(id);
  return { id, figure: "activite", derivation, derive_de: source.id, duree: lue ?? durees[DERIVATION[derivation].geste] };
}

/**
 * PPT de validation → pivot, et les écarts à la grammaire ; le profil de source relit ce qui est venu hors grammaire, les
 * durées de la charte complètent une activité sans la sienne.
 */
export function lire(octets: Uint8Array, profil: ProfilSource, durees: Durees = DUREES_GRADUIS): { spec: SeanceSpec; ecarts: Ecart[] } {
  const paquet = new Paquet(octets);
  const ecarts: Ecart[] = [];
  const props = proprietes(paquet);
  const lus: { bloc: Omit<Bloc, "id"> & { id?: string }; n: number }[] = [];
  const activitesLues: ActiviteLue[] = [];
  // Les diapositives annexes : le dessin d'origine d'un schéma recomposé, rattaché à son bloc (elles ne sont pas des blocs).
  const annexes: { id: string; n: number; dessin: Dessin | undefined }[] = [];
  const { largeur } = paquet.taille();
  // L'ingestion initiale, appliquée au PPT lui-même : pour une diapositive venue d'ailleurs (sa disposition n'est pas de la
  // grammaire), on la lit comme on a lu le deck hérité. Calculée une fois, au besoin.
  let heuristique: Map<number, Bloc> | undefined;
  const parHeuristique = (n: number) => {
    heuristique ??= new Map(blocsDe(qualifierReleve(relever(octets, props.get(PROPRIETES.nom) ?? "validation.pptx").releve, profil).spec).map((b) => [b.source.diapo, b]));
    return heuristique.get(n)!;
  };
  for (const d of paquet.diapositives()) {
    const ecart = (message: string) => ecarts.push({ diapo: d.n, message });
    const nom = paquet.disposition(d.chemin)?.nom ?? "";
    const figure = figureDeDisposition(nom);
    const tags = etiquettes(paquet, d.chemin);
    const geste = gesteDeDisposition(nom);
    if (geste) {
      const formes = formesDeDiapositive(paquet, d.chemin);
      const hashDe = (f: Forme) => { const o = f.media ? paquet.octets(f.media) : undefined; return o ? sha256(o) : undefined; };
      const duree = formes.find((f) => f.nom.startsWith(NOMS.duree));
      activitesLues.push({
        n: d.n, avant: lus.length, geste, id: tags.get(ETIQUETTES.bloc), derive: tags.get(ETIQUETTES.derive), derivation: tags.get(ETIQUETTES.derivation),
        empreinte: tags.get(ETIQUETTES.textes), duree: duree ? texteDe(duree) : null, ...montreDActivite(formes, paquet.notes(d.chemin), hashDe),
      });
      continue;
    }
    const source = Number.parseInt(tags.get(ETIQUETTES.source) ?? "", 10);
    const id = tags.get(ETIQUETTES.bloc);
    if (!figure) {
      const h = parHeuristique(d.n);
      ecart(`disposition hors grammaire (« ${nom} ») : lue par l'ingestion initiale, en ${h.figure}`);
      const { id: _id, source: _source, ...contenu } = h;
      lus.push({ n: d.n, bloc: { ...(id ? { id } : {}), ...contenu, source: { diapo: Number.isFinite(source) ? source : d.n } } });
      continue;
    }
    const arbre = chemin(paquet.racine(d.chemin), ["p:cSld", "p:spTree"]);
    const lecteur = lecteurDe(paquet, d.chemin, profil);
    const annexe = tags.get(ETIQUETTES.annexe);
    if (annexe) {
      const s = arbre ? schemaDe(arbre, lecteur, ecart) : null;
      annexes.push({ id: annexe, n: d.n, dessin: s?.dessin });
      continue;
    }
    const schema = figure === "schema" && arbre ? schemaDe(arbre, lecteur, ecart) : null;
    // Les formes de la grammaire du schéma (et celles qu'il a reprises) ne sont ni des visuels, ni des textes libres.
    const formes = formesDeDiapositive(paquet, d.chemin).filter((f) => !schema || (!schema.prises.has(f.id) && !(f.groupe !== undefined && schema.prises.has(f.groupe))));
    const hashDe = (f: Forme) => { const o = f.media ? paquet.octets(f.media) : undefined; return o ? sha256(o) : undefined; };
    const titre = formes.find((f) => f.espace?.type === "title" || f.espace?.type === "ctrTitle");
    const contenu = espace(formes, ESPACES.contenu);
    const roleDeFond = rolesDeCouleur(paquet, d.chemin, profil);
    const { structure: lue, illustrations: _ill } = lireStructure(formes, hashDe);
    // Ce que le client a ajouté hors grammaire (ingestion complémentaire) : des cadres de texte, des images. Rien ne se perd :
    // les textes vont à la structure par l'heuristique de l'ingestion initiale, ou à l'inventaire ; tout est signalé.
    const deLaGrammaire = (f: Forme) => f.nom.startsWith("G·") || (f.espace !== undefined);
    const textesLibres = formes.filter((f) => !deLaGrammaire(f) && f.nature !== "image" && f.nature !== "tableau" && texteDe(f));
    const imagesLibres = formes.filter((f) => f.nature === "image" && f.media && !f.nom.startsWith("G·"));
    const raster = (f: Forme) => /\.(png|jpe?g|gif|bmp|tiff?|webp)$/i.test(f.media ?? "");
    for (const im of imagesLibres) ecart(`image ajoutée hors grammaire (« ${im.nom} ») : lue comme ${im.boite[2] > 0.25 * largeur && raster(im) ? "une capture" : "un visuel"}`);
    let structure = lue;
    let textesAjoutes: string[] = [];
    if (textesLibres.length) {
      const extraits = textesLibres.map((f) => texteDe(f).split("\n")[0]!.slice(0, 40)).map((t) => `« ${t} »`).join(", ");
      if (lue || TEXTUELLES.has(figure)) {
        const s = structurer(textesLibres as unknown as FormeReleve[], imagesLibres.map((f) => ({ ...f, media: hashDe(f) })) as unknown as FormeReleve[]);
        if (s) structure = { rangees: [...(lue?.rangees ?? []), ...s.rangees] };
        ecart(`${textesLibres.length} cadre(s) de texte hors grammaire, organisé(s) par l'heuristique de l'ingestion initiale : ${extraits}`);
      } else {
        textesAjoutes = [...textesLibres].sort((a, b) => a.boite[1] - b.boite[1] || a.boite[0] - b.boite[0]).map(texteDe);
        ecart(`${textesLibres.length} cadre(s) de texte hors grammaire, ajouté(s) aux textes : ${extraits}`);
      }
    }
    const visuels: Visuel[] = formes.filter((f) => f.nature === "image" && f.media).map((f) => {
      const role = roleDeVisuel(f.nom);
      const fond = f.style?.fond && f.style.fond !== "aucun" ? roleDeFond(f.style.fond.rgb) : undefined;
      return {
        media: hashDe(f)!,
        capture: f.nom.startsWith(NOMS.capture) || (!f.nom.startsWith("G·") && f.boite[2] > 0.25 * largeur && raster(f)),
        ...(f.rognage ? { rognage: [...f.rognage] as [number, number, number, number] } : {}),
        ...(role ? { role } : {}),
        // La légende est le texte de remplacement d'un visuel de la grammaire (pas celui qu'Office génère pour une image ajoutée).
        ...(f.alt !== undefined && f.nom.startsWith("G·") ? { legende: f.alt } : {}),
        ...(fond ? { fond } : {}),
      };
    });
    const tableaux = formes.filter((f) => f.nature === "tableau").map((f) => (f.lignes ?? []).map((l) => [...l]));
    if (!Number.isFinite(source)) ecart("diapositive sans source (ajoutée dans PowerPoint ?)");
    const lectures = tags.get(ETIQUETTES.lectures);
    const stash = lectures ? JSON.parse(lectures) as Pick<Bloc, "dessin" | "structure" | "composition"> : {};
    // Un PPT émis avant PKG-C2 portait la structure en étiquette : on la reprend si la diapositive n'a pas de colonnes.
    structure ??= stash.structure ?? null;
    const textesDuContenu = (contenu?.texte ?? []).filter((t) => t.trim() !== "");
    lus.push({
      n: d.n,
      bloc: {
        ...(id ? { id } : {}),
        figure,
        source: { diapo: Number.isFinite(source) ? source : d.n },
        ...(d.masquee ? { masquee: true as const } : {}),
        titre: titre ? texteDe(titre) : null,
        textes: structure ? textesDeStructure(structure) : [...textesDuContenu, ...textesAjoutes],
        visuels,
        tableaux,
        pas: pasDe(formes, hashDe, ecart),
        // Un PPT émis avant PKG-C3 portait dessin et composition en étiquette : repris s'il n'en dessine pas.
        ...(schema?.dessin ?? stash.dessin ? { dessin: (schema?.dessin ?? stash.dessin)! } : {}),
        ...(structure ? { structure } : {}),
        ...(schema?.composition ?? (schema ? undefined : stash.composition) ? { composition: (schema?.composition ?? stash.composition)! } : {}),
        notes: paquet.notes(d.chemin),
      },
    });
  }
  // Les annexes rejoignent leur bloc ; l'inventaire d'un schéma se dérive alors de ce qui le montre (PKG-C3).
  for (const a of annexes) {
    const lu = lus.find((x) => x.bloc.id === a.id && x.bloc.composition && !x.bloc.dessin);
    if (lu && a.dessin) lu.bloc = { ...lu.bloc, dessin: a.dessin };
    else ecarts.push({ diapo: a.n, message: `diapositive annexe sans schéma recomposé à qui la rattacher (« ${a.id} ») : ignorée` });
  }
  for (const { bloc, n } of lus) {
    if (bloc.figure !== "schema" || (!bloc.dessin && !bloc.composition)) continue;
    if (bloc.composition && !bloc.dessin) ecarts.push({ diapo: n, message: "schéma recomposé sans sa diapositive annexe : le dessin d'origine manque" });
    Object.assign(bloc, inventaireDeSchema(bloc.dessin, bloc.composition));
  }
  // Une diapositive dupliquée duplique ses étiquettes : la seconde reçoit un identifiant neuf, au-delà du plus grand.
  const vus = new Set<string>();
  let max = Math.max(0, ...lus.map((l) => Number.parseInt(l.bloc.id?.slice(1) ?? "0", 10) || 0));
  const blocs: Bloc[] = lus.map(({ bloc, n }) => {
    let id = bloc.id;
    if (!id || vus.has(id)) {
      const neuf = `b${trois(++max)}`;
      ecarts.push({ diapo: n, message: id ? `identifiant ${id} dupliqué : renuméroté ${neuf}` : `diapositive sans identifiant : numérotée ${neuf}` });
      id = neuf;
    }
    vus.add(id);
    return { ...bloc, id } as Bloc;
  });
  // Les activités, résolues sur les blocs lus, rejoignent leur place : juste après le dernier bloc qui les précède.
  const pris = new Set<string>();
  const activites = activitesLues.map((a) => ({ avant: a.avant, activite: resoudreActivite(a, blocs, durees, pris, (message) => ecarts.push({ diapo: a.n, message })) }));
  const ordonnes: (Bloc | Activite)[] = [];
  for (let k = 0; k <= blocs.length; k++) {
    for (const a of activites) if (a.avant === k && a.activite) ordonnes.push(a.activite);
    if (k < blocs.length) ordonnes.push(blocs[k]!);
  }
  // Une séquence s'ouvre à chaque transition ; son identifiant suit son premier bloc.
  const sequences: Sequence[] = [];
  for (const b of ordonnes) {
    const courante = sequences[sequences.length - 1];
    if (!courante || b.figure === "transition") sequences.push({ id: `s${b.id.slice(1)}`, blocs: [b] });
    else courante.blocs.push(b);
  }
  const spec = SeanceSpec.parse({
    schema: SCHEMA_SEANCE,
    source: { nom: props.get(PROPRIETES.nom) ?? "", empreinte: props.get(PROPRIETES.empreinte) ?? "" },
    sequences,
  });
  return { spec, ecarts };
}

/** Où se trouve chaque bloc dans le PPT de validation (son numéro de diapositive) : la fiche de revue y renvoie. */
export function diapositivesDesBlocs(octets: Uint8Array): Map<string, number> {
  const paquet = new Paquet(octets);
  const out = new Map<string, number>();
  for (const d of paquet.diapositives()) {
    const id = etiquettes(paquet, d.chemin).get(ETIQUETTES.bloc);
    if (id && !out.has(id)) out.set(id, d.n);
  }
  return out;
}

/** Un PPT de validation se reconnaît à ses propriétés : il dit de quel deck hérité il procède. */
export function estUnPptDeValidation(octets: Uint8Array): boolean {
  try {
    return proprietes(new Paquet(octets)).has(PROPRIETES.empreinte);
  } catch {
    return false;
  }
}

