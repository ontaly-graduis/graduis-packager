// Les styles d'une forme, résolus comme PowerPoint les affiche : propriétés directes, puis références `p:style` au thème, puis défauts du masque.
import type { Element } from "@xmldom/xmldom";
import { type Couleur, type Palette, couleurDeRemplissage, lireCouleur, paletteDuMasque } from "./couleurs";
import { NS, type Paquet, chemin, elementsEnfants, enfant, enfants, entier } from "./paquet";

/** Remplissage résolu : une couleur, ou rien. */
export type Fond = Couleur | "aucun";

/** Un trait résolu ; `largeur` en EMU ; tirets et flèches dans le vocabulaire DrawingML (`dash`, `triangle`…). */
export interface Trait {
  readonly couleur: Fond;
  readonly largeur: number;
  readonly tirets?: string;
  readonly debut?: string;
  readonly fin?: string;
}

/** Une suite de caractères au même style ; `taille` en centièmes de point ; `police` = la police latine résolue. */
export interface Fragment {
  readonly texte: string;
  readonly taille: number;
  readonly police: string;
  readonly gras?: true;
  readonly italique?: true;
  readonly souligne?: true;
  readonly couleur: Couleur;
}

/** La puce d'un paragraphe : déclarée (caractère, numérotation), ôtée, ou héritée (non résolue : masque ou disposition). */
export type Puce = "car" | "num" | "aucune" | "heritee";

export interface Paragraphe {
  readonly alignement: string;
  readonly fragments: readonly Fragment[];
  /** Le niveau de plan (`lvl`, 0 à 8). */
  readonly niveau: number;
  readonly puce: Puce;
  /** Le caractère de la puce (`buChar@char`), s'il est déclaré. */
  readonly car?: string;
  /** Le retrait de gauche (`marL`) en EMU, s'il est déclaré. */
  readonly retrait?: number;
}

/** La puce déclarée par un `pPr` ou un niveau de `lstStyle`, s'il en déclare une. */
function puceDe(pr: Element | undefined): Puce | undefined {
  if (!pr) return undefined;
  if (enfant(pr, NS.a, "buNone")) return "aucune";
  if (enfant(pr, NS.a, "buAutoNum")) return "num";
  if (enfant(pr, NS.a, "buChar") || enfant(pr, NS.a, "buBlip")) return "car";
  return undefined;
}

/** Le cadre de texte : ancrage, marges en EMU, retour à la ligne, échelle de réduction automatique (cent-millièmes). */
export interface Corps {
  readonly ancrage: string;
  readonly marges: readonly [number, number, number, number];
  readonly retour: boolean;
  readonly echelle: number;
  readonly paragraphes: readonly Paragraphe[];
}

/** Un chemin de forme libre, en SVG (`d`) dans son propre repère `largeur × hauteur`. */
export interface CheminLibre {
  readonly largeur: number;
  readonly hauteur: number;
  readonly d: string;
  readonly remplir: boolean;
  readonly tracer: boolean;
}

export interface Cellule {
  readonly fond: Fond;
  /** Haut, droite, bas, gauche. */
  readonly bords: readonly [Trait | null, Trait | null, Trait | null, Trait | null];
  readonly corps: Corps;
}

/** La mise en forme d'un tableau : largeurs de colonnes et hauteurs de lignes en EMU, cellules ligne par ligne. */
export interface Grille {
  readonly colonnes: readonly number[];
  readonly hauteurs: readonly number[];
  readonly cellules: readonly (readonly Cellule[])[];
}

/** Ce qu'il faut pour redessiner une forme. Rotation en 60 000es de degré. */
export interface Style {
  readonly fond: Fond;
  readonly trait: Trait | null;
  readonly rotation?: number;
  readonly retournement?: "h" | "v" | "hv";
  readonly ajustements?: Readonly<Record<string, number>>;
  readonly chemins?: readonly CheminLibre[];
  readonly corps?: Corps;
  readonly grille?: Grille;
}

interface DefautsDeTexte {
  readonly taille?: number;
  readonly couleur?: Couleur;
  readonly gras?: boolean;
  readonly police?: string;
}

/** Les polices du thème du masque, pour résoudre `+mn-lt` (mineure) et `+mj-lt` (majeure). */
export interface PolicesDuTheme {
  readonly mineure: string;
  readonly majeure: string;
}

