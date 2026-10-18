// La lecture d'un dessin en formes natives (PKG-C3) : le groupe « G·schéma » relu dans son repère enfant, au centième de
// point exact ; formes, chemins, images, tableaux (posés hors du groupe, leur rang dans leur nom) ; les couleurs en rôles
// (une couleur de la grammaire exactement, une autre au rôle le plus proche) ; le dévoilement dans les noms.
// Ce qu'ONET y dessine dans PowerPoint (une forme, une flèche, un texte) se lit de même : rien ne se perd.
import { DOMParser, type Element } from "@xmldom/xmldom";
import { NS, chemin, elementsEnfants, enfant, enfants, entier } from "../ooxml/paquet";
import { FLECHES, ROLES, TIRETS, type Corps, type Dessin, type ElementDeDessin, type Role, type TraitDeDessin } from "../pivot/seance-spec";
import { EMU, couleurDeRole, marquesDeNom } from "../emission/grammaire";
import { normaliserFragments } from "../qualification/dessin";

/** Ce qu'il faut pour relire : le rôle d'une couleur, le média d'une relation, les polices et traits du thème. */
export interface LecteurDeDessin {
  /** Le rôle d'une couleur que la grammaire n'a pas écrite (choisie dans PowerPoint) : le plus proche. */
  readonly roleProche: (couleur: Element) => Role | undefined;
  readonly media: (rId: string) => string | undefined;
  readonly polices: { readonly majeure: string; readonly mineure: string };
  readonly largeurs: readonly number[];
}

/** Une boîte en EMU [x, y, l, h], et ce qui la ramène au repère du dessin. */
export type Boite = readonly [number, number, number, number];
export type Repere = (b: Boite) => Boite;
export const IDENTITE: Repere = (b) => b;

const pt = (emu: number) => Math.round((emu / EMU.point) * 100) / 100 + 0;
const boitePt = (b: Boite): [number, number, number, number] => [pt(b[0]), pt(b[1]), pt(b[2]), pt(b[3])];

// La signature d'une couleur (schéma, valeur, modificateurs) : celle qu'écrit `couleurDeRole` désigne son rôle exactement.
const signature = (el: Element) => [`${el.localName}:${el.getAttribute("val") ?? ""}`, ...elementsEnfants(el).map((m) => `${m.localName}=${m.getAttribute("val") ?? ""}`)].join("|");
let ROLES_PAR_SIGNATURE: Map<string, Role> | undefined;
function roleExact(el: Element): Role | undefined {
  if (!ROLES_PAR_SIGNATURE) {
    ROLES_PAR_SIGNATURE = new Map();
    for (const r of ROLES) {
      const doc = new DOMParser().parseFromString(`<a:solidFill xmlns:a="${NS.a}">${couleurDeRole(r)}</a:solidFill>`, "text/xml").documentElement!;
      ROLES_PAR_SIGNATURE.set(signature(elementsEnfants(doc)[0]!), r);
    }
  }
  return ROLES_PAR_SIGNATURE.get(signature(el));
}
/** Le rôle d'un élément de couleur : celui que la grammaire écrit ainsi, ou le plus proche. */
export const role = (el: Element | undefined, l: LecteurDeDessin): Role | undefined => (el ? roleExact(el) ?? l.roleProche(el) : undefined);

/** La couleur d'un remplissage : « aucun », l'élément de couleur, ou rien de dit. */
export function couleurDe(conteneur: Element | undefined): Element | "aucun" | undefined {
  if (!conteneur) return undefined;
  if (enfant(conteneur, NS.a, "noFill")) return "aucun";
  const plein = enfant(conteneur, NS.a, "solidFill");
  if (plein) return elementsEnfants(plein)[0];
  const arret = chemin(conteneur, ["a:gradFill", "a:gsLst", "a:gs"]);
  if (arret) return elementsEnfants(arret)[0];
  const avant = chemin(conteneur, ["a:pattFill", "a:fgClr"]);
  if (avant) return elementsEnfants(avant)[0];
  if (enfant(conteneur, NS.a, "blipFill") || enfant(conteneur, NS.a, "grpFill")) return "aucun";
  return undefined;
}

