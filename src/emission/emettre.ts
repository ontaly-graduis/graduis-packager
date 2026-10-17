// `emettre` : pivot → PPT de validation (PKG-C). Une diapositive par bloc, à la disposition de sa figure ; le titre, les
// textes, les consignes dans leurs espaces réservés ; les captures et visuels, rognés comme à l'origine ; les pas en
// pastilles numérotées et zones posées sur leur capture ; les tableaux en tableaux natifs ; les notes ; l'identité du
// bloc en étiquettes OOXML. Aucune couleur en dur : les formes ne citent que les couleurs du thème (I-PKG-6).
// Le paquet est déterministe : même pivot, mêmes octets.
import { strToU8, zipSync, type Zippable } from "fflate";
import { stringify2 } from "../lib/json";
import type { Bloc, Pas, SeanceSpec } from "../pivot/seance-spec";
import {
  DISPOSITIONS, PRES_PROPS, REGIONS, STYLE_CONSIGNES, TABLE_STYLES, TITRE, VIEW_PROPS,
  dispositionXml, masque, masqueDeNotes, paletteDesJetons, theme, type Region,
} from "./gabarit";
import { EMU, ESPACES, ETIQUETTES, FIGURES_A_CAPTURE, NOMS, PROPRIETES, SUFFIXES_DE_ZONE } from "./grammaire";
import { ARBRE_VIDE, ENTETE, XMLNS, paragraphe, relations, x, xfrm } from "./xml";

export interface MediaDEmission {
  readonly ext: string;
  readonly octets: Uint8Array;
  /** Largeur et hauteur en pixels, quand elles se lisent (sinon, 4:3). */
  readonly px: readonly [number, number] | null;
}

