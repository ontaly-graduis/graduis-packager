// `emettre` : pivot → PPT de validation (PKG-C). Une diapositive par bloc, à la disposition de sa figure ; le titre, les
// textes, les consignes dans leurs espaces réservés ; les captures et visuels, rognés comme à l'origine ; les pas en
// pastilles numérotées et zones posées sur leur capture ; les tableaux en tableaux natifs ; les schémas en formes natives
// (leur composition éditable, le dessin d'origine en annexe masquée, PKG-C3) ; les notes ; l'identité du bloc en
// étiquettes OOXML. Aucune couleur en dur : les formes ne citent que les couleurs du thème (I-PKG-6).
// Le paquet est déterministe : même pivot, mêmes octets.
import { strToU8, zipSync, type Zippable } from "fflate";
import { stringify2 } from "../lib/json";
import type { Bloc, Pas, SeanceSpec } from "../pivot/seance-spec";
import {
  DISPOSITIONS, PRES_PROPS, REGIONS, STYLE_CONSIGNES, TABLE_STYLES, TITRE, VIEW_PROPS,
  dispositionXml, masque, masqueDeNotes, paletteDesJetons, theme, type Region,
} from "./gabarit";
import { ANNEXE, EMU, ESPACES, ETIQUETTES, FIGURES_A_CAPTURE, LIBELLES_DE_ROLE, NOMS, PROPRIETES, SUFFIXES_DE_ZONE, couleurDeRole, nomDeSchema } from "./grammaire";
import { ARBRE_VIDE, ENTETE, XMLNS, paragraphe, relations, x, xfrm } from "./xml";
import { cadreXml, disposerStructure } from "./structure";
import { blipXml, groupeXml, placer, type ContexteDeDessin } from "./dessin";
import { compositionXml } from "./composition";
import type { Theme } from "../theme/theme";

export interface MediaDEmission {
  readonly ext: string;
  readonly octets: Uint8Array;
  /** Largeur et hauteur en pixels, quand elles se lisent (sinon, 4:3). */
  readonly px: readonly [number, number] | null;
}

export interface OptionsDEmission {
  /** Le thème : ses jetons (les seules valeurs de couleur du PPT), son nom et sa police (le thème Office). */
  readonly theme: Pick<Theme, "jetons" | "nom" | "police">;
  readonly media: (hash: string) => MediaDEmission | undefined;
}

const TYPES_D_IMAGE: Readonly<Record<string, string>> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff",
  emf: "image/x-emf", wmf: "image/x-wmf", svg: "image/svg+xml", wdp: "image/vnd.ms-photo",
};

const PASTILLE = 274320;
const ZONE_TRAIT = 28575;

/** Les cadres de `n` visuels dans une région : côte à côte (ou empilés si la région est haute), chacun à son rapport. */
function cadres(region: Region, rapports: readonly number[]): Region[] {
  const n = rapports.length;
  if (!n) return [];
  const [rx, ry, rw, rh] = region;
  const ecart = 182880;
  const empiles = rh > rw && n > 1;
  return rapports.map((r, i) => {
    const cw = empiles ? rw : (rw - ecart * (n - 1)) / n;
    const ch = empiles ? (rh - ecart * (n - 1)) / n : rh;
    const cx = empiles ? rx : rx + i * (cw + ecart);
    const cy = empiles ? ry + i * (ch + ecart) : ry;
    const [w, h] = cw / ch > r ? [ch * r, ch] : [cw, cw / r];
    return [Math.round(cx + (cw - w) / 2), Math.round(cy + (ch - h) / 2), Math.round(w), Math.round(h)] as const;
  });
}

/** Le rapport largeur / hauteur d'un visuel tel qu'affiché, rognage compris. */
function rapportDe(px: readonly [number, number] | null, rognage?: readonly [number, number, number, number]): number {
  const [w, h] = px ?? [4, 3];
  const [l, t, r, b] = rognage ?? [0, 0, 0, 0];
  const lw = w * (1 - (l + r) / 100000);
  const lh = h * (1 - (t + b) / 100000);
  return lw > 0 && lh > 0 ? lw / lh : 4 / 3;
}

interface Partie { readonly chemin: string; readonly xml: string }