/** La référence de style d'une forme dessinée dans PowerPoint (`p:style`) : index et couleur. */
export function reference(el: Element, nom: string): { idx: number; couleur: Element | undefined } | undefined {
  const r = chemin(el, ["p:style", `a:${nom}`]);
  if (!r) return undefined;
  return { idx: entier(r, "idx") ?? 0, couleur: elementsEnfants(r)[0] };
}

export function fondDe(spPr: Element | undefined, el: Element, l: LecteurDeDessin): Role | undefined {
  const c = couleurDe(spPr);
  if (c === "aucun") return undefined;
  if (c) return role(c, l);
  const ref = reference(el, "fillRef");
  return ref && ref.idx > 0 ? role(ref.couleur, l) : undefined;
}

export function traitDe(ln: Element | undefined, l: LecteurDeDessin, ref?: { idx: number; couleur: Element | undefined }): TraitDeDessin | undefined {
  const c = couleurDe(ln);
  if (c === "aucun") return undefined;
  const couleur = c ? role(c, l) : ref && ref.idx > 0 ? role(ref.couleur, l) : undefined;
  if (!couleur) return undefined;
  const largeur = entier(ln, "w") ?? (ref && ref.idx > 0 ? l.largeurs[ref.idx - 1] : undefined) ?? 9525;
  const tirets = TIRETS.find((t) => t === (ln && enfant(ln, NS.a, "prstDash")?.getAttribute("val")));
  const debut = FLECHES.find((t) => t === (ln && enfant(ln, NS.a, "headEnd")?.getAttribute("type")));
  const fin = FLECHES.find((t) => t === (ln && enfant(ln, NS.a, "tailEnd")?.getAttribute("type")));
  return { couleur, largeur: pt(largeur), ...(tirets ? { tirets } : {}), ...(debut ? { debut } : {}), ...(fin ? { fin } : {}) };
}

const ANCRAGES: Readonly<Record<string, Corps["ancrage"]>> = { t: "haut", ctr: "milieu", b: "bas" };
const ALIGNEMENTS: Readonly<Record<string, Corps["paragraphes"][number]["alignement"]>> = { l: "gauche", ctr: "centre", r: "droite", just: "justifie", dist: "justifie" };
const vrai = (v: string | null) => v === "1" || v === "true";