/** Ce que le masque et son thème apportent : palette, épaisseurs des traits du thème, défauts de texte. */
export interface StylesDuMasque {
  readonly palette: Palette;
  readonly polices: PolicesDuTheme;
  readonly largeurs: readonly number[];
  readonly autre: DefautsDeTexte;
  readonly corps: DefautsDeTexte;
}

/** Une police latine résolue : `+mn-lt` et `+mj-lt` désignent les polices du thème. */
function police(typeface: string | null | undefined, p: PolicesDuTheme): string | undefined {
  if (!typeface) return undefined;
  return typeface === "+mn-lt" ? p.mineure : typeface === "+mj-lt" ? p.majeure : typeface;
}

function defautsDe(niveau: Element | undefined, palette: Palette, polices: PolicesDuTheme): DefautsDeTexte {
  const r = niveau ? enfant(niveau, NS.a, "defRPr") : undefined;
  if (!r) return {};
  const plein = enfant(r, NS.a, "solidFill");
  const couleur = plein ? lireCouleur(elementsEnfants(plein)[0], palette) : undefined;
  const taille = entier(r, "sz");
  const b = r.getAttribute("b");
  const latin = police(enfant(r, NS.a, "latin")?.getAttribute("typeface"), polices);
  return {
    ...(taille ? { taille } : {}), ...(couleur ? { couleur } : {}), ...(b ? { gras: b === "1" || b === "true" } : {}),
    ...(latin ? { police: latin } : {}),
  };
}

const fusion = (...d: DefautsDeTexte[]): DefautsDeTexte => Object.assign({}, ...[...d].reverse());

export function stylesDuMasque(paquet: Paquet, masque: string | undefined): StylesDuMasque {
  const palette = paletteDuMasque(paquet, masque);
  const theme = masque ? paquet.relation(masque, "theme")?.cible : undefined;
  const lst = theme ? chemin(paquet.racine(theme), ["a:themeElements", "a:fmtScheme", "a:lnStyleLst"]) : undefined;
  const fontes = theme ? chemin(paquet.racine(theme), ["a:themeElements", "a:fontScheme"]) : undefined;
  const polices: PolicesDuTheme = {
    mineure: (fontes && chemin(fontes, ["a:minorFont", "a:latin"])?.getAttribute("typeface")) || "Calibri",
    majeure: (fontes && chemin(fontes, ["a:majorFont", "a:latin"])?.getAttribute("typeface")) || "Calibri Light",
  };
  const largeurs = lst ? enfants(lst, NS.a, "ln").map((l) => entier(l, "w") ?? 9525) : [];
  const pres = chemin(paquet.racine("ppt/presentation.xml"), ["p:defaultTextStyle", "a:lvl1pPr"]);
  const styles = masque ? chemin(paquet.racine(masque), ["p:txStyles"]) : undefined;
  const base = fusion(defautsDe(pres, palette, polices), { police: polices.mineure });
  return {
    palette,
    polices,
    largeurs,
    autre: fusion(defautsDe(styles && chemin(styles, ["p:otherStyle", "a:lvl1pPr"]), palette, polices), base),
    corps: fusion(defautsDe(styles && chemin(styles, ["p:bodyStyle", "a:lvl1pPr"]), palette, polices), base),
  };
}

const vrai = (v: string | null) => v === "1" || v === "true";

function traitDe(ln: Element | undefined, ref: Element | undefined, m: StylesDuMasque): Trait | null {
  const idx = entier(ref, "idx") ?? 0;
  const couleurRef = ref && idx > 0 ? lireCouleur(elementsEnfants(ref)[0], m.palette) : undefined;
  const direct = ln ? couleurDeRemplissage(ln, m.palette) : undefined;
  const couleur: Fond = direct ?? couleurRef ?? "aucun";
  if (couleur === "aucun") return null;
  const largeur = entier(ln, "w") ?? (idx > 0 ? m.largeurs[idx - 1] : undefined) ?? 9525;
  const tirets = ln ? enfant(ln, NS.a, "prstDash")?.getAttribute("val") : undefined;
  const debut = ln ? enfant(ln, NS.a, "headEnd")?.getAttribute("type") : undefined;
  const fin = ln ? enfant(ln, NS.a, "tailEnd")?.getAttribute("type") : undefined;
  return {
    couleur, largeur,
    ...(tirets && tirets !== "solid" ? { tirets } : {}),
    ...(debut && debut !== "none" ? { debut } : {}),
    ...(fin && fin !== "none" ? { fin } : {}),
  };
}

