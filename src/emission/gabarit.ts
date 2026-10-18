// Le gabarit du PPT de validation, généré du thème du procédé (PKG-C) : un thème Office dont les douze emplacements de couleur
// et les polices viennent de ses jetons et de son identité (les seules valeurs hex du PPT), un masque, une disposition par figure.
// Le masque des decks hérités n'est ni repris ni retouché.
import { FIGURES, type Figure } from "../pivot/seance-spec";
import { EMU, ESPACES, FIGURES_A_CAPTURE, disposition } from "./grammaire";
import { ARBRE_VIDE, ENTETE, XMLNS, paragraphe, relations, x, xfrm } from "./xml";

export type Region = readonly [number, number, number, number];

const M = 457200;
export const TITRE: Region = [M, 320040, EMU.largeur - 2 * M, 777240];
const Y = 1280160;
const H = EMU.hauteur - Y - M;
const COLONNE_X = 8046720;
const COLONNE_L = EMU.largeur - M - COLONNE_X;

/** Les régions d'une diapositive : à capture (la capture à gauche, consignes et texte à droite) ou à texte. */
export const REGIONS = {
  capture: {
    visuels: [M, Y, COLONNE_X - M - 182880, H] as Region,
    consignes: [COLONNE_X, Y, COLONNE_L, 2926080] as Region,
    contenu: [COLONNE_X, Y + 2926080 + 91440, COLONNE_L, H - 2926080 - 91440] as Region,
  },
  texte: {
    contenu: [M, Y, EMU.largeur - 2 * M, H] as Region,
    /** Quand la diapositive porte des visuels : le texte à gauche, les visuels à droite. */
    contenuEtroit: [M, Y, 6949440, H] as Region,
    visuels: [M + 6949440 + 182880, Y, EMU.largeur - M - (M + 6949440 + 182880), H] as Region,
    consignes: [COLONNE_X, Y, COLONNE_L, H] as Region,
  },
} as const;

/** Les couleurs du thème Office, lues dans les jetons du thème. */
export interface Palette {
  readonly encre: string; readonly papier: string; readonly marine: string; readonly surface: string;
  readonly ciel: string; readonly vert: string; readonly ambre: string; readonly rouge: string; readonly gris: string; readonly brique: string;
}

export function paletteDesJetons(jetons: string): Palette {
  const lire = (nom: string) => {
    const m = jetons.match(new RegExp(`--c-${nom}\\s*:\\s*#([0-9a-fA-F]{6})`));
    if (!m) throw new Error(`jeton absent du thème : --c-${nom}`);
    return m[1]!.toUpperCase();
  };
  return {
    encre: lire("ink"), papier: lire("paper"), marine: lire("navy"), surface: lire("surface"), ciel: lire("sky"),
    vert: lire("ok"), ambre: lire("warn"), rouge: lire("red-logo"), gris: lire("grey"), brique: lire("brick"),
  };
}

const srgb = (v: string) => `<a:srgbClr val="${v}"/>`;

/**
 * Le thème Office : dk1 encre, lt1 papier, dk2 marine, lt2 surface ; accents marine, ciel, vert, ambre, rouge, gris. Il porte
 * le nom du thème (« <nom> · Graduis », et « (notes) » pour celui des pages de notes) et sa police.
 */
export function theme(p: Palette, identite: { readonly nom: string; readonly police: string }, notes = false): string {
  const nom = `${identite.nom} · Graduis${notes ? " (notes)" : ""}`;
  const schema = x(identite.nom);
  const police = x(identite.police);
  const remplissages = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3);
  const traits = [6350, 12700, 19050].map((w) => `<a:ln w="${w}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>`).join("");
  const effets = "<a:effectStyle><a:effectLst/></a:effectStyle>".repeat(3);
  return `${ENTETE}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${x(nom)}"><a:themeElements>`
    + `<a:clrScheme name="${schema}"><a:dk1>${srgb(p.encre)}</a:dk1><a:lt1>${srgb(p.papier)}</a:lt1><a:dk2>${srgb(p.marine)}</a:dk2><a:lt2>${srgb(p.surface)}</a:lt2>`
    + `<a:accent1>${srgb(p.marine)}</a:accent1><a:accent2>${srgb(p.ciel)}</a:accent2><a:accent3>${srgb(p.vert)}</a:accent3><a:accent4>${srgb(p.ambre)}</a:accent4>`
    + `<a:accent5>${srgb(p.rouge)}</a:accent5><a:accent6>${srgb(p.gris)}</a:accent6><a:hlink>${srgb(p.marine)}</a:hlink><a:folHlink>${srgb(p.brique)}</a:folHlink></a:clrScheme>`
    + `<a:fontScheme name="${schema}"><a:majorFont><a:latin typeface="${police}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${police}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>`
    + `<a:fmtScheme name="${schema}"><a:fillStyleLst>${remplissages}</a:fillStyleLst><a:lnStyleLst>${traits}</a:lnStyleLst><a:effectStyleLst>${effets}</a:effectStyleLst><a:bgFillStyleLst>${remplissages}</a:bgFillStyleLst></a:fmtScheme>`
    + "</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>";
}

const CLR_MAP = 'bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"';