/** Un cadre de texte : `marges` et `ancrage` d'une cellule viennent de ses propriétés ; `encre` = la couleur d'une forme sans couleur de texte. */
export function corpsDe(txBody: Element, l: LecteurDeDessin, o: { encre?: Element | undefined; marges?: Boite; ancrage?: string | null } = {}): Corps {
  const bodyPr = enfant(txBody, NS.a, "bodyPr");
  const echelle = (entier(chemin(bodyPr ?? txBody, ["a:normAutofit"]), "fontScale") ?? 100000) / 100000;
  const poids = new Map<string, number>();
  const ps = enfants(txBody, NS.a, "p");
  const nu = ps.length === 1 && !elementsEnfants(ps[0]!).length;
  const paragraphes = (nu ? [] : ps).map((p) => {
    const fragments: Corps["paragraphes"][number]["fragments"] = [];
    const ajouter = (texte: string, r: Element | undefined) => {
      const plein = r ? enfant(r, NS.a, "solidFill") : undefined;
      const typeface = r ? enfant(r, NS.a, "latin")?.getAttribute("typeface") : undefined;
      const police = typeface === "+mn-lt" ? l.polices.mineure : typeface === "+mj-lt" ? l.polices.majeure : typeface;
      if (police) poids.set(police, (poids.get(police) ?? 0) + texte.trim().length);
      const u = r?.getAttribute("u");
      fragments.push({
        texte,
        taille: Math.round((entier(r, "sz") ?? 1800) * echelle) / 100,
        ...(vrai(r?.getAttribute("b") ?? null) ? { gras: true as const } : {}),
        ...(vrai(r?.getAttribute("i") ?? null) ? { italique: true as const } : {}),
        ...(u && u !== "none" ? { souligne: true as const } : {}),
        couleur: role(plein ? elementsEnfants(plein)[0] : o.encre, l) ?? "encre",
      });
    };
    for (const c of elementsEnfants(p)) {
      if (c.localName === "r" || c.localName === "fld") ajouter(enfant(c, NS.a, "t")?.textContent ?? "", enfant(c, NS.a, "rPr"));
      else if (c.localName === "br") ajouter("\n", enfant(c, NS.a, "rPr"));
    }
    const fin = enfant(p, NS.a, "endParaRPr");
    if (!fragments.length && fin) ajouter("", fin);
    return { alignement: ALIGNEMENTS[enfant(p, NS.a, "pPr")?.getAttribute("algn") ?? "l"] ?? "gauche", fragments: normaliserFragments(fragments) };
  });
  const police = [...poids].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  const marges = o.marges ?? [entier(bodyPr, "lIns") ?? 91440, entier(bodyPr, "tIns") ?? 45720, entier(bodyPr, "rIns") ?? 91440, entier(bodyPr, "bIns") ?? 45720];
  return {
    ...(police ? { police } : {}),
    ancrage: ANCRAGES[(o.ancrage !== undefined ? o.ancrage : bodyPr?.getAttribute("anchor")) ?? "t"] ?? "haut",
    marges: [pt(marges[0]), pt(marges[1]), pt(marges[2]), pt(marges[3])],
    ...(bodyPr?.getAttribute("wrap") === "none" ? { retour: false as const } : {}),
    paragraphes,
  };
}

const aDuTexte = (c: Corps) => c.paragraphes.some((p) => p.fragments.some((f) => f.texte.trim()));

/** Une `a:custGeom` en chemins SVG (la syntaxe du relevé) ; `null` si un point passe par un guide. */
function chemins(custGeom: Element, ext: readonly [number, number]): NonNullable<Extract<ElementDeDessin, { type: "forme" }>["chemins"]> | null {
  const out: NonNullable<Extract<ElementDeDessin, { type: "forme" }>["chemins"]> = [];
  const nombre = (v: string | null) => (v !== null && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null);
  for (const path of enfants(chemin(custGeom, ["a:pathLst"]) ?? custGeom, NS.a, "path")) {
    const parts: string[] = [];
    let cur: [number, number] = [0, 0];
    for (const c of elementsEnfants(path)) {
      const pts = enfants(c, NS.a, "pt").map((p) => [nombre(p.getAttribute("x")), nombre(p.getAttribute("y"))] as const);
      if (pts.some(([x, y]) => x === null || y === null)) return null;
      const xy = pts.map(([x, y]) => `${x} ${y}`);
      if (c.localName === "moveTo") parts.push(`M${xy[0]}`);
      else if (c.localName === "lnTo") parts.push(`L${xy[0]}`);
      else if (c.localName === "cubicBezTo") parts.push(`C${xy.join(" ")}`);
      else if (c.localName === "quadBezTo") parts.push(`Q${xy.join(" ")}`);
      else if (c.localName === "close") parts.push("Z");
      else if (c.localName === "arcTo") {
        const [wR, hR, st, sw] = ["wR", "hR", "stAng", "swAng"].map((a) => nombre(c.getAttribute(a)));
        if (wR === null || hR === null || st === null || sw === null) return null;
        const a0 = (st! / 60000) * (Math.PI / 180);
        const a1 = ((st! + sw!) / 60000) * (Math.PI / 180);
        const cx = cur[0] - wR! * Math.cos(a0);
        const cy = cur[1] - hR! * Math.sin(a0);
        const fin: [number, number] = [Math.round(cx + wR! * Math.cos(a1)), Math.round(cy + hR! * Math.sin(a1))];
        parts.push(`A${wR} ${hR} 0 ${Math.abs(sw!) > 10800000 ? 1 : 0} ${sw! > 0 ? 1 : 0} ${fin[0]} ${fin[1]}`);
        cur = fin;
        continue;
      }
      const dernier = pts[pts.length - 1];
      if (dernier) cur = [dernier[0]!, dernier[1]!];
    }
    const remplir = path.getAttribute("fill") !== "none";
    const tracer = !["0", "false"].includes(path.getAttribute("stroke") ?? "");
    out.push({
      largeur: entier(path, "w") ?? ext[0], hauteur: entier(path, "h") ?? ext[1], d: parts.join(""),
      ...(remplir ? {} : { remplir: false as const }), ...(tracer ? {} : { tracer: false as const }),
    });
  }
  return out;
}