function fondDe(spPr: Element | undefined, ref: Element | undefined, m: StylesDuMasque, fondDeGroupe: Fond | undefined): Fond {
  if (spPr && enfant(spPr, NS.a, "grpFill")) return fondDeGroupe ?? "aucun";
  if (spPr && enfant(spPr, NS.a, "blipFill")) return "aucun";
  const direct = couleurDeRemplissage(spPr, m.palette);
  if (direct) return direct;
  const idx = entier(ref, "idx") ?? 0;
  return (ref && idx > 0 ? lireCouleur(elementsEnfants(ref)[0], m.palette) : undefined) ?? "aucun";
}

/** Les propriétés de caractère lues sur un `rPr` ou un `defRPr`. */
function caracteres(r: Element | undefined, palette: Palette, polices: PolicesDuTheme): { taille?: number; gras?: boolean; italique?: boolean; souligne?: boolean; couleur?: Couleur; police?: string } {
  if (!r) return {};
  const plein = enfant(r, NS.a, "solidFill");
  const couleur = plein ? lireCouleur(elementsEnfants(plein)[0], palette) : undefined;
  const taille = entier(r, "sz");
  const [b, i, u] = [r.getAttribute("b"), r.getAttribute("i"), r.getAttribute("u")];
  const latin = police(enfant(r, NS.a, "latin")?.getAttribute("typeface"), polices);
  return {
    ...(taille ? { taille } : {}), ...(couleur ? { couleur } : {}), ...(latin ? { police: latin } : {}),
    ...(b ? { gras: vrai(b) } : {}), ...(i ? { italique: vrai(i) } : {}), ...(u ? { souligne: u !== "none" } : {}),
  };
}

const memeStyle = (a: Fragment, b: Fragment) =>
  a.taille === b.taille && a.police === b.police && a.gras === b.gras && a.italique === b.italique && a.souligne === b.souligne
  && a.couleur.rgb === b.couleur.rgb && a.couleur.alpha === b.couleur.alpha;

const MARGES_PAR_DEFAUT = [91440, 45720, 91440, 45720] as const;

/** Un `txBody` (ou le corps d'une cellule) résolu ; `base` = défauts hérités (police de `p:style`, masque). */
export function corpsDe(txBody: Element, base: DefautsDeTexte, m: StylesDuMasque, marges?: readonly [number, number, number, number], ancrage?: string): Corps {
  const palette = m.palette;
  const bodyPr = enfant(txBody, NS.a, "bodyPr");
  const niveau = chemin(txBody, ["a:lstStyle", "a:lvl1pPr"]);
  const liste = caracteres(niveau ? enfant(niveau, NS.a, "defRPr") : undefined, palette, m.polices);
  const echelle = bodyPr ? entier(chemin(bodyPr, ["a:normAutofit"]), "fontScale") ?? 100000 : 100000;
  const paragraphes = enfants(txBody, NS.a, "p").map((p): Paragraphe => {
    const fragments: Fragment[] = [];
    const ajouter = (texte: string, r: Element | undefined) => {
      const c = { ...liste, ...caracteres(r, palette, m.polices) };
      const f: Fragment = {
        texte,
        taille: c.taille ?? base.taille ?? 1800,
        police: c.police ?? base.police ?? m.polices.mineure,
        ...((c.gras ?? base.gras) ? { gras: true as const } : {}),
        ...(c.italique ? { italique: true as const } : {}),
        ...(c.souligne ? { souligne: true as const } : {}),
        couleur: c.couleur ?? base.couleur ?? { rgb: palette.get("tx1") ?? "000000" },
      };
      const prec = fragments[fragments.length - 1];
      if (prec && memeStyle(prec, f)) fragments[fragments.length - 1] = { ...prec, texte: prec.texte + texte };
      else fragments.push(f);
    };
    for (const c of elementsEnfants(p)) {
      if (c.localName === "r" || c.localName === "fld") ajouter(enfant(c, NS.a, "t")?.textContent ?? "", enfant(c, NS.a, "rPr"));
      else if (c.localName === "br") ajouter("\n", enfant(c, NS.a, "rPr"));
    }
    if (!fragments.length) ajouter("", enfant(p, NS.a, "endParaRPr"));
    const pPr = enfant(p, NS.a, "pPr");
    const niveau = entier(pPr, "lvl") ?? 0;
    const duNiveau = chemin(txBody, ["a:lstStyle", `a:lvl${niveau + 1}pPr`]);
    const retrait = entier(pPr, "marL") ?? entier(duNiveau, "marL");
    return {
      alignement: pPr?.getAttribute("algn") || "l", fragments, niveau,
      puce: puceDe(pPr) ?? puceDe(duNiveau) ?? "heritee",
      ...((): { car?: string } => { const c = (pPr && enfant(pPr, NS.a, "buChar")) ?? (duNiveau && enfant(duNiveau, NS.a, "buChar")); const v = c?.getAttribute("char"); return v ? { car: v } : {}; })(),
      ...(retrait !== null && retrait !== undefined ? { retrait } : {}),
    };
  });
  const retraits = marges ?? ([
    entier(bodyPr, "lIns") ?? MARGES_PAR_DEFAUT[0], entier(bodyPr, "tIns") ?? MARGES_PAR_DEFAUT[1],
    entier(bodyPr, "rIns") ?? MARGES_PAR_DEFAUT[2], entier(bodyPr, "bIns") ?? MARGES_PAR_DEFAUT[3],
  ] as const);
  return {
    ancrage: ancrage ?? bodyPr?.getAttribute("anchor") ?? "t",
    marges: retraits,
    retour: bodyPr?.getAttribute("wrap") !== "none",
    echelle,
    paragraphes,
  };
}