class Diapositive {
  private id = 1;
  readonly formes: string[] = [];
  readonly rels: { id: string; type: string; cible: string }[] = [];
  suivant(): number { return ++this.id; }
  rel(type: string, cible: string): string {
    const id = `rId${this.rels.length + 1}`;
    this.rels.push({ id, type, cible });
    return id;
  }
}

function espaceTexte(d: Diapositive, nom: string, ph: string, region: Region, paragraphes: string, bodyPr = '<a:bodyPr><a:normAutofit/></a:bodyPr>'): void {
  d.formes.push(`<p:sp><p:nvSpPr><p:cNvPr id="${d.suivant()}" name="${x(nom)}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr>`
    + `<p:spPr>${xfrm(region)}</p:spPr><p:txBody>${bodyPr}<a:lstStyle/>${paragraphes}</p:txBody></p:sp>`);
}

function pastille(d: Diapositive, numero: number, b: Region): void {
  d.formes.push(`<p:sp><p:nvSpPr><p:cNvPr id="${d.suivant()}" name="${NOMS.pastille}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr>${xfrm(b)}<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent5"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>`
    + '<p:txBody><a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"><a:noAutofit/></a:bodyPr><a:lstStyle/>'
    + paragraphe(String(numero), '<a:pPr algn="ctr"/>', '<a:rPr lang="fr-FR" sz="1100" b="1" dirty="0"><a:solidFill><a:schemeClr val="bg1"/></a:solidFill></a:rPr>')
    + "</p:txBody></p:sp>");
}

function zone(d: Diapositive, ancrage: Pas["ancrage"], b: Region): void {
  const proposee = ancrage === "proposee";
  const nom = NOMS.zone + SUFFIXES_DE_ZONE[ancrage ?? "repere"];
  d.formes.push(`<p:sp><p:nvSpPr><p:cNvPr id="${d.suivant()}" name="${x(nom)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr>${xfrm(b)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>`
    + `<a:ln w="${ZONE_TRAIT}"><a:solidFill><a:schemeClr val="${proposee ? "accent4" : "accent5"}"/></a:solidFill>${proposee ? '<a:prstDash val="dash"/>' : ""}</a:ln></p:spPr></p:sp>`);
}

function tableau(d: Diapositive, lignes: readonly (readonly string[])[], b: Region): void {
  const colonnes = Math.max(1, ...lignes.map((l) => l.length));
  const largeur = Math.floor(b[2] / colonnes);
  const hauteur = Math.max(320040, Math.floor(b[3] / Math.max(1, lignes.length)));
  const tr = lignes.map((l) => `<a:tr h="${hauteur}">${Array.from({ length: colonnes }, (_, j) => {
    const t = l[j];
    const corps = t === undefined ? paragraphe("") : t.split("\n").map((p) => paragraphe(p, "", '<a:rPr lang="fr-FR" sz="1200" dirty="0"/>')).join("");
    return `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${corps}</a:txBody><a:tcPr/></a:tc>`;
  }).join("")}</a:tr>`).join("");
  d.formes.push(`<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${d.suivant()}" name="${NOMS.tableau}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>`
    + `<p:xfrm><a:off x="${b[0]}" y="${b[1]}"/><a:ext cx="${largeur * colonnes}" cy="${hauteur * lignes.length}"/></p:xfrm>`
    + '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId></a:tblPr>'
    + `<a:tblGrid>${`<a:gridCol w="${largeur}"/>`.repeat(colonnes)}</a:tblGrid>${tr}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`);
}

/** Un schéma dessiné ou recomposé (PKG-C3) : il prend toute la place sous le titre, ses visuels (l'icône de section) en tête. */
const schematique = (b: Bloc) => b.figure === "schema" && (b.dessin !== undefined || b.composition !== undefined);
const MARGE = 457200;
const REGION_SCHEMA: Region = [MARGE, 1280160, EMU.largeur - 2 * MARGE, EMU.hauteur - 1280160 - 228600];
const VISUELS_DE_SCHEMA: Region = [EMU.largeur - MARGE - 731520, 320040, 731520, 731520];