function boiteDe(xfrm: Element | undefined): Boite | undefined {
  const off = xfrm && enfant(xfrm, NS.a, "off");
  const ext = xfrm && enfant(xfrm, NS.a, "ext");
  if (!off || !ext) return undefined;
  return [entier(off, "x") ?? 0, entier(off, "y") ?? 0, entier(ext, "cx") ?? 0, entier(ext, "cy") ?? 0];
}

const nomDe = (el: Element, nv: string) => chemin(el, [`p:${nv}`, "p:cNvPr"])?.getAttribute("name") ?? "";

/** Le repère enfant d'un groupe : ce qui ramène une boîte de ses enfants au repère de son parent. */
export function repereDeGroupe(grp: Element): { repere: Repere; cadre: Boite; place: Boite } | undefined {
  const xfrm = chemin(grp, ["p:grpSpPr", "a:xfrm"]);
  const place = boiteDe(xfrm);
  const chOff = xfrm && enfant(xfrm, NS.a, "chOff");
  const chExt = xfrm && enfant(xfrm, NS.a, "chExt");
  if (!place || !chOff || !chExt) return undefined;
  const cadre: Boite = [entier(chOff, "x") ?? 0, entier(chOff, "y") ?? 0, entier(chExt, "cx") ?? 0, entier(chExt, "cy") ?? 0];
  const sx = cadre[2] ? place[2] / cadre[2] : 1;
  const sy = cadre[3] ? place[3] / cadre[3] : 1;
  return { cadre, place, repere: (b) => [place[0] + (b[0] - cadre[0]) * sx, place[1] + (b[1] - cadre[1]) * sy, b[2] * sx, b[3] * sy] };
}

/** L'inverse : une boîte de la diapositive dans le repère enfant d'un groupe. */
export function versGroupe(g: { cadre: Boite; place: Boite }): { repere: Repere; s: number } {
  const sx = g.place[2] ? g.cadre[2] / g.place[2] : 1;
  const sy = g.place[3] ? g.cadre[3] / g.place[3] : 1;
  return { s: sx ? 1 / sx : 1, repere: (b) => [g.cadre[0] + (b[0] - g.place[0]) * sx, g.cadre[1] + (b[1] - g.place[1]) * sy, b[2] * sx, b[3] * sy] };
}

const arrondie = (b: Boite): Boite => [Math.round(b[0]), Math.round(b[1]), Math.round(b[2]), Math.round(b[3])];