const nombre = (v: string | null) => (v !== null && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null);

/** Une `a:custGeom` en chemins SVG ; `null` si un point passe par un guide (formule non évaluée). */
function cheminsLibres(custGeom: Element, ext: readonly [number, number]): CheminLibre[] | null {
  const liste = chemin(custGeom, ["a:pathLst"]);
  if (!liste) return [];
  const out: CheminLibre[] = [];
  for (const path of enfants(liste, NS.a, "path")) {
    const largeur = entier(path, "w") ?? ext[0];
    const hauteur = entier(path, "h") ?? ext[1];
    const parts: string[] = [];
    let cur: [number, number] = [0, 0];
    for (const c of elementsEnfants(path)) {
      const pts = enfants(c, NS.a, "pt").map((pt) => [nombre(pt.getAttribute("x")), nombre(pt.getAttribute("y"))] as const);
      if (pts.some(([x, y]) => x === null || y === null)) return null;
      const xy = pts.map(([x, y]) => `${x} ${y}`);
      if (c.localName === "moveTo") parts.push(`M${xy[0]}`);
      else if (c.localName === "lnTo") parts.push(`L${xy[0]}`);
      else if (c.localName === "cubicBezTo") parts.push(`C${xy.join(" ")}`);
      else if (c.localName === "quadBezTo") parts.push(`Q${xy.join(" ")}`);
      else if (c.localName === "close") parts.push("Z");
      else if (c.localName === "arcTo") {
        const wR = nombre(c.getAttribute("wR"));
        const hR = nombre(c.getAttribute("hR"));
        const st = nombre(c.getAttribute("stAng"));
        const sw = nombre(c.getAttribute("swAng"));
        if (wR === null || hR === null || st === null || sw === null) return null;
        const a0 = (st / 60000) * (Math.PI / 180);
        const a1 = ((st + sw) / 60000) * (Math.PI / 180);
        const cx = cur[0] - wR * Math.cos(a0);
        const cy = cur[1] - hR * Math.sin(a0);
        const fin: [number, number] = [Math.round(cx + wR * Math.cos(a1)), Math.round(cy + hR * Math.sin(a1))];
        parts.push(`A${wR} ${hR} 0 ${Math.abs(sw) > 10800000 ? 1 : 0} ${sw > 0 ? 1 : 0} ${fin[0]} ${fin[1]}`);
        cur = fin;
        continue;
      }
      const dernier = pts[pts.length - 1];
      if (dernier) cur = [dernier[0]!, dernier[1]!];
    }
    out.push({
      largeur, hauteur, d: parts.join(""),
      remplir: path.getAttribute("fill") !== "none",
      tracer: !["0", "false"].includes(path.getAttribute("stroke") ?? ""),
    });
  }
  return out;
}

export interface ContexteDeStyle {
  readonly masque: StylesDuMasque;
  readonly fondDeGroupe?: Fond;
}