/** Les régions d'une diapositive : à capture si sa figure l'est ou si elle porte des pas, sinon à texte. */
function disposer(b: Bloc): { visuels: Region; contenu: Region; consignes: Region } {
  if (schematique(b)) return { visuels: VISUELS_DE_SCHEMA, contenu: REGION_SCHEMA, consignes: REGIONS.texte.consignes };
  if (FIGURES_A_CAPTURE.has(b.figure) || b.pas.length) return REGIONS.capture;
  const t = REGIONS.texte;
  return b.visuels.length ? { visuels: t.visuels, contenu: t.contenuEtroit, consignes: t.consignes } : { visuels: t.visuels, contenu: t.contenu, consignes: t.consignes };
}

interface Medias {
  readonly parties: Map<string, { chemin: string; octets: Uint8Array; ext: string }>;
}

/** Une image de la diapositive : le média enregistré une fois dans le paquet, une relation par emploi. */
function image(d: Diapositive, medias: Medias, o: OptionsDEmission, hash: string): { rId: string; svg: boolean } {
  const m = o.media(hash);
  if (!m) throw new Error(`média absent : ${hash}`);
  if (!medias.parties.has(hash)) {
    const ext = m.ext.toLowerCase();
    medias.parties.set(hash, { chemin: `ppt/media/${hash.slice(7, 23)}.${ext}`, octets: m.octets, ext });
  }
  const partie = medias.parties.get(hash)!;
  return { rId: d.rel("image", `../media/${partie.chemin.split("/").pop()}`), svg: partie.ext === "svg" };
}

const contexteDe = (d: Diapositive, medias: Medias, o: OptionsDEmission): ContexteDeDessin => ({ id: () => d.suivant(), image: (h) => image(d, medias, o, h) });

/** Les parties d'une diapositive émise. */
interface Parties { readonly slide: Partie; readonly rels: Partie; readonly notes?: Partie; readonly notesRels?: Partie; readonly tags: Partie }

const etiquettesXml = (t: readonly (readonly [string, string])[]) => `${ENTETE}<p:tagLst ${XMLNS}>${t.map(([k, v]) => `<p:tag name="${k}" val="${x(v)}"/>`).join("")}</p:tagLst>`;

const diapositiveXml = (d: Diapositive, rTags: string, masquee: boolean) => `${ENTETE}<p:sld ${XMLNS}${masquee ? ' show="0"' : ""}><p:cSld><p:spTree>${ARBRE_VIDE}${d.formes.join("")}</p:spTree>`
  + `<p:custDataLst><p:tags r:id="${rTags}"/></p:custDataLst></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;

/**
 * La diapositive annexe d'un schéma recomposé : masquée, à la suite, le dessin d'origine tel que relevé, étiqueté
 * « Pour contrôle uniquement ». `lire` le rattache à son bloc ; elle n'est pas un bloc.
 */
function annexe(b: Bloc, n: number, o: OptionsDEmission, medias: Medias): Parties {
  const d = new Diapositive();
  d.rel("slideLayout", `../slideLayouts/slideLayout${DISPOSITIONS.indexOf("schema") + 1}.xml`);
  const rTags = d.rel("tags", `../tags/tag${n}.xml`);
  espaceTexte(d, "Titre", '<p:ph type="title"/>', TITRE, paragraphe(`${b.titre ?? b.id}${ANNEXE.suffixeDeTitre}`), '<a:bodyPr anchor="b"><a:normAutofit/></a:bodyPr>');
  const dessin = b.dessin!;
  d.formes.push(...groupeXml(nomDeSchema(dessin.partition), "schéma", dessin, placer(dessin.cadre, REGION_SCHEMA).place, contexteDe(d, medias, o)));
  const l = 2743200;
  d.formes.push(`<p:sp><p:nvSpPr><p:cNvPr id="${d.suivant()}" name="${NOMS.etiquette}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr>${xfrm([EMU.largeur - MARGE - l, 91440, l, 320040])}<a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill>${couleurDeRole("ambre-fort")}</a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>`
    + '<p:txBody><a:bodyPr wrap="none" lIns="91440" tIns="0" rIns="91440" bIns="0" anchor="ctr"><a:noAutofit/></a:bodyPr><a:lstStyle/>'
    + paragraphe(ANNEXE.etiquette, '<a:pPr algn="ctr"/>', `<a:rPr lang="fr-FR" sz="1200" b="1" dirty="0"><a:solidFill>${couleurDeRole("encre")}</a:solidFill></a:rPr>`)
    + "</p:txBody></p:sp>");
  return {
    slide: { chemin: `ppt/slides/slide${n}.xml`, xml: diapositiveXml(d, rTags, true) },
    rels: { chemin: `ppt/slides/_rels/slide${n}.xml.rels`, xml: relations(d.rels) },
    tags: { chemin: `ppt/tags/tag${n}.xml`, xml: etiquettesXml([[ETIQUETTES.annexe, b.id]]) },
  };
}