/** Une forme (`p:sp`, `p:cxnSp`) ou une image (`p:pic`), dans le repère du dessin. */
export function lireElement(el: Element, l: LecteurDeDessin, repere: Repere = IDENTITE): ElementDeDessin | null {
  if (el.localName === "sp" || el.localName === "cxnSp") {
    const spPr = enfant(el, NS.p, "spPr");
    const xfrm = spPr && enfant(spPr, NS.a, "xfrm");
    const brute = boiteDe(xfrm);
    if (!brute) return null;
    const marques = marquesDeNom(nomDe(el, el.localName === "sp" ? "nvSpPr" : "nvCxnSpPr"));
    const rot = entier(xfrm, "rot") ?? 0;
    const [h, v] = [vrai(xfrm?.getAttribute("flipH") ?? null), vrai(xfrm?.getAttribute("flipV") ?? null)];
    const prst = spPr && enfant(spPr, NS.a, "prstGeom");
    const ajustements: Record<string, number> = {};
    for (const g of prst ? enfants(chemin(prst, ["a:avLst"]) ?? prst, NS.a, "gd") : []) {
      const val = (g.getAttribute("fmla") ?? "").match(/^val\s+(-?\d+)$/);
      if (val) ajustements[g.getAttribute("name") ?? ""] = Number(val[1]);
    }
    const libre = spPr && enfant(spPr, NS.a, "custGeom");
    const lus = libre ? chemins(libre, [brute[2], brute[3]]) : null;
    const fond = fondDe(spPr, el, l);
    const trait = traitDe(spPr && enfant(spPr, NS.a, "ln"), l, reference(el, "lnRef"));
    const txBody = enfant(el, NS.p, "txBody");
    const police = reference(el, "fontRef");
    const corps = txBody ? corpsDe(txBody, l, { encre: police?.couleur }) : undefined;
    const texte = corps && aDuTexte(corps) ? corps : undefined;
    return {
      type: "forme", boite: boitePt(arrondie(repere(brute))),
      geometrie: lus?.length ? "libre" : prst?.getAttribute("prst") ?? "rect",
      ...(Object.keys(ajustements).length ? { ajustements } : {}),
      ...(lus?.length ? { chemins: lus } : {}),
      ...(rot ? { rotation: Math.round(rot / 600) / 100 } : {}),
      ...(h || v ? { retournement: h && v ? "hv" as const : h ? "h" as const : "v" as const } : {}),
      ...(fond ? { fond } : {}),
      ...(trait ? { trait } : {}),
      ...(texte ? { texte } : {}),
      ...marques,
    };
  }
  if (el.localName === "pic") {
    const brute = boiteDe(chemin(el, ["p:spPr", "a:xfrm"]));
    const blip = chemin(el, ["p:blipFill", "a:blip"]);
    if (!brute || !blip) return null;
    const svg = blip.getElementsByTagNameNS("http://schemas.microsoft.com/office/drawing/2016/SVG/main", "svgBlip")[0];
    const media = l.media(svg?.getAttributeNS(NS.r, "embed") ?? blip.getAttributeNS(NS.r, "embed") ?? "");
    if (!media) return null;
    const src = chemin(el, ["p:blipFill", "a:srcRect"]);
    const rognage = src ? [entier(src, "l") ?? 0, entier(src, "t") ?? 0, entier(src, "r") ?? 0, entier(src, "b") ?? 0] as [number, number, number, number] : undefined;
    const prst = chemin(el, ["p:spPr", "a:prstGeom"])?.getAttribute("prst");
    const { pas } = marquesDeNom(nomDe(el, "nvPicPr"));
    return {
      type: "image", boite: boitePt(arrondie(repere(brute))), media,
      ...(rognage && rognage.some((x) => x !== 0) ? { rognage } : {}),
      ...(prst && prst !== "rect" ? { geometrie: prst } : {}),
      ...(pas ? { pas } : {}),
    };
  }
  return null;
}