/** Le style d'un `p:sp`, `p:cxnSp` ou `p:pic` (le texte des espaces réservés prend les défauts du corps du masque). */
export function styleDe(el: Element, ctx: ContexteDeStyle, espace: boolean): Style {
  const m = ctx.masque;
  const spPr = enfant(el, NS.p, "spPr");
  const st = enfant(el, NS.p, "style");
  const ref = (nom: string) => (st ? enfant(st, NS.a, nom) : undefined);
  const xfrm = spPr ? enfant(spPr, NS.a, "xfrm") : undefined;
  const rotation = entier(xfrm, "rot") ?? 0;
  const [h, v] = [vrai(xfrm?.getAttribute("flipH") ?? null), vrai(xfrm?.getAttribute("flipV") ?? null)];
  const prst = spPr ? enfant(spPr, NS.a, "prstGeom") : undefined;
  const gd = prst ? chemin(prst, ["a:avLst"]) : undefined;
  const ajustements: Record<string, number> = {};
  for (const g of gd ? enfants(gd, NS.a, "gd") : []) {
    const val = (g.getAttribute("fmla") ?? "").match(/^val\s+(-?\d+)$/);
    if (val) ajustements[g.getAttribute("name") ?? ""] = Number(val[1]);
  }
  const libre = spPr ? enfant(spPr, NS.a, "custGeom") : undefined;
  const ext = xfrm ? enfant(xfrm, NS.a, "ext") : undefined;
  const chemins = libre ? cheminsLibres(libre, [entier(ext, "cx") ?? 0, entier(ext, "cy") ?? 0]) : undefined;
  const txBody = enfant(el, NS.p, "txBody");
  const refPolice = ref("fontRef");
  const couleurPolice = refPolice ? lireCouleur(elementsEnfants(refPolice)[0], m.palette) : undefined;
  const policeRef = refPolice?.getAttribute("idx") === "major" ? m.polices.majeure : refPolice?.getAttribute("idx") === "minor" ? m.polices.mineure : undefined;
  const base = { ...(espace ? m.corps : m.autre), ...(couleurPolice ? { couleur: couleurPolice } : {}), ...(policeRef ? { police: policeRef } : {}) };
  const trait = el.localName === "pic" && !(spPr && enfant(spPr, NS.a, "ln")) ? null : traitDe(spPr ? enfant(spPr, NS.a, "ln") : undefined, ref("lnRef"), m);
  return {
    // Une image peut avoir un remplissage direct, sous ses transparences (l'aplat d'un pictogramme, PKG-B6).
    fond: el.localName === "sp" ? fondDe(spPr, ref("fillRef"), m, ctx.fondDeGroupe) : el.localName === "pic" ? couleurDeRemplissage(spPr, m.palette) ?? "aucun" : "aucun",
    trait,
    ...(rotation ? { rotation } : {}),
    ...(h || v ? { retournement: h && v ? "hv" as const : h ? "h" as const : "v" as const } : {}),
    ...(Object.keys(ajustements).length ? { ajustements } : {}),
    ...(chemins ? { chemins } : {}),
    ...(txBody ? { corps: corpsDe(txBody, base, m) } : {}),
  };
}

const BORDS = ["lnT", "lnR", "lnB", "lnL"] as const;

/** La grille d'un `a:tbl` : colonnes, hauteurs, cellules (sans le style de tableau nommé : seules les propriétés directes). */
export function grilleDe(tbl: Element, ctx: ContexteDeStyle): Grille {
  const m = ctx.masque;
  const colonnes = enfants(chemin(tbl, ["a:tblGrid"]) ?? tbl, NS.a, "gridCol").map((g) => entier(g, "w") ?? 0);
  const lignes = enfants(tbl, NS.a, "tr");
  return {
    colonnes,
    hauteurs: lignes.map((tr) => entier(tr, "h") ?? 0),
    cellules: lignes.map((tr) => enfants(tr, NS.a, "tc").map((tc): Cellule => {
      const pr = enfant(tc, NS.a, "tcPr");
      const marges = [entier(pr, "marL") ?? 91440, entier(pr, "marT") ?? 45720, entier(pr, "marR") ?? 91440, entier(pr, "marB") ?? 45720] as const;
      const corps = enfant(tc, NS.a, "txBody");
      const vide: Corps = { ancrage: "t", marges, retour: true, echelle: 100000, paragraphes: [] };
      return {
        fond: couleurDeRemplissage(pr, m.palette) ?? "aucun",
        bords: BORDS.map((b) => {
          const ln = pr ? enfant(pr, NS.a, b) : undefined;
          return ln ? traitDe(ln, undefined, m) : null;
        }) as unknown as Cellule["bords"],
        corps: corps ? corpsDe(corps, m.autre, m, marges, pr?.getAttribute("anchor") ?? "t") : vide,
      };
    })),
  };
}