function diapositive(b: Bloc, n: number, o: OptionsDEmission, medias: Medias): Parties {
  const d = new Diapositive();
  d.rel("slideLayout", `../slideLayouts/slideLayout${DISPOSITIONS.indexOf(b.figure) + 1}.xml`);
  d.rel("notesSlide", `../notesSlides/notesSlide${n}.xml`);
  const rTags = d.rel("tags", `../tags/tag${n}.xml`);
  const r0 = disposer(b);
  // Un texte organisé : ses colonnes en cadres, leurs illustrations à leur gauche ; les autres visuels à droite.
  const illustrations = new Set(b.structure?.rangees.flatMap((x) => x.colonnes.flatMap((c) => (c.visuel ? [c.visuel] : []))) ?? []);
  const horsColonnes = b.visuels.filter((v) => !illustrations.has(v.media));
  const r = b.structure && !horsColonnes.length && !FIGURES_A_CAPTURE.has(b.figure) && !b.pas.length ? { ...r0, contenu: REGIONS.texte.contenu } : r0;
  const cadresDeStructure = b.structure
    ? disposerStructure(b.structure, r.contenu, (h) => { const m = o.media(h); const v = b.visuels.find((x) => x.media === h); return rapportDe(m?.px ?? null, v?.rognage); })
    : [];
  // Les places d'illustration, par média, dans l'ordre des colonnes (une même icône peut illustrer deux fiches).
  const placesDIllustration = new Map<string, Region[]>();
  for (const c of cadresDeStructure) if (c.illustration) placesDIllustration.set(c.illustration.media, [...(placesDIllustration.get(c.illustration.media) ?? []), c.illustration.boite]);
  const placeDIllustration = { has: (h: string) => placesDIllustration.has(h), prendre: (h: string) => placesDIllustration.get(h)?.shift() };
  if (b.titre !== null) espaceTexte(d, "Titre", '<p:ph type="title"/>', TITRE, b.titre.split("\n").map((l) => paragraphe(l)).join(""), '<a:bodyPr anchor="b"><a:normAutofit/></a:bodyPr>');

  // Les visuels, rognés, dans leur région ; on garde le cadre de chaque capture pour y poser les zones.
  const vus = b.visuels.map((v) => ({ v, m: o.media(v.media) }));
  const reserve = new Map([...placesDIllustration].map(([h, l]) => [h, l.length]));
  const estIllustration = vus.map(({ v }) => { const n = reserve.get(v.media) ?? 0; if (n > 0) { reserve.set(v.media, n - 1); return true; } return false; });
  const enRegion = vus.filter((_, i) => !estIllustration[i]);
  const boitesEnRegion = cadres(r.visuels, enRegion.map(({ v, m }) => rapportDe(m?.px ?? null, v.rognage)));
  const cadreDe = new Map<string, Region>();
  let k = 0;
  vus.forEach(({ v, m }, i) => {
    const boite = (estIllustration[i] ? placeDIllustration.prendre(v.media) : undefined) ?? boitesEnRegion[k++]!;
    if (!cadreDe.has(v.media)) cadreDe.set(v.media, boite);
    if (!m) throw new Error(`média absent : ${v.media}`);
    const { rId, svg } = image(d, medias, o, v.media);
    const rognage = v.rognage ? `<a:srcRect l="${v.rognage[0]}" t="${v.rognage[1]}" r="${v.rognage[2]}" b="${v.rognage[3]}"/>` : "";
    // Le rôle dans le nom, la légende en texte de remplacement, l'aplat d'origine en remplissage (couleur du thème).
    const nom = (v.capture ? NOMS.capture : NOMS.visuel) + (v.role ? ` · ${LIBELLES_DE_ROLE[v.role]}` : "");
    const descr = v.legende !== undefined ? ` descr="${x(v.legende)}"` : "";
    // Une image vectorielle : PowerPoint la lit dans l'extension SVG de son blip (comme le deck d'origine).
    const blip = blipXml(rId, svg);
    const fond = v.fond ? `<a:solidFill>${couleurDeRole(v.fond)}</a:solidFill>` : "";
    d.formes.push(`<p:pic><p:nvPicPr><p:cNvPr id="${d.suivant()}" name="${x(nom)}"${descr}/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>`
      + `<p:blipFill>${blip}${rognage}<a:stretch><a:fillRect/></a:stretch></p:blipFill>`
      + `<p:spPr>${xfrm(boite)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fond}</p:spPr></p:pic>`);
  });

  // Un schéma : sa composition en formes éditables, ou son dessin en groupe ; ses textes et tableaux s'en dérivent.
  const contenu = r.contenu;
  if (schematique(b)) {
    const ctx = contexteDe(d, medias, o);
    if (b.composition) d.formes.push(...compositionXml(b.composition, contenu, ctx));
    else d.formes.push(...groupeXml(nomDeSchema(b.dessin!.partition), "schéma", b.dessin!, placer(b.dessin!.cadre, contenu).place, ctx));
  }

  // Les textes : un paragraphe par texte ; les tableaux sous eux, ou à leur place.
  for (const c of cadresDeStructure) d.formes.push(cadreXml(d.suivant(), c, xfrm));
  if (b.textes.length && !b.structure && !schematique(b)) {
    const region: Region = b.tableaux.length ? [contenu[0], contenu[1], contenu[2], Math.round(contenu[3] * 0.4)] : contenu;
    espaceTexte(d, "Contenu", `<p:ph type="body" idx="${ESPACES.contenu}"/>`, region, b.textes.map((t) => paragraphe(t)).join(""));
  }
  if (b.tableaux.length && !schematique(b)) {
    const y0 = b.textes.length && !b.structure ? contenu[1] + Math.round(contenu[3] * 0.4) + 91440 : contenu[1];
    const h = contenu[1] + contenu[3] - y0;
    const hk = Math.floor(h / b.tableaux.length);
    b.tableaux.forEach((t, k) => tableau(d, t, [contenu[0], y0 + k * hk, contenu[2], hk - 91440]));
  }

  // Les pas : zone posée sur sa capture, pastille à son coin ; sans zone, la pastille sur la capture ou dans la marge.
  const libres = new Map<string, number>();
  b.pas.forEach((p, k) => {
    const c = p.capture ? cadreDe.get(p.capture) : undefined;
    if (p.capture && !c) throw new Error(`${b.id} : le pas ${p.numero} cite une capture absente des visuels`);
    if (c && p.zone) {
      const [zx, zy, zw, zh] = p.zone;
      const zb: Region = [Math.round(c[0] + (zx / 100) * c[2]), Math.round(c[1] + (zy / 100) * c[3]), Math.round((zw / 100) * c[2]), Math.round((zh / 100) * c[3])];
      zone(d, p.ancrage, zb);
      pastille(d, p.numero, [zb[0] - PASTILLE / 2, zb[1] - PASTILLE / 2, PASTILLE, PASTILLE]);
    } else if (c) {
      const i = libres.get(p.capture!) ?? 0;
      libres.set(p.capture!, i + 1);
      pastille(d, p.numero, [c[0] + 45720 + i * (PASTILLE + 45720), c[1] + 45720, PASTILLE, PASTILLE]);
    } else {
      pastille(d, p.numero, [91440, 1280160 + k * (PASTILLE + 45720), PASTILLE, PASTILLE]);
    }
  });
  if (b.pas.length) {
    const paras = b.pas.map((p) => paragraphe(p.consigne ?? "", `<a:pPr><a:buAutoNum type="arabicPeriod" startAt="${p.numero}"/></a:pPr>`)).join("");
    espaceTexte(d, "Consignes", `<p:ph type="body" idx="${ESPACES.consignes}"/>`, r.consignes, paras);
  }

  const slide = diapositiveXml(d, rTags, b.masquee === true);
  const tags = etiquettesXml([[ETIQUETTES.bloc, b.id], [ETIQUETTES.source, String(b.source.diapo)]]);
  const notes = `${ENTETE}<p:notes ${XMLNS}><p:cSld><p:spTree>${ARBRE_VIDE}`
    + '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Image de la diapositive"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>'
    + `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${(b.notes === "" ? [""] : b.notes.split("\n")).map((l) => paragraphe(l)).join("")}</p:txBody></p:sp>`
    + "</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>";
  return {
    slide: { chemin: `ppt/slides/slide${n}.xml`, xml: slide },
    rels: { chemin: `ppt/slides/_rels/slide${n}.xml.rels`, xml: relations(d.rels) },
    notes: { chemin: `ppt/notesSlides/notesSlide${n}.xml`, xml: notes },
    notesRels: { chemin: `ppt/notesSlides/_rels/notesSlide${n}.xml.rels`, xml: relations([{ id: "rId1", type: "notesMaster", cible: "../notesMasters/notesMaster1.xml" }, { id: "rId2", type: "slide", cible: `../slides/slide${n}.xml` }]) },
    tags: { chemin: `ppt/tags/tag${n}.xml`, xml: tags },
  };
}