/** Un espace réservé de disposition ou de masque. */
function espace(id: number, nom: string, ph: string, region: Region, lstStyle = "", invite = "", bodyPr = '<a:bodyPr><a:normAutofit/></a:bodyPr>'): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${x(nom)}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr>`
    + `<p:spPr>${xfrm(region)}</p:spPr><p:txBody>${bodyPr}<a:lstStyle>${lstStyle}</a:lstStyle>${paragraphe(invite)}</p:txBody></p:sp>`;
}

const PH_TITRE = '<p:ph type="title"/>';
const PH_CONTENU = `<p:ph type="body" idx="${ESPACES.contenu}"/>`;
const PH_CONSIGNES = `<p:ph type="body" idx="${ESPACES.consignes}"/>`;

/** Les consignes : une liste numérotée (chaque paragraphe émis porte son numéro de pas). */
export const STYLE_CONSIGNES = '<a:lvl1pPr marL="342900" indent="-342900"><a:spcBef><a:spcPts val="600"/></a:spcBef><a:buClr><a:schemeClr val="accent5"/></a:buClr><a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/><a:defRPr sz="1400"/></a:lvl1pPr>';

export function masque(nombreDeDispositions: number): { xml: string; rels: string } {
  const niveaux = (base: number) => Array.from({ length: 9 }, (_, i) => `<a:lvl${i + 1}pPr marL="${i * 342900}" indent="0" algn="l" defTabSz="914400"><a:spcBef><a:spcPts val="600"/></a:spcBef><a:buNone/><a:defRPr sz="${Math.max(1200, base - i * 200)}" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl${i + 1}pPr>`).join("");
  const xml = `${ENTETE}<p:sldMaster ${XMLNS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${ARBRE_VIDE}`
    + espace(2, "Titre", PH_TITRE, TITRE, "", "Titre", '<a:bodyPr anchor="b"><a:normAutofit/></a:bodyPr>')
    + espace(3, "Contenu", '<p:ph type="body" idx="1"/>', REGIONS.texte.contenu, "", "Texte")
    + `</p:spTree></p:cSld><p:clrMap ${CLR_MAP}/><p:sldLayoutIdLst>`
    + Array.from({ length: nombreDeDispositions }, (_, i) => `<p:sldLayoutId id="${2147483649 + i}" r:id="rId${i + 1}"/>`).join("")
    + "</p:sldLayoutIdLst><p:txStyles>"
    + '<p:titleStyle><a:lvl1pPr algn="l" defTabSz="914400"><a:lnSpc><a:spcPct val="90000"/></a:lnSpc><a:spcBef><a:spcPct val="0"/></a:spcBef><a:buNone/><a:defRPr sz="2800" b="1" kern="1200"><a:solidFill><a:schemeClr val="tx2"/></a:solidFill><a:latin typeface="+mj-lt"/><a:ea typeface="+mj-ea"/><a:cs typeface="+mj-cs"/></a:defRPr></a:lvl1pPr></p:titleStyle>'
    + `<p:bodyStyle>${niveaux(1800)}</p:bodyStyle><p:otherStyle>${niveaux(1800)}</p:otherStyle></p:txStyles></p:sldMaster>`;
  const rels = relations([
    ...Array.from({ length: nombreDeDispositions }, (_, i) => ({ id: `rId${i + 1}`, type: "slideLayout", cible: `../slideLayouts/slideLayout${i + 1}.xml` })),
    { id: `rId${nombreDeDispositions + 1}`, type: "theme", cible: "../theme/theme1.xml" },
  ]);
  return { xml, rels };
}

/** Les régions d'une figure : à capture ou à texte. */
export const regionsDe = (f: Figure) => (FIGURES_A_CAPTURE.has(f) ? REGIONS.capture : REGIONS.texte);

export function dispositionXml(f: Figure): string {
  const r = regionsDe(f);
  return `${ENTETE}<p:sldLayout ${XMLNS} preserve="1" userDrawn="1"><p:cSld name="${x(disposition(f))}"><p:spTree>${ARBRE_VIDE}`
    + espace(2, "Titre", PH_TITRE, TITRE, "", "Titre")
    + espace(3, "Contenu", PH_CONTENU, r.contenu, "", "Un paragraphe par texte")
    + espace(4, "Consignes", PH_CONSIGNES, r.consignes, STYLE_CONSIGNES, "Une consigne par pas, dans l'ordre des pastilles")
    + "</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>";
}

export const DISPOSITIONS: readonly Figure[] = FIGURES;

export function masqueDeNotes(): { xml: string; rels: string } {
  const xml = `${ENTETE}<p:notesMaster ${XMLNS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${ARBRE_VIDE}`
    + `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Image de la diapositive"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr>${xfrm([381000, 685800, 6096000, 3429000])}<a:noFill/><a:ln w="12700"><a:solidFill><a:prstClr val="black"/></a:solidFill></a:ln></p:spPr></p:sp>`
    + `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr>${xfrm([685800, 4343400, 5486400, 4114800])}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${paragraphe("")}</p:txBody></p:sp>`
    + `</p:spTree></p:cSld><p:clrMap ${CLR_MAP}/><p:notesStyle><a:lvl1pPr marL="0" algn="l" defTabSz="914400"><a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr></p:notesStyle></p:notesMaster>`;
  return { xml, rels: relations([{ id: "rId1", type: "theme", cible: "../theme/theme2.xml" }]) };
}

export const PRES_PROPS = `${ENTETE}<p:presentationPr ${XMLNS}/>`;
export const VIEW_PROPS = `${ENTETE}<p:viewPr ${XMLNS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="80000"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`;
export const TABLE_STYLES = `${ENTETE}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`;
