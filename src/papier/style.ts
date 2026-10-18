// La feuille du papier : A4 portrait, la feuille de la salle reprise (compositions, schémas, structures) et ramenée aux
// corps de l'imprimé — jetons du thème seulement (I-PKG-6). Les règles de page sont posées par le lecteur (une par séquence).
import { styleDeSalle } from "../salle/style";

/** Le facteur des compositions (cas, tableau) sur papier : leurs textes autour de 9 pt ; elles s'allongent sur la page. */
const ECHELLE_COMPOSITION = 0.7;

const STYLE_PROPRE = `
html,body{height:auto;overflow:visible;background:var(--color-background)}
body{margin:0;color:var(--text-body);font-family:var(--font-base);font-size:10pt;line-height:1.42;-webkit-print-color-adjust:exact;print-color-adjust:exact}
#feuille{width:178mm;margin:0 auto}
@media screen{body{background:var(--color-surface)}#feuille{background:var(--color-background);padding:0}}
h1,h2,h3{color:var(--text-strong);font-weight:var(--fw-bold);break-after:avoid}
.etiquette{font-size:8pt;letter-spacing:.12em;text-transform:uppercase;color:var(--text-secondary);font-weight:var(--fw-semibold)}
/* La garde : pleine page, sans marges. */
.garde{page:garde;position:relative;width:210mm;height:297mm;margin-left:-16mm;display:flex;flex-direction:column;break-after:page;overflow:hidden}
.garde-haut{padding:28mm 22mm 12mm;display:flex;flex-direction:column;gap:6mm}
.garde .logo{display:block;height:16mm}
.garde h1{margin:4mm 0 0;font-size:34pt;line-height:1.05}
.garde .sous-titres{list-style:none;margin:0;padding:0;font-size:13pt;line-height:1.5;color:var(--text-secondary)}
.garde .extrait{margin:2mm 0 0;font-size:12pt;font-weight:var(--fw-semibold);color:var(--text-strong);border-left:var(--filet-width) solid var(--color-primary);padding-left:4mm}
.garde-photo{flex:1;min-height:0;margin:0 22mm 14mm;overflow:hidden}
.garde-photo img{display:block;width:100%;height:100%;object-fit:cover}
.garde::after{content:"";display:block;flex:none;height:9mm;margin-top:auto;background:var(--color-primary)}
.garde-photo+*{margin-top:0}
/* Le sommaire, paginé à la seconde passe. */
.sommaire{break-after:page}
.sommaire h2{font-size:20pt;margin:0 0 8mm}
.sommaire ol{list-style:none;margin:0;padding:0}
.sommaire li{border-bottom:var(--border-hairline)}
.sommaire a{display:grid;grid-template-columns:10mm minmax(0,1fr) 12mm;gap:3mm;align-items:baseline;padding:2.6mm 0;color:var(--text-strong);text-decoration:none;font-size:11pt}
.sommaire .num{font-weight:var(--fw-bold);color:var(--color-badge-step)}
.sommaire .p{text-align:right;font-variant-numeric:tabular-nums;color:var(--text-secondary)}
/* Une séquence : son intercalaire en page d'ouverture, ses blocs, une page « Mes notes ». */
.sequence{break-before:page}
.intercalaire{min-height:200mm;display:flex;flex-direction:column;justify-content:center;gap:5mm;border-left:3mm solid var(--color-primary);padding-left:10mm;break-after:page}
.intercalaire .etiquette{font-size:11pt;color:var(--color-badge-step)}
.intercalaire h2{margin:0;font-size:26pt;line-height:1.1}
.titre-sequence{margin:0 0 6mm;font-size:20pt}
.intercalaire .filet{width:40mm;height:1.5mm;background:var(--color-button)}
.liste.sommaire-sequence{list-style:none;margin:2mm 0 0;padding:0;font-size:12pt;line-height:1.6;color:var(--text-secondary)}
.liste.sommaire-sequence li{padding:0;margin:0}
.liste.sommaire-sequence li::before{display:none}
.bloc{margin:0 0 9mm}
.titre-bloc{margin:0 0 3.5mm;font-size:13pt;line-height:1.25;border-left:var(--filet-width) solid var(--color-primary);padding-left:3mm}
.bloc.f-pas-a-pas,.bloc.f-capture,.bloc.f-schema,.bloc.f-mise-en-pratique,.bloc.f-etapes-cles,.bloc.f-demonstration,.bloc.f-objectifs{break-inside:avoid}
/* Les listes, textes organisés et tableaux aux corps de l'imprimé. */
.liste{font-size:10pt;line-height:1.42}
.liste li{padding-left:5mm;margin-bottom:1.6mm}
.liste li::before{left:.6mm;top:.5em;width:1.6mm;height:1.6mm}
.liste.numerotee li{padding-left:8mm;min-height:6mm}
.liste.numerotee li::before{width:5.5mm;height:5.5mm;top:-.2mm;font-size:8pt}
.liste.legende{font-size:8.5pt}
.liste.commentaire{margin:0 0 3mm;font-size:9.5pt;color:var(--text-secondary)}
.liste.commentaire li::before{background:var(--color-border)}
/* Le glossaire, une table de correspondance : les termes vont par paires, ligne à ligne. */
.liste.glossaire{display:grid;grid-template-columns:1fr 1fr;column-gap:8mm;font-size:9pt}
.liste.glossaire li{break-inside:avoid;border-bottom:var(--border-hairline);padding:1.2mm 0 1.2mm 4mm;margin:0}
.encadre .ce-qui-est-montre{margin:0;font-weight:var(--fw-semibold);color:var(--text-strong)}
.structure{gap:5mm}
.rangee{gap:5mm}
.flux{font-size:10pt}
.flux.fiche,.fiche-illustree{box-shadow:none;border:var(--border-hairline);border-top:var(--filet-width) solid var(--color-primary)}
.fiche-illustree{grid-template-columns:22mm minmax(0,1fr)}
.fiche-illustree .illustration{width:22mm;max-height:28mm;padding:3mm 0 3mm 3mm}
.flux .def{grid-template-columns:minmax(28mm,30%) minmax(0,1fr)}
.flux .intertitre::after{height:.8mm}
.flux li,.liste li{break-inside:avoid}
.tableau{font-size:8.5pt;margin:2mm 0;break-inside:auto}
.tableau th{padding:1.6mm 2.4mm}
.tableau td{padding:1.4mm 2.4mm}
.tableau tr{break-inside:avoid}
/* Les encadrés : objectifs, mise en pratique, étapes clés, démonstration, renvoi. */
.encadre{background:var(--color-surface);border-left:var(--filet-width) solid var(--color-primary);padding:3.5mm 5mm;display:flex;flex-direction:column;gap:2.5mm}
.encadre.pratique{border-left-color:var(--color-badge-step)}
.encadre.pratique .etiquette{color:var(--color-badge-step)}
.encadre .aide,.encadre .duree{margin:0;font-size:9pt;color:var(--text-secondary)}
.encadre .titre-renvoi{margin:0;font-weight:var(--fw-semibold);color:var(--text-strong)}
/* Les captures : pleine largeur, toutes les zones numérotées ; les consignes dessous. */
.capture{box-shadow:none;border:var(--border-hairline);margin:0 auto 3mm}
.zone{border-width:.6mm;border-radius:1mm;box-shadow:none}
.zone .num{left:-2.6mm;top:-2.6mm;width:5.2mm;height:5.2mm;font-size:7.5pt}
.consignes-papier{list-style:none;margin:0;padding:0;font-size:10pt;line-height:1.38}
.consignes-papier li{display:grid;grid-template-columns:5.6mm minmax(0,1fr);gap:2.6mm;margin-bottom:1.8mm;break-inside:avoid}
.consignes-papier .num{width:5.6mm;height:5.6mm;border-radius:50%;background:var(--color-badge-step);color:var(--text-on-primary);font-size:7.5pt;font-weight:var(--fw-bold);display:grid;place-items:center}
/* Les schémas : le dessin à la largeur de la page, les compositions à leur échelle d'imprimé. */
.schema-papier{width:100%}
.schema-papier .schema{display:block;width:100%;height:auto;flex:none}
.schema-papier .dessin{display:block;width:100%;height:100%}
.schema-papier .cas,.schema-papier .tab{--echelle:${ECHELLE_COMPOSITION};flex:none}
.schema-papier .cas-colonne::after{display:none}
.schema-papier .cas-colonnes,.schema-papier .tab-grille{margin-top:0}
.schema-papier .cas-legende{gap:1.5mm 6mm;margin:0}
.schema-papier .cas-legende li{gap:2mm}
.schema-papier .tab-texte,.schema-papier .cas-texte{overflow-wrap:anywhere}
/* « Mes notes » : une page lignée. */
.notes-papier{break-before:page;break-after:page}
.notes-papier h3{margin:0 0 4mm;font-size:13pt}
.notes-papier .lignes{height:228mm;background:repeating-linear-gradient(to bottom,transparent 0,transparent calc(9mm - .25mm),var(--color-border) calc(9mm - .25mm),var(--color-border) 9mm)}
.annexes{break-before:page}
.annexes>h2{font-size:20pt;margin:0 0 6mm}
.annexes .bloc{break-inside:auto}
`;

/** La feuille de la salle (les compositions), au nom de son thème, puis celle du papier, qui l'emporte. */
export const styleDePapier = (nom: string) => styleDeSalle(nom) + STYLE_PROPRE;