/** Pivot → PPT de validation (octets d'un .pptx). */
export function emettre(spec: SeanceSpec, o: OptionsDEmission): Uint8Array {
  const blocs = spec.sequences.flatMap((s) => s.blocs);
  const palette = paletteDesJetons(o.theme.jetons);
  const medias: Medias = { parties: new Map() };
  const parties: Partie[] = [];
  // Un bloc, une diapositive ; un schéma recomposé, sa diapositive annexe à la suite.
  const diapos: Parties[] = [];
  for (const b of blocs) {
    diapos.push(diapositive(b, diapos.length + 1, o, medias));
    if (schematique(b) && b.composition && b.dessin) diapos.push(annexe(b, diapos.length + 1, o, medias));
  }
  for (const d of diapos) parties.push(...[d.slide, d.rels, d.notes, d.notesRels, d.tags].filter((p): p is Partie => p !== undefined));

  const m = masque(DISPOSITIONS.length);
  parties.push({ chemin: "ppt/slideMasters/slideMaster1.xml", xml: m.xml }, { chemin: "ppt/slideMasters/_rels/slideMaster1.xml.rels", xml: m.rels });
  DISPOSITIONS.forEach((f, i) => {
    parties.push({ chemin: `ppt/slideLayouts/slideLayout${i + 1}.xml`, xml: dispositionXml(f) });
    parties.push({ chemin: `ppt/slideLayouts/_rels/slideLayout${i + 1}.xml.rels`, xml: relations([{ id: "rId1", type: "slideMaster", cible: "../slideMasters/slideMaster1.xml" }]) });
  });
  const nm = masqueDeNotes();
  parties.push({ chemin: "ppt/notesMasters/notesMaster1.xml", xml: nm.xml }, { chemin: "ppt/notesMasters/_rels/notesMaster1.xml.rels", xml: nm.rels });
  parties.push({ chemin: "ppt/theme/theme1.xml", xml: theme(palette, o.theme) }, { chemin: "ppt/theme/theme2.xml", xml: theme(palette, o.theme, true) });
  parties.push({ chemin: "ppt/presProps.xml", xml: PRES_PROPS }, { chemin: "ppt/viewProps.xml", xml: VIEW_PROPS }, { chemin: "ppt/tableStyles.xml", xml: TABLE_STYLES });

  const presentation = `${ENTETE}<p:presentation ${XMLNS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>`
    + '<p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst>'
    + `<p:sldIdLst>${diapos.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 10}"/>`).join("")}</p:sldIdLst>`
    + `<p:sldSz cx="${EMU.largeur}" cy="${EMU.hauteur}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  parties.push({ chemin: "ppt/presentation.xml", xml: presentation });
  parties.push({ chemin: "ppt/_rels/presentation.xml.rels", xml: relations([
    { id: "rId1", type: "slideMaster", cible: "slideMasters/slideMaster1.xml" },
    { id: "rId2", type: "notesMaster", cible: "notesMasters/notesMaster1.xml" },
    { id: "rId3", type: "presProps", cible: "presProps.xml" },
    { id: "rId4", type: "viewProps", cible: "viewProps.xml" },
    { id: "rId5", type: "theme", cible: "theme/theme1.xml" },
    { id: "rId6", type: "tableStyles", cible: "tableStyles.xml" },
    ...diapos.map((_, i) => ({ id: `rId${i + 10}`, type: "slide", cible: `slides/slide${i + 1}.xml` })),
  ]) });

  const proprietes = [[PROPRIETES.nom, spec.source.nom], [PROPRIETES.empreinte, spec.source.empreinte]] as const;
  parties.push({ chemin: "docProps/custom.xml", xml: `${ENTETE}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">${proprietes.map(([k, v], i) => `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${i + 2}" name="${x(k)}"><vt:lpwstr>${x(v)}</vt:lpwstr></property>`).join("")}</Properties>` });
  parties.push({ chemin: "docProps/app.xml", xml: `${ENTETE}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Graduis Packager</Application><Slides>${diapos.length}</Slides></Properties>` });
  parties.push({ chemin: "docProps/core.xml", xml: `${ENTETE}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${x(spec.source.nom.replace(/\.pptx$/i, ""))} — PPT de validation</dc:title><dc:creator>Graduis Packager</dc:creator></cp:coreProperties>` });
  parties.push({ chemin: "_rels/.rels", xml: relations([
    { id: "rId1", type: "officeDocument", cible: "ppt/presentation.xml" },
    { id: "rId2", type: "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", cible: "docProps/core.xml" },
    { id: "rId3", type: "extended-properties", cible: "docProps/app.xml" },
    { id: "rId4", type: "custom-properties", cible: "docProps/custom.xml" },
  ]) });

  const PML = "application/vnd.openxmlformats-officedocument.presentationml";
  const surcharges: [string, string][] = [
    ["/ppt/presentation.xml", `${PML}.presentation.main+xml`],
    ["/ppt/slideMasters/slideMaster1.xml", `${PML}.slideMaster+xml`],
    ["/ppt/notesMasters/notesMaster1.xml", `${PML}.notesMaster+xml`],
    ["/ppt/theme/theme1.xml", "application/vnd.openxmlformats-officedocument.theme+xml"],
    ["/ppt/theme/theme2.xml", "application/vnd.openxmlformats-officedocument.theme+xml"],
    ["/ppt/presProps.xml", `${PML}.presProps+xml`],
    ["/ppt/viewProps.xml", `${PML}.viewProps+xml`],
    ["/ppt/tableStyles.xml", `${PML}.tableStyles+xml`],
    ["/docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml"],
    ["/docProps/app.xml", "application/vnd.openxmlformats-officedocument.extended-properties+xml"],
    ["/docProps/custom.xml", "application/vnd.openxmlformats-officedocument.custom-properties+xml"],
    ...DISPOSITIONS.map((_, i) => [`/ppt/slideLayouts/slideLayout${i + 1}.xml`, `${PML}.slideLayout+xml`] as [string, string]),
    ...diapos.flatMap((d, i) => [
      [`/ppt/slides/slide${i + 1}.xml`, `${PML}.slide+xml`],
      ...(d.notes ? [[`/ppt/notesSlides/notesSlide${i + 1}.xml`, `${PML}.notesSlide+xml`]] : []),
      [`/ppt/tags/tag${i + 1}.xml`, `${PML}.tags+xml`],
    ] as [string, string][]),
  ];
  const extensions = [...new Set([...medias.parties.values()].map((m) => m.ext))].sort();
  const types = `${ENTETE}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
    + extensions.map((e) => `<Default Extension="${e}" ContentType="${TYPES_D_IMAGE[e] ?? "application/octet-stream"}"/>`).join("")
    + surcharges.map(([p, t]) => `<Override PartName="${p}" ContentType="${t}"/>`).join("") + "</Types>";

  // Un zip déterministe : parties dans un ordre fixe, date fixe.
  const date = new Date(Date.UTC(2026, 0, 1));
  const zip: Zippable = { "[Content_Types].xml": [strToU8(types), { mtime: date }] };
  for (const p of parties.sort((a, b) => (a.chemin < b.chemin ? -1 : a.chemin > b.chemin ? 1 : 0))) zip[p.chemin] = [strToU8(p.xml), { mtime: date }];
  for (const m of [...medias.parties.values()].sort((a, b) => (a.chemin < b.chemin ? -1 : 1))) zip[m.chemin] = [m.octets, { mtime: date, level: 0 }];
  return zipSync(zip, { level: 6 });
}

/** Pour les témoins : la sérialisation d'un pivot (ordre des clés fixé par le schéma). */
export const serialiser = (s: SeanceSpec) => stringify2(s);