export interface OptionsDEmission {
  /** Les jetons du thème (le CSS du DS Onet) : les seules valeurs de couleur du PPT. */
  readonly jetons: string;
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

/** Les régions d'une diapositive : à capture si sa figure l'est ou si elle porte des pas, sinon à texte. */
function disposer(b: Bloc): { visuels: Region; contenu: Region; consignes: Region } {
  if (FIGURES_A_CAPTURE.has(b.figure) || b.pas.length) return REGIONS.capture;
  const t = REGIONS.texte;
  return b.visuels.length ? { visuels: t.visuels, contenu: t.contenuEtroit, consignes: t.consignes } : { visuels: t.visuels, contenu: t.contenu, consignes: t.consignes };
}

interface Medias {
  readonly parties: Map<string, { chemin: string; octets: Uint8Array; ext: string }>;
}

function diapositive(b: Bloc, n: number, o: OptionsDEmission, medias: Medias): { slide: Partie; rels: Partie; notes: Partie; notesRels: Partie; tags: Partie } {
  const d = new Diapositive();
  d.rel("slideLayout", `../slideLayouts/slideLayout${DISPOSITIONS.indexOf(b.figure) + 1}.xml`);
  d.rel("notesSlide", `../notesSlides/notesSlide${n}.xml`);
  const rTags = d.rel("tags", `../tags/tag${n}.xml`);
  const r = disposer(b);
  if (b.titre !== null) espaceTexte(d, "Titre", '<p:ph type="title"/>', TITRE, b.titre.split("\n").map((l) => paragraphe(l)).join(""), '<a:bodyPr anchor="b"><a:normAutofit/></a:bodyPr>');

  // Les visuels, rognés, dans leur région ; on garde le cadre de chaque capture pour y poser les zones.
  const vus = b.visuels.map((v) => ({ v, m: o.media(v.media) }));
  const boites = cadres(r.visuels, vus.map(({ v, m }) => rapportDe(m?.px ?? null, v.rognage)));
  const cadreDe = new Map<string, Region>();
  vus.forEach(({ v, m }, i) => {
    const boite = boites[i]!;
    if (!cadreDe.has(v.media)) cadreDe.set(v.media, boite);
    if (!m) throw new Error(`média absent : ${v.media}`);
    if (!medias.parties.has(v.media)) {
      const ext = m.ext.toLowerCase();
      medias.parties.set(v.media, { chemin: `ppt/media/${v.media.slice(7, 23)}.${ext}`, octets: m.octets, ext });
    }
    const rId = d.rel("image", `../media/${medias.parties.get(v.media)!.chemin.split("/").pop()}`);
    const rognage = v.rognage ? `<a:srcRect l="${v.rognage[0]}" t="${v.rognage[1]}" r="${v.rognage[2]}" b="${v.rognage[3]}"/>` : "";
    d.formes.push(`<p:pic><p:nvPicPr><p:cNvPr id="${d.suivant()}" name="${v.capture ? NOMS.capture : NOMS.visuel}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>`
      + `<p:blipFill><a:blip r:embed="${rId}"/>${rognage}<a:stretch><a:fillRect/></a:stretch></p:blipFill>`
      + `<p:spPr>${xfrm(boite)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`);
  });

  // Les textes : un paragraphe par texte ; les tableaux sous eux, ou à leur place.
  const contenu = r.contenu;
  if (b.textes.length) {
    const region: Region = b.tableaux.length ? [contenu[0], contenu[1], contenu[2], Math.round(contenu[3] * 0.4)] : contenu;
    espaceTexte(d, "Contenu", `<p:ph type="body" idx="${ESPACES.contenu}"/>`, region, b.textes.map((t) => paragraphe(t)).join(""));
  }
  if (b.tableaux.length) {
    const y0 = b.textes.length ? contenu[1] + Math.round(contenu[3] * 0.4) + 91440 : contenu[1];
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

  const slide = `${ENTETE}<p:sld ${XMLNS}${b.masquee ? ' show="0"' : ""}><p:cSld><p:spTree>${ARBRE_VIDE}${d.formes.join("")}</p:spTree>`
    + `<p:custDataLst><p:tags r:id="${rTags}"/></p:custDataLst></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  const lectures = { ...(b.dessin ? { dessin: b.dessin } : {}), ...(b.structure ? { structure: b.structure } : {}), ...(b.composition ? { composition: b.composition } : {}) };
  const tags = `${ENTETE}<p:tagLst ${XMLNS}><p:tag name="${ETIQUETTES.bloc}" val="${b.id}"/><p:tag name="${ETIQUETTES.source}" val="${b.source.diapo}"/>`
    + (Object.keys(lectures).length ? `<p:tag name="${ETIQUETTES.lectures}" val="${x(JSON.stringify(lectures))}"/>` : "") + "</p:tagLst>";
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
  const palette = paletteDesJetons(o.jetons);
  const medias: Medias = { parties: new Map() };
  const parties: Partie[] = [];
  const diapos = blocs.map((b, i) => diapositive(b, i + 1, o, medias));
  for (const d of diapos) parties.push(d.slide, d.rels, d.notes, d.notesRels, d.tags);

  const m = masque(DISPOSITIONS.length);
  parties.push({ chemin: "ppt/slideMasters/slideMaster1.xml", xml: m.xml }, { chemin: "ppt/slideMasters/_rels/slideMaster1.xml.rels", xml: m.rels });
  DISPOSITIONS.forEach((f, i) => {
    parties.push({ chemin: `ppt/slideLayouts/slideLayout${i + 1}.xml`, xml: dispositionXml(f) });
    parties.push({ chemin: `ppt/slideLayouts/_rels/slideLayout${i + 1}.xml.rels`, xml: relations([{ id: "rId1", type: "slideMaster", cible: "../slideMasters/slideMaster1.xml" }]) });
  });
  const nm = masqueDeNotes();
  parties.push({ chemin: "ppt/notesMasters/notesMaster1.xml", xml: nm.xml }, { chemin: "ppt/notesMasters/_rels/notesMaster1.xml.rels", xml: nm.rels });
  parties.push({ chemin: "ppt/theme/theme1.xml", xml: theme(palette) }, { chemin: "ppt/theme/theme2.xml", xml: theme(palette, "Onet · Graduis (notes)") });
  parties.push({ chemin: "ppt/presProps.xml", xml: PRES_PROPS }, { chemin: "ppt/viewProps.xml", xml: VIEW_PROPS }, { chemin: "ppt/tableStyles.xml", xml: TABLE_STYLES });

  const presentation = `${ENTETE}<p:presentation ${XMLNS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>`
    + '<p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst>'
    + `<p:sldIdLst>${blocs.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 10}"/>`).join("")}</p:sldIdLst>`
    + `<p:sldSz cx="${EMU.largeur}" cy="${EMU.hauteur}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  parties.push({ chemin: "ppt/presentation.xml", xml: presentation });
  parties.push({ chemin: "ppt/_rels/presentation.xml.rels", xml: relations([
    { id: "rId1", type: "slideMaster", cible: "slideMasters/slideMaster1.xml" },
    { id: "rId2", type: "notesMaster", cible: "notesMasters/notesMaster1.xml" },
    { id: "rId3", type: "presProps", cible: "presProps.xml" },
    { id: "rId4", type: "viewProps", cible: "viewProps.xml" },
    { id: "rId5", type: "theme", cible: "theme/theme1.xml" },
    { id: "rId6", type: "tableStyles", cible: "tableStyles.xml" },
    ...blocs.map((_, i) => ({ id: `rId${i + 10}`, type: "slide", cible: `slides/slide${i + 1}.xml` })),
  ]) });

  const proprietes = [[PROPRIETES.nom, spec.source.nom], [PROPRIETES.empreinte, spec.source.empreinte]] as const;
  parties.push({ chemin: "docProps/custom.xml", xml: `${ENTETE}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">${proprietes.map(([k, v], i) => `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${i + 2}" name="${x(k)}"><vt:lpwstr>${x(v)}</vt:lpwstr></property>`).join("")}</Properties>` });
  parties.push({ chemin: "docProps/app.xml", xml: `${ENTETE}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Graduis Packager</Application><Slides>${blocs.length}</Slides></Properties>` });
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
    ...blocs.flatMap((_, i) => [
      [`/ppt/slides/slide${i + 1}.xml`, `${PML}.slide+xml`],
      [`/ppt/notesSlides/notesSlide${i + 1}.xml`, `${PML}.notesSlide+xml`],
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