/** Un tableau du dessin (`p:graphicFrame`) : sa grille ramenée à l'échelle du dessin. */
export function lireGrille(el: Element, l: LecteurDeDessin, repere: Repere, s: number): ElementDeDessin | null {
  const brute = boiteDe(enfant(el, NS.p, "xfrm"));
  const tbl = chemin(el, ["a:graphic", "a:graphicData", "a:tbl"]);
  if (!brute || !tbl) return null;
  const echelle = (v: number) => pt(Math.round(v / s));
  const ln = (tcPr: Element | undefined, nom: string) => traitDe(tcPr ? enfant(tcPr, NS.a, nom) : undefined, l) ?? null;
  const { pas } = marquesDeNom(nomDe(el, "nvGraphicFramePr"));
  return {
    type: "tableau", boite: boitePt(arrondie(repere(brute))),
    colonnes: enfants(chemin(tbl, ["a:tblGrid"]) ?? tbl, NS.a, "gridCol").map((g) => echelle(entier(g, "w") ?? 0)),
    hauteurs: enfants(tbl, NS.a, "tr").map((r) => echelle(entier(r, "h") ?? 0)),
    cellules: enfants(tbl, NS.a, "tr").map((r) => enfants(r, NS.a, "tc").map((tc) => {
      const tcPr = enfant(tc, NS.a, "tcPr");
      const c = couleurDe(tcPr);
      const fond = c && c !== "aucun" ? role(c, l) : undefined;
      const marges: Boite = [entier(tcPr, "marL") ?? 91440, entier(tcPr, "marT") ?? 45720, entier(tcPr, "marR") ?? 91440, entier(tcPr, "marB") ?? 45720];
      const txBody = enfant(tc, NS.a, "txBody");
      const texte = txBody ? corpsDe(txBody, l, { marges, ancrage: tcPr?.getAttribute("anchor") ?? "t" })
        : { ancrage: "haut" as const, marges: [pt(marges[0]), pt(marges[1]), pt(marges[2]), pt(marges[3])] as [number, number, number, number], paragraphes: [] };
      return { ...(fond ? { fond } : {}), bords: [ln(tcPr, "lnT"), ln(tcPr, "lnR"), ln(tcPr, "lnB"), ln(tcPr, "lnL")] as [TraitDeDessin | null, TraitDeDessin | null, TraitDeDessin | null, TraitDeDessin | null], texte };
    })),
    ...(pas ? { pas } : {}),
  };
}

/** Les éléments d'un groupe, dans l'ordre du document ; un groupe imbriqué (formé dans PowerPoint) s'aplatit. */
export function lireElements(grp: Element, l: LecteurDeDessin, repere: Repere = IDENTITE): ElementDeDessin[] {
  const out: ElementDeDessin[] = [];
  for (const el of elementsEnfants(grp)) {
    if (el.namespaceURI !== NS.p) continue;
    if (el.localName === "grpSp") {
      const g = repereDeGroupe(el);
      if (g) out.push(...lireElements(el, l, (b) => repere(g.repere(b))));
      continue;
    }
    if (el.localName === "graphicFrame") {
      const t = lireGrille(el, l, repere, 1);
      if (t) out.push(t);
      continue;
    }
    const e = lireElement(el, l, repere);
    if (e) out.push(e);
  }
  return out;
}

/** Un dessin (ou une vignette) : son groupe, et les tableaux posés à côté avec leur rang. */
export function lireGroupe(grp: Element, tableaux: readonly Element[], l: LecteurDeDessin): Pick<Dessin, "cadre" | "elements"> {
  const g = repereDeGroupe(grp);
  const cadre = g ? boitePt(g.cadre) : [0, 0, 0, 0] as [number, number, number, number];
  const elements = lireElements(grp, l);
  if (g) {
    const inverse = versGroupe(g);
    const ranges = tableaux.map((t) => ({ t, rang: Number(nomDe(t, "nvGraphicFramePr").match(/· rang (\d+)/)?.[1] ?? Infinity) }))
      .sort((a, b) => a.rang - b.rang);
    for (const { t, rang } of ranges) {
      const e = lireGrille(t, l, inverse.repere, inverse.s);
      if (e) elements.splice(Math.min(rang, elements.length), 0, e);
    }
  }
  return { cadre, elements };
}
