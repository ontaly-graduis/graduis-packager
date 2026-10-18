// `lire` : PPT de validation → pivot (PKG-C). La lecture grammaticale, déterministe : la disposition dit la figure, les
// espaces réservés le titre, les textes et les consignes ; les formes nommées les pas ; les étiquettes l'identité du bloc.
// Rien ne se devine (P2) : ce qui sort de la grammaire est un écart, signalé.
import { strFromU8 } from "fflate";
import { DOMParser, type Element } from "@xmldom/xmldom";
import { sha256 } from "../lib/json";
import { formesDeDiapositive, type Forme } from "../ooxml/formes";
import { Paquet } from "../ooxml/paquet";
import { SCHEMA_SEANCE, SeanceSpec, type Bloc, type Pas, type Sequence, type Visuel } from "../pivot/seance-spec";
import { ESPACES, ETIQUETTES, NOMS, PROPRIETES, ROLES_DE_COULEUR, ancrageDeZone, couleurDeRole, figureDeDisposition, roleDeVisuel } from "../emission/grammaire";
import { lireCouleur, paletteDuMasque } from "../ooxml/couleurs";
import { roleDe } from "../qualification/roles";
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
 * thème du paquet ; une autre couleur (choisie dans PowerPoint) va au rôle le plus proche, par la projection du relevé.
 */
const parPaquet = new WeakMap<Paquet, Map<string, (rgb: string) => Role>>();
function rolesDeCouleur(p: Paquet, diapo: string): (rgb: string) => Role {
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
    f = (rgb) => table.get(rgb.toUpperCase()) ?? roleDe({ rgb });
    parMasque.set(masque, f);
  }
  return f;
}

/** PPT de validation → pivot, et les écarts à la grammaire. */
export function lire(octets: Uint8Array): { spec: SeanceSpec; ecarts: Ecart[] } {
  const paquet = new Paquet(octets);
  const ecarts: Ecart[] = [];
  const props = proprietes(paquet);
  const lus: { bloc: Omit<Bloc, "id"> & { id?: string }; n: number }[] = [];
  for (const d of paquet.diapositives()) {
    const ecart = (message: string) => ecarts.push({ diapo: d.n, message });
    const nom = paquet.disposition(d.chemin)?.nom ?? "";
    const figure = figureDeDisposition(nom);
    if (!figure) ecart(`disposition hors grammaire (« ${nom} ») : lue comme un contenu`);
    const tags = etiquettes(paquet, d.chemin);
    const formes = formesDeDiapositive(paquet, d.chemin);
    const hashDe = (f: Forme) => { const o = f.media ? paquet.octets(f.media) : undefined; return o ? sha256(o) : undefined; };
    const titre = formes.find((f) => f.espace?.type === "title" || f.espace?.type === "ctrTitle");
    const contenu = espace(formes, ESPACES.contenu);
    const roleDeFond = rolesDeCouleur(paquet, d.chemin);
    const visuels: Visuel[] = formes.filter((f) => f.nature === "image" && f.media).map((f) => {
      const role = roleDeVisuel(f.nom);
      const fond = f.style?.fond && f.style.fond !== "aucun" ? roleDeFond(f.style.fond.rgb) : undefined;
      return {
        media: hashDe(f)!,
        capture: f.nom.startsWith(NOMS.capture),
        ...(f.rognage ? { rognage: [...f.rognage] as [number, number, number, number] } : {}),
        ...(role ? { role } : {}),
        // La légende est le texte de remplacement d'un visuel de la grammaire (pas celui qu'Office génère pour une image ajoutée).
        ...(f.alt !== undefined && f.nom.startsWith("G·") ? { legende: f.alt } : {}),
        ...(fond ? { fond } : {}),
      };
    });
    const tableaux = formes.filter((f) => f.nature === "tableau").map((f) => (f.lignes ?? []).map((l) => [...l]));
    const source = Number.parseInt(tags.get(ETIQUETTES.source) ?? "", 10);
    if (!Number.isFinite(source)) ecart("diapositive sans source (ajoutée dans PowerPoint ?)");
    const lectures = tags.get(ETIQUETTES.lectures);
    const id = tags.get(ETIQUETTES.bloc);
    lus.push({
      n: d.n,
      bloc: {
        ...(id ? { id } : {}),
        figure: figure ?? "contenu",
        source: { diapo: Number.isFinite(source) ? source : d.n },
        ...(d.masquee ? { masquee: true as const } : {}),
        titre: titre ? texteDe(titre) : null,
        textes: (contenu?.texte ?? []).filter((t) => t.trim() !== ""),
        visuels,
        tableaux,
        pas: pasDe(formes, hashDe, ecart),
        ...(lectures ? JSON.parse(lectures) as Pick<Bloc, "dessin" | "structure" | "composition"> : {}),
        notes: paquet.notes(d.chemin),
      },
    });
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
  // Une séquence s'ouvre à chaque transition ; son identifiant suit son premier bloc.
  const sequences: Sequence[] = [];
  for (const b of blocs) {
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

/** Un PPT de validation se reconnaît à ses propriétés : il dit de quel deck hérité il procède. */
export function estUnPptDeValidation(octets: Uint8Array): boolean {
  try {
    return proprietes(new Paquet(octets)).has(PROPRIETES.empreinte);
  } catch {
    return false;
  }
}

