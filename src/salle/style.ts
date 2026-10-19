// La feuille de la salle : scène 1920 × 1080, compositions par figure, présentateur — jetons du thème seulement.
import { ROLES } from "../pivot/seance-spec";
import { ROLES_SOMBRES } from "../qualification/roles";

/** Les schémas redessinés (le nom du thème signe sa manière) : un rôle de couleur → remplissage (f-), trait (s-), texte (c-), d'après `--dessin-<rôle>` du thème. */
const styleDuDessin = (nom: string) => `
.f-schema .corps.centre{justify-content:center;align-items:stretch}
.schema{flex:1;min-height:0;width:100%;display:flex}
.dessin{width:100%;height:100%;overflow:visible;font-family:var(--font-base)}
.dessin .sans-fond{fill:none}
.dessin .sans-trait{stroke:none}
.dessin path{stroke-linejoin:round}
.dessin foreignObject{overflow:visible}
.dessin .bt{width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-start;font-size:0;line-height:1.18;--ajuste:1}
.dessin .bt.a-milieu{justify-content:center}
.dessin .bt.a-bas{justify-content:flex-end}
.dessin .bt p{margin:0}
.dessin .bt.coupe p{overflow-wrap:anywhere}
.dessin .bt.sans-retour p{white-space:pre}
.dessin .bt span{font-size:calc(var(--t) * var(--ajuste) * 1px);font-weight:var(--fw-regular)}
.dessin .bt .g{font-weight:var(--fw-bold)}
.dessin .bt .i{font-style:italic}
.dessin .bt .u{text-decoration:underline}
.dessin .al-centre{text-align:center}
.dessin .al-droite{text-align:right}
.dessin .al-justifie{text-align:justify}
${ROLES.map((r) => `.dessin .f-${r}{fill:var(--dessin-${r})}.dessin .s-${r}{stroke:var(--dessin-${r})}.dessin .c-${r}{color:var(--dessin-${r})}`).join("\n")}
.dessin .pastille{fill:var(--color-badge-step);stroke:none}
.dessin .bt-pastille span{color:var(--text-on-primary);font-weight:var(--fw-bold)}
.dessin .pas-cache{visibility:hidden}
.dessin .trace path{animation:aplatIn var(--mvt-temps) var(--courbe-douce) both;animation-delay:calc(var(--apres-titre,0s) + var(--r) * var(--mvt-decalage) + var(--mvt-entree) * .45)}
.dessin .trace path[pathLength]{stroke-dasharray:1;animation:traitIn calc(var(--mvt-entree) * 1.4) linear both,aplatIn var(--mvt-temps) var(--courbe-douce) both;animation-delay:calc(var(--apres-titre,0s) + var(--r) * var(--mvt-decalage)),calc(var(--apres-titre,0s) + var(--r) * var(--mvt-decalage) + var(--mvt-entree) * .45)}
.dessin .trace foreignObject,.dessin .trace image{animation:fonduIn var(--mvt-temps) var(--courbe-douce) both;animation-delay:calc(var(--apres-titre,0s) + var(--r) * var(--mvt-decalage) + var(--mvt-entree) * .7)}
@keyframes traitIn{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
/* Le gabarit « cas » : colonnes en regard, bandeau numéroté, étapes numérotées à leur manière, légende. Angles droits (DS ${nom}).
   Tout se dimensionne sur --echelle, que le lecteur resserre (jusqu'à 70 %) pour que le cas tienne dans sa page. */
.cas{--k:var(--echelle,1);flex:1 1 auto;display:flex;flex-direction:column;gap:calc(22px * var(--k));width:100%;min-height:0}
.cas-colonnes{margin-top:auto;display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:calc(40px * var(--k));align-items:start}
.cas-colonne{position:relative;display:flex;flex-direction:column;gap:calc(10px * var(--k));min-height:0}
.cas-colonne:not(:last-child)::after{content:"";position:absolute;right:-27px;top:calc(26px * var(--k));width:14px;height:14px;border-top:4px solid var(--color-accent);border-right:4px solid var(--color-accent);transform:rotate(45deg)}
.cas-colonne.cache{visibility:hidden}
.cas-tete{display:flex;align-items:center;gap:calc(14px * var(--k));min-height:calc(66px * var(--k));padding:calc(10px * var(--k)) calc(16px * var(--k));font-size:calc(23px * var(--k));line-height:1.2;font-weight:var(--fw-bold)}
.cas-numero{flex:none;display:grid;place-items:center;border-radius:50%;background:var(--color-badge-step);color:var(--text-on-primary);font-weight:var(--fw-bold)}
.cas-tete .cas-numero{width:1.8em;height:1.8em;font-size:.92em}
.cas-etapes{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:calc(8px * var(--k))}
.cas-etape{display:grid;grid-template-columns:1.55em minmax(0,1fr);gap:.65em;align-items:start;padding:.5em .65em;font-size:calc(18px * var(--k));line-height:1.28;border:2px solid transparent}
.cas-etape .cas-numero{width:1.55em;height:1.55em;font-size:.8em;margin-top:.05em}
.cas-texte{min-width:0}
.cas-texte .libelle{display:block;font-weight:var(--fw-semibold)}
.cas-texte .detail{display:block;margin-top:.3em;font-size:.84em;font-weight:var(--fw-regular);opacity:.92}
.cas-legende{list-style:none;margin:0 0 auto;padding:calc(12px * var(--k)) 0 0;display:flex;flex-wrap:wrap;gap:10px 40px;font-size:calc(17px * var(--k));color:var(--text-secondary);border-top:var(--border-hairline)}
.cas-legende li{display:flex;align-items:center;gap:10px}
.cas-legende .echantillon{display:inline-block;width:2.2em;height:1.15em;border:2px solid transparent}
.compo .bord-tirets{border-style:dashed;border-color:var(--text-strong)}
.compo .bord-plein{border-style:solid}
.compo .b-aucun.bord-plein{border-color:var(--text-strong)}
.compo .b-aucun{background:var(--color-background);color:var(--text-strong)}
.cas-colonne.apparait{animation:tempsIn var(--mvt-temps) var(--courbe-ressort) both;animation-delay:var(--apres-titre,0s)}
.cas-colonne.apparait .cas-etape{animation:tempsIn var(--mvt-temps) var(--courbe-ressort) both;animation-delay:calc(var(--apres-titre,0s) + var(--mvt-decalage-depart) + var(--i) * var(--mvt-decalage))}
/* Le gabarit « tableau » : des couloirs (bandes nommées, leur signe) sous des phases (cadres à leur couleur) ; dans les cases,
   les étapes à leur manière, numérotées, avec leur signal ; des liens suivent les numéros. Tout se dimensionne sur --echelle. */
.tab{--k:var(--echelle,1);flex:1 1 auto;display:flex;flex-direction:column;gap:calc(18px * var(--k));width:100%;min-height:0;min-width:0}
.tab-grille{position:relative;margin-top:auto;display:grid;grid-template-columns:calc(220px * var(--k)) repeat(var(--n),minmax(0,1fr));grid-template-rows:auto repeat(var(--m),minmax(calc(58px * var(--k)),auto));column-gap:calc(14px * var(--k));row-gap:calc(8px * var(--k))}
.tab-coin{display:flex;align-items:end;justify-content:center;padding-bottom:calc(6px * var(--k))}
.tab-illustration{display:block;width:calc(72px * var(--k));height:calc(72px * var(--k))}
.tab-phase{z-index:1;border:2px solid var(--phase,var(--text-strong));margin:calc(-6px * var(--k)) 0}
.tab-phase-titre{z-index:2;align-self:end;padding:calc(8px * var(--k)) calc(10px * var(--k));text-align:center;font-size:calc(19px * var(--k));line-height:1.2;font-weight:var(--fw-bold);color:var(--text-strong)}
.tab-couloir{z-index:0;background:var(--dessin-gris-pale)}
.tab-ligne{z-index:1;display:grid;grid-template-columns:calc(40px * var(--k)) minmax(0,1fr);gap:calc(12px * var(--k));align-items:center;padding-right:calc(8px * var(--k));font-size:calc(16px * var(--k));line-height:1.2;font-weight:var(--fw-semibold);color:var(--text-strong)}
.tab-signe{display:block;width:calc(40px * var(--k));height:calc(40px * var(--k))}
.tab-flux{position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;overflow:visible}
.tab-lien{fill:none;stroke:var(--dessin-gris-fort);stroke-width:2}
.tab-lien.cache{visibility:hidden}
.tab-lien.trace{stroke-dasharray:1;animation:traitIn calc(var(--mvt-entree) * 1.2) linear both;animation-delay:calc(var(--apres-titre,0s) + var(--mvt-decalage-depart) + (var(--i) + 1) * var(--mvt-decalage) * 2)}
.tab-case{z-index:2;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:calc(8px * var(--k));padding:calc(5px * var(--k)) calc(6px * var(--k));min-width:0}
.tab-case.cache,.tab-phase.cache,.tab-phase-titre.cache{visibility:hidden}
.tab-etape{position:relative;display:flex;align-items:center;gap:.5em;max-width:100%;padding:.4em .6em .4em 0;font-size:calc(15px * var(--k));line-height:1.25;border:2px solid transparent;margin-left:.8em}
.tab-etape:not(:has(.cas-numero)){padding-left:.6em}
.tab-etape .cas-numero{flex:none;width:1.6em;height:1.6em;margin-left:-.8em;font-size:.82em}
.tab-texte{min-width:0;font-weight:var(--fw-semibold)}
.compo .signal{flex:none;display:inline-block;width:1em;height:.9em;clip-path:polygon(50% 0,100% 100%,0 100%)}
.cas-legende .echantillon.signal{width:1.2em;height:1.05em;border:0}
.tab-case.apparait .tab-etape{animation:tempsIn var(--mvt-temps) var(--courbe-ressort) both;animation-delay:calc(var(--apres-titre,0s) + var(--mvt-decalage-depart) + var(--i) * var(--mvt-decalage) * 2)}
.tab-phase.apparait,.tab-phase-titre.apparait{animation:fonduIn var(--mvt-temps) var(--courbe-douce) both;animation-delay:var(--apres-titre,0s)}
${ROLES.map((r) => `.compo .b-${r}{background:var(--dessin-${r});color:${ROLES_SOMBRES.has(r) ? "var(--text-on-primary)" : "var(--text-strong)"}}.compo .sig-${r}{background:var(--dessin-${r})}`).join("\n")}
@keyframes aplatIn{from{fill-opacity:0}to{fill-opacity:1}}
@keyframes fonduIn{from{opacity:0}to{opacity:1}}
`;

/**
 * Les activités dérivées (ACT-1) : la consigne et d'où elle dérive, puis le jeu — cases à retrouver, éléments à ordonner,
 * cartes à ranger, zone à désigner. Juste, faux, à retenir : la couleur, et toujours un signe (✓, ✗, le numéro dicté).
 * Tout se dimensionne sur --echelle, que le lecteur resserre pour que l'activité tienne dans sa page.
 */
const styleDesActivites = `
.act{--k:var(--echelle,1);flex:1 1 auto;display:flex;flex-direction:column;gap:calc(26px * var(--k));width:100%;min-height:0;min-width:0}
.act-tete{display:flex;flex-wrap:wrap;align-items:baseline;gap:calc(10px * var(--k)) calc(28px * var(--k))}
.consigne-act{margin:0;flex:1 1 100%;font-size:calc(34px * var(--k));line-height:1.25;font-weight:var(--fw-bold);color:var(--color-primary)}
.source-act{margin:0;font-size:calc(21px * var(--k));font-style:italic;color:var(--text-secondary)}
.act-puces{display:flex;gap:16px;margin-left:auto}
.act-puces .puce{font-size:calc(22px * var(--k));padding:.35em 1em}
.puce.geste-act{background:var(--color-primary-tint);color:var(--color-primary)}
.num-act,.rang-act,.num-colonne{flex:none;display:grid;place-items:center;width:1.7em;height:1.7em;border-radius:50%;font-size:.86em;font-weight:var(--fw-bold)}
.num-act{background:var(--color-badge-step);color:var(--text-on-primary)}
.rang-act{border:3px solid var(--color-primary);color:var(--color-primary)}
.num-colonne{background:var(--text-on-primary);color:var(--color-primary)}
.texte-act{min-width:0}
.act li,.carte-act{list-style:none}
.act .neuf{animation:popIn var(--mvt-entree) var(--courbe-ressort) both}
.au-corrige .corrige,.au-corrige .a-retenir,.au-corrige .juste,.au-corrige .faux{animation:tempsIn var(--mvt-temps) var(--courbe-ressort) both;animation-delay:calc(var(--apres-titre,0s) + var(--i,0) * var(--mvt-decalage))}
.act-rappel{margin:0;padding:0;display:grid;grid-template-columns:repeat(min(2,var(--n)),minmax(0,1fr));gap:calc(16px * var(--k)) calc(32px * var(--k));font-size:calc(28px * var(--k));line-height:1.3}
.act-rappel li{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);gap:.7em;align-items:center;min-height:2.6em;padding:.45em 2.2em .45em .9em;background:var(--color-surface);border-left:6px solid var(--color-border)}
.act-rappel .vide .texte-act::after{content:"";display:block;width:55%;height:.18em;background:var(--color-border)}
.act-rappel .sorti{background:var(--color-success-bg);border-left-color:var(--color-success);color:var(--text-strong);font-weight:var(--fw-semibold)}
.act-rappel .sorti::after,.act-ordre .juste::after,.carte-act.juste::after{content:"✓";position:absolute;right:.6em;top:50%;transform:translateY(-50%);color:var(--color-success);font-weight:var(--fw-bold)}
.act-rappel .a-retenir{background:var(--color-warning-bg);border-left-color:var(--color-warning);color:var(--text-strong)}
.act-classement{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:calc(48px * var(--k));font-size:calc(25px * var(--k));line-height:1.28}
.act-propositions,.act-ordre{margin:0;padding:0;display:flex;flex-direction:column;gap:calc(10px * var(--k))}
.act-propositions li,.act-ordre li{position:relative;display:flex;align-items:center;gap:.6em;min-height:2.3em;padding:.3em 2em .3em .7em;background:var(--color-surface)}
.act-propositions .placee{opacity:.35}
.act-ordre li{background:var(--color-background);border:2px dashed var(--color-border)}
.act-ordre .remplie,.act-ordre .corrige{border-style:solid;border-color:var(--color-primary)}
.act-ordre .juste{background:var(--color-success-bg);border-color:var(--color-success)}
.act-ordre .faux{background:var(--color-error-bg);border-color:var(--color-error)}
.act-ordre .dicte{margin-left:auto;font-size:.8em;color:var(--color-error);white-space:nowrap}
.act-ordre .dicte::before{content:"✗ "}
.act-categorisation{display:flex;flex-direction:column;gap:calc(20px * var(--k));font-size:calc(23px * var(--k));line-height:1.25;min-height:0}
.intitule-act{font-size:.9em;font-weight:var(--fw-semibold);letter-spacing:1px;text-transform:uppercase;color:var(--text-secondary)}
.act-reserve{display:flex;flex-wrap:wrap;gap:calc(12px * var(--k));min-height:calc(20px * var(--k))}
.act-reserve .carte-act{width:calc(50% - 6px * var(--k))}
.act-colonnes{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:calc(24px * var(--k));align-items:start}
.colonne-act{display:flex;flex-direction:column;gap:calc(10px * var(--k));padding-bottom:calc(10px * var(--k));background:var(--color-surface);min-height:calc(120px * var(--k))}
.tete-act{display:flex;align-items:center;gap:.6em;padding:.45em .8em;background:var(--color-primary);color:var(--text-on-primary);font-weight:var(--fw-bold)}
.colonne-act .carte-act{margin:0 calc(10px * var(--k))}
.carte-act{position:relative;display:flex;align-items:center;gap:.6em;padding:.4em 2em .4em .6em;background:var(--color-background);border:2px solid var(--color-border);box-shadow:var(--shadow-card)}
.carte-act.choisie{border-color:var(--color-accent);outline:4px solid var(--color-accent);transform:translateY(-4px)}
.carte-act.juste{background:var(--color-success-bg);border-color:var(--color-success)}
.carte-act.faux{background:var(--color-error-bg);border-color:var(--color-error)}
.carte-act.faux::after{content:"✗";position:absolute;right:.6em;top:50%;transform:translateY(-50%);color:var(--color-error);font-weight:var(--fw-bold)}
.act-selection{display:flex;gap:48px;align-items:flex-start;min-height:0}
.act-selection .zone.faite{border-color:var(--color-success);box-shadow:none}
.act-selection .zone.faite .num{background:var(--color-success)}
.act-pas{flex:1;min-width:0;margin:0;padding:0;display:flex;flex-direction:column;gap:18px;font-size:27px;line-height:1.35}
.act-pas li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:16px;align-items:start;color:var(--text-secondary)}
.act-pas .courant{color:var(--text-strong);font-weight:var(--fw-semibold);font-size:1.12em}
.act-pas .faite .num-act{background:var(--color-success)}
.act-pas .a-venir{visibility:hidden}
`;

/** La feuille de la salle, au nom de son thème. */
export const styleDeSalle = (nom: string) => `
*{box-sizing:border-box}
html,body{margin:0;height:100%;overflow:hidden;background:var(--color-nav-bg);font-family:var(--font-base)}
#scene{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform-origin:center;background:var(--color-background);overflow:hidden;color:var(--text-body)}
.diapo{position:absolute;inset:0;display:flex;flex-direction:column;padding:64px 96px 40px}
.entete{display:flex;justify-content:space-between;align-items:flex-start;gap:48px;border-left:var(--filet-width) solid var(--color-primary);padding-left:28px}
.entete h1{margin:0;font-size:46px;line-height:1.15;color:var(--text-strong);font-weight:var(--fw-bold);max-width:1480px}
.entete .logo{height:46px;flex:none}
.titre-entete{display:flex;align-items:center;gap:24px;min-width:0}
.titre-entete .section{flex:none;box-sizing:border-box;width:72px;height:72px;padding:14px;border-radius:50%;background:var(--color-primary);object-fit:contain}
.pictogramme-cote{flex:none;width:360px;display:flex;align-items:center;justify-content:center}
.pictogramme-cote>img{max-width:320px;max-height:420px;object-fit:contain}
.pictogramme-cote .disque{width:320px;height:320px;border-radius:50%;display:grid;place-items:center}
.pictogramme-cote .disque img{width:58%;height:58%;object-fit:contain}
.f-mise-en-pratique .corps>.texte{flex:1;min-width:0;display:flex;flex-direction:column;gap:32px}
.ecran{display:flex;align-items:center;gap:96px;width:100%}
.ecran .disque{flex:none;width:440px;height:440px;border-radius:50%;background:var(--color-background);box-shadow:var(--shadow-raised);display:grid;place-items:center}
.ecran .disque img{width:62%;height:62%;object-fit:contain}
.texte-ecran{flex:1;min-width:0;display:flex;flex-direction:column;gap:32px}
.galerie{display:flex;flex-wrap:wrap;gap:24px 56px;align-items:flex-end}
.galerie figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:16px;width:220px}
.galerie img{width:180px;height:150px;object-fit:contain}
.galerie figcaption{font-size:28px;line-height:1.2;text-align:center;font-weight:var(--fw-semibold);color:var(--text-strong)}
.puce .icone-duree{width:1.3em;height:1.3em;object-fit:contain;vertical-align:-.3em;margin-right:.5em}
.photo-couverture{position:absolute;top:0;right:0;bottom:28px;width:44%;background-size:cover;background-position:center;z-index:0}
.f-couverture .corps{position:relative;z-index:1;max-width:52%}
.corps{flex:1;display:flex;gap:56px;margin-top:44px;min-height:0;overflow:hidden}
.corps.centre{flex-direction:column;align-items:center;justify-content:center;gap:28px}
.corps.colonne{flex-direction:column;gap:28px}
.pied{display:flex;justify-content:space-between;gap:32px;font-size:20px;color:var(--text-secondary);border-top:var(--border-hairline);padding-top:14px}
.texte{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}
.visuels{flex:none;display:flex;flex-direction:column;gap:24px;align-items:center;justify-content:center}
.liste{list-style:none;margin:0;padding:0;font-size:32px;line-height:1.4}
.liste li{position:relative;padding-left:44px;margin-bottom:22px}
.liste li::before{content:"";position:absolute;left:4px;top:.5em;width:14px;height:14px;background:var(--color-primary)}
.liste li.cache{visibility:hidden}
.liste li.courant{color:var(--text-strong);font-weight:var(--fw-semibold)}
.liste.numerotee{counter-reset:n}
.liste.numerotee li{padding-left:76px;min-height:52px}
.liste.numerotee li::before{content:counter(n);counter-increment:n;left:0;top:-2px;width:52px;height:52px;border-radius:50%;background:var(--color-badge-step);color:var(--text-on-primary);font-size:26px;font-weight:var(--fw-bold);display:grid;place-items:center}
.liste.legende{font-size:24px;color:var(--text-secondary)}
.liste.legende li::before{width:10px;height:10px}
.liste.glossaire{display:grid;grid-template-columns:1fr 1fr;column-gap:64px;font-size:22px}
.liste.glossaire li{margin-bottom:14px}
.capture{position:relative;overflow:hidden;flex:none;background:var(--color-surface);box-shadow:var(--shadow-raised)}
.capture .plan{position:absolute;inset:0;transform-origin:0 0;transition:transform var(--mvt-entree) var(--courbe-douce);--k:1}
.capture img{position:absolute;max-width:none;user-select:none}
.capture .absent{position:absolute;inset:0;display:grid;place-items:center;font-size:24px;color:var(--text-secondary)}
.zone{position:absolute;border:calc(5px / var(--k)) solid var(--color-badge-step);border-radius:6px;box-shadow:0 0 0 4000px color-mix(in srgb, var(--color-nav-bg) 40%, transparent)}
.zone.toutes{box-shadow:none}
.zone .num{position:absolute;left:calc(-26px / var(--k));top:calc(-26px / var(--k));width:calc(48px / var(--k));height:calc(48px / var(--k));border-radius:50%;background:var(--color-badge-step);color:var(--text-on-primary);font-weight:var(--fw-bold);font-size:calc(24px / var(--k));display:grid;place-items:center}
.pap{display:flex;gap:48px;align-items:stretch;width:100%;min-height:0}
.pap .capture{align-self:flex-start}
.colonne-consignes{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}
.consignes{list-style:none;margin:0;padding:0;font-size:27px;line-height:1.35}
.consignes li{display:grid;grid-template-columns:44px 1fr;gap:18px;margin-bottom:22px;color:var(--text-secondary)}
.consignes li .num{width:44px;height:44px;border-radius:50%;background:var(--color-border);color:var(--text-secondary);font-size:22px;font-weight:var(--fw-bold);display:grid;place-items:center}
.consignes li.courant{color:var(--text-strong);font-weight:var(--fw-semibold)}
.consignes li.courant .num{background:var(--color-badge-step);color:var(--text-on-primary)}
.consignes li.cache{visibility:hidden}
.tableau{border-collapse:collapse;width:100%;font-size:21px;line-height:1.35}
.tableau th{background:var(--color-primary);color:var(--text-on-primary);text-align:left;padding:12px 16px;font-weight:var(--fw-semibold)}
.tableau td{padding:10px 16px;border-bottom:var(--border-hairline);vertical-align:top}
.tableau tr:nth-child(odd) td{background:var(--color-surface)}
.puce{display:inline-block;align-self:flex-start;padding:10px 26px;border-radius:var(--radius-pill);font-size:26px;font-weight:var(--fw-semibold)}
.puce.duree{background:var(--color-background);color:var(--text-strong);box-shadow:var(--shadow-card)}
.puce.a-vous{background:var(--color-badge-step);color:var(--text-on-primary);text-transform:uppercase;letter-spacing:1px}
.f-mise-en-pratique .corps{flex-direction:row;gap:56px}
.aide{margin:0;font-size:24px;color:var(--text-secondary)}
.etiquette{font-size:28px;text-transform:uppercase;letter-spacing:3px;color:var(--text-secondary);font-weight:var(--fw-semibold)}
.grand{font-size:84px;line-height:1.1;font-weight:var(--fw-bold);color:var(--text-strong);max-width:1500px}
.f-couverture .corps,.f-transition .corps,.f-ecran-animation .corps,.f-demonstration .corps{margin:0;flex-direction:column;justify-content:center;gap:32px;padding:0 64px}
.f-couverture .logo-grand{height:96px;align-self:flex-start}
.f-couverture .titre-couverture{margin:0;font-size:88px;line-height:1.05;color:var(--text-strong);font-weight:var(--fw-bold)}
.f-couverture .sous-titres{list-style:none;padding:0;margin:0;font-size:34px;line-height:1.5;color:var(--text-secondary)}
.f-couverture::after{content:"";position:absolute;left:0;right:0;bottom:0;height:28px;background:var(--color-primary)}
.f-transition{background:var(--color-nav-bg);color:var(--text-on-primary)}
.f-transition .numero{font-size:240px;line-height:.9;font-weight:var(--fw-bold);color:var(--color-button)}
.f-transition h1{margin:0;font-size:68px;line-height:1.1;font-weight:var(--fw-bold);max-width:1560px}
.f-transition .sommaire{list-style:none;padding:0;margin:0;font-size:30px;line-height:1.55;color:color-mix(in srgb, var(--text-on-primary) 80%, transparent)}
.f-ecran-animation{background:var(--color-primary-tint)}
.f-ecran-animation p{margin:0;font-size:32px;color:var(--text-secondary)}
.f-demonstration{background:var(--color-surface)}
.f-renvoi .sommaire{list-style:none;padding:0;margin:0;font-size:34px;text-align:center;color:var(--text-strong)}
/* L'organisation d'un texte : rangées, colonnes en fiches, flux d'unités (intertitre, paragraphe, item et ses détails, définition). */
.structure{display:flex;flex-direction:column;gap:36px;width:100%}
.rangee{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:40px;align-items:start}
.flux{list-style:none;margin:0;padding:0;font-size:calc(30px * var(--echelle, 1));line-height:1.4;color:var(--text-body)}
.flux.fiche{background:var(--color-surface);border-top:var(--filet-width) solid var(--color-primary);padding:.85em 1em .3em;box-shadow:var(--shadow-card)}
.flux li{margin-bottom:.6em}
.flux li.cache{visibility:hidden}
.flux .intertitre{font-size:1.04em;font-weight:var(--fw-bold);color:var(--text-strong);margin:.2em 0 .55em}
.flux .intertitre::after{content:"";display:block;width:1.9em;height:4px;margin-top:.33em;background:var(--color-accent)}
.flux .item{position:relative;padding-left:1.33em}
.flux .item::before{content:"";position:absolute;left:.13em;top:.55em;width:.4em;height:.4em;background:var(--color-primary)}
.flux .item.numero{padding-left:2.1em}
.flux .item.numero::before{content:attr(data-n);left:0;top:-.05em;width:1.47em;height:1.47em;border-radius:50%;background:var(--color-badge-step);color:var(--text-on-primary);font-size:.73em;font-weight:var(--fw-bold);display:grid;place-items:center}
.fiche-illustree{display:grid;grid-template-columns:120px minmax(0,1fr);align-items:stretch;background:var(--color-surface);border-top:var(--filet-width) solid var(--color-primary);box-shadow:var(--shadow-card)}
.fiche-illustree .illustration{width:120px;height:auto;max-height:150px;object-fit:contain;padding:22px 0 22px 26px;align-self:start}
.fiche-illustree .flux.fiche{border-top:none;box-shadow:none;background:none}
.flux .details{font-size:.8em;line-height:1.4;color:var(--text-secondary);margin-top:6px}
.flux .def{display:grid;grid-template-columns:minmax(200px,30%) minmax(0,1fr);gap:1.05em;padding:.45em 0 .5em;margin:0;border-bottom:var(--border-hairline)}
.flux .def:first-of-type{border-top:var(--border-hairline)}
.flux .terme{font-weight:var(--fw-bold);color:var(--text-strong)}
.flux strong{font-weight:var(--fw-bold);color:var(--text-strong)}
.flux li.courant{color:var(--text-strong)}
.flux li.apparait,.structure .fiche.apparait,.structure .fiche-illustree.apparait{animation:tempsIn var(--mvt-temps) var(--courbe-ressort) both;animation-delay:var(--apres-titre,0s)}
.structure .cache{visibility:hidden}
/* Défilement : un rail qui glisse dans une fenêtre ; fondus aux bords coupés, indice de suite pour les pages. */
.defile{position:relative;flex:1;min-height:0;min-width:0;width:100%;overflow:hidden}
.defile .rail{position:relative;transition:transform var(--mvt-entree) var(--courbe-douce)}
.defile::before,.defile::after{content:"";position:absolute;left:0;right:0;height:80px;pointer-events:none;opacity:0;z-index:1;transition:opacity var(--mvt-moyen) var(--courbe-standard)}
.defile::before{top:0;background:linear-gradient(var(--color-background),transparent)}
.defile::after{bottom:0;background:linear-gradient(transparent,var(--color-background))}
.defile.haut::before,.defile.bas::after{opacity:1}
.defile .indice{position:absolute;left:50%;bottom:4px;z-index:2;font-size:34px;line-height:1;color:var(--color-primary);opacity:0;pointer-events:none;transition:opacity var(--mvt-moyen) var(--courbe-standard)}
.defile.bas .indice{opacity:1;animation:chevBob var(--mvt-volet) ease-in-out infinite}
/* Mouvement du thème : le titre entre, puis le corps en cascade — et, d'un bloc dévoilé, sa première unité ; dévoilement de
   l'item courant. --apres-titre : le moment où le titre est posé (0 hors entrée, et sur les diapositives sans en-tête). */
.diapo{--debut-titre:0s;--apres-titre:var(--debut-titre)}
.diapo.entree.apres-volet{--debut-titre:calc(var(--mvt-volet) / 2)}
.diapo.entree:has(>.entete){--apres-titre:calc(var(--debut-titre) + var(--mvt-entree) * .7)}
.diapo.entree .entete{animation:screenIn var(--mvt-entree) var(--courbe-ressort) both;animation-delay:var(--debut-titre)}
.diapo.entree .titre-entete .section{animation:popIn var(--mvt-entree) var(--courbe-ressort) both;animation-delay:calc(var(--debut-titre) + var(--mvt-decalage))}
.diapo.entree .corps>*{animation:tempsIn var(--mvt-temps) var(--courbe-ressort) both;animation-delay:calc(var(--apres-titre) + var(--mvt-decalage-max))}
.diapo.entree .corps>:nth-child(1){animation-delay:calc(var(--apres-titre) + var(--mvt-decalage-depart))}
.diapo.entree .corps>:nth-child(2){animation-delay:calc(var(--apres-titre) + var(--mvt-decalage-depart) + var(--mvt-decalage))}
.diapo.entree .corps>:nth-child(3){animation-delay:calc(var(--apres-titre) + var(--mvt-decalage-depart) + 2 * var(--mvt-decalage))}
.diapo.entree .corps>:nth-child(4){animation-delay:calc(var(--apres-titre) + var(--mvt-decalage-depart) + 3 * var(--mvt-decalage))}
/* Ce qui porte l'unité qui paraît se contente d'un fondu : l'unité monte seule. */
.diapo.entree .corps>:has(.apparait,.trace){animation-name:fonduIn}
.diapo.entree .puce{animation-name:ctaIn;animation-duration:var(--mvt-cta);animation-delay:var(--apres-titre)}
.diapo.entree.f-transition .numero{animation-name:popIn}
.diapo.entree.f-transition .sommaire li{animation:tempsIn var(--mvt-temps) var(--courbe-ressort) both;animation-delay:calc(var(--mvt-decalage-depart) + 3 * var(--mvt-decalage))}
.diapo.entree.f-transition .sommaire li:nth-child(n+2){animation-delay:var(--mvt-decalage-max)}
.f-transition .filet{height:6px;width:240px;background:var(--color-button)}
.diapo.entree .filet{animation:hairlineGrow var(--mvt-temps) var(--courbe-douce) both;animation-delay:calc(var(--mvt-decalage-depart) + 2 * var(--mvt-decalage))}
.diapo.entree.f-transition .sommaire{animation:none}
li.apparait{animation:tempsIn var(--mvt-temps) var(--courbe-ressort) both;animation-delay:var(--apres-titre,0s)}
.zone.apparait{animation:popIn var(--mvt-entree) var(--courbe-ressort) both;animation-delay:var(--apres-titre,0s)}
.volet{position:absolute;inset:0;z-index:5;background:var(--color-nav-bg);color:var(--text-on-primary);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:0 160px;animation:voletOut var(--mvt-volet) var(--courbe-volet) forwards}
.volet .surtitre{font-size:26px;font-weight:var(--fw-bold);letter-spacing:3px;text-transform:uppercase;opacity:.85;animation:voletLabel var(--mvt-entree) ease forwards}
.volet .titre{font-size:64px;font-weight:var(--fw-bold);line-height:1.1;max-width:24ch;animation:voletLabel var(--mvt-entree) ease forwards}
#surcouche{position:fixed;inset:0;pointer-events:none}
.aide-bouton,.plan-bouton{position:fixed;right:20px;bottom:20px;z-index:3;width:44px;height:44px;border-radius:50%;border:none;background:var(--color-primary);color:var(--text-on-primary);font:var(--fw-bold) 22px var(--font-base);cursor:pointer;box-shadow:var(--shadow-raised);opacity:0;transition:opacity var(--mvt-moyen) var(--courbe-standard)}
.aide-bouton.visible,.aide-bouton.ouvert,.aide-bouton:focus-visible,.plan-bouton.visible,.plan-bouton:focus-visible{opacity:1}
.aide-commandes{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,92vw);max-height:88vh;overflow:auto;pointer-events:auto;padding:28px 36px 24px;background:var(--color-background);color:var(--text-body);border-top:var(--rule-top) solid var(--color-primary);box-shadow:var(--shadow-overlay);font-size:16px;line-height:1.45;animation:popIn var(--mvt-entree) var(--courbe-ressort) both}
.aide-commandes h2{margin:0 0 16px;font-size:var(--fs-h2);color:var(--text-strong)}
.aide-commandes table{border-collapse:collapse;width:100%}
.aide-commandes td{padding:7px 0;border-bottom:var(--border-hairline);vertical-align:middle}
.aide-commandes td:first-child{width:46%;padding-right:16px}
.aide-commandes kbd{display:inline-block;min-width:34px;margin:2px 0;padding:3px 9px;border:1px solid var(--color-border);border-bottom-width:3px;border-radius:var(--radius-interactive);background:var(--color-surface);color:var(--text-strong);font:var(--fw-semibold) 14px var(--font-base);text-align:center}
.aide-commandes p{margin:14px 0 0;font-size:var(--fs-meta);color:var(--text-secondary)}
.plan-bouton{right:76px;font-size:20px}
/* Le plan de la séance : un panneau sur un voile, les séquences et leurs diapositives ; la courante marquée, la choisie surlignée. */
.plan-seance-fond{position:fixed;inset:0;z-index:6;display:grid;place-items:center;background:color-mix(in srgb,var(--color-nav-bg) 45%,transparent)}
.plan-seance{display:flex;flex-direction:column;width:min(820px,92vw);max-height:88vh;padding:24px 28px 18px;background:var(--color-background);color:var(--text-body);border-top:var(--rule-top) solid var(--color-primary);box-shadow:var(--shadow-overlay);font-size:16px;line-height:1.35;animation:popIn var(--mvt-entree) var(--courbe-ressort) both}
.plan-seance h2{margin:0 0 12px;font-size:var(--fs-h2);color:var(--text-strong)}
.plan-seance input{width:100%;padding:9px 12px;border:1px solid var(--color-border);border-radius:var(--radius-interactive);font:16px var(--font-base);color:var(--text-strong)}
.plan-seance input:focus{outline:2px solid var(--color-primary);outline-offset:1px}
.plan-seance-liste{flex:1;min-height:0;overflow:auto;margin-top:12px}
.plan-seance [hidden]{display:none}
.plan-seance h3{position:sticky;top:0;margin:0;padding:10px 0 6px;background:var(--color-background);font-size:var(--fs-h3);color:var(--color-primary)}
.plan-seance ol{list-style:none;margin:0 0 6px;padding:0}
.plan-seance li button{display:grid;grid-template-columns:3.2em minmax(0,1fr) auto;gap:12px;align-items:baseline;width:100%;padding:6px 8px;border:0;border-bottom:var(--border-hairline);background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.plan-seance li button:hover,.plan-seance li.actif button{background:var(--color-surface)}
.plan-seance li.actif button{box-shadow:inset 3px 0 0 var(--color-primary)}
.plan-seance .num{font-variant-numeric:tabular-nums;color:var(--text-secondary);text-align:right}
.plan-seance .titre{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-strong)}
.plan-seance .figure{font-size:var(--fs-meta);color:var(--text-secondary)}
.plan-seance li.courant .num,.plan-seance li.courant .titre{color:var(--color-primary);font-weight:var(--fw-bold)}
.plan-seance>p{margin:10px 0 0;font-size:var(--fs-meta);color:var(--text-secondary)}
.presentateur .rappel{font-size:15px;opacity:.8}
.minuteur{position:absolute;top:24px;right:24px;padding:10px 22px;border-radius:var(--radius-pill);background:var(--color-background);color:var(--text-strong);font:var(--fw-bold) 28px var(--font-base);box-shadow:var(--shadow-raised);font-variant-numeric:tabular-nums}
.minuteur.bientot{background:var(--color-warning-bg);color:var(--color-warning)}
.minuteur.pause{opacity:.6}
.notes{position:absolute;left:24px;right:24px;bottom:24px;max-height:40vh;overflow:auto;padding:20px 28px;background:var(--color-background);color:var(--text-body);font-size:20px;line-height:1.5;white-space:pre-wrap;box-shadow:var(--shadow-overlay);border-top:var(--rule-top) solid var(--color-primary)}
.noir{position:absolute;inset:0;background:black}
body.presentateur{display:grid;grid-template-columns:3fr 2fr;gap:24px;padding:24px;height:100vh;color:var(--text-on-primary);overflow:hidden}
.presentateur .colonne-g,.presentateur .colonne-d{display:flex;flex-direction:column;gap:16px;min-height:0}
.presentateur .vignette{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;background:var(--color-background);box-shadow:var(--shadow-overlay)}
.presentateur .cadre{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0}
.presentateur .barre{display:flex;justify-content:space-between;font-size:22px;font-weight:var(--fw-semibold)}
.presentateur #chrono{font-variant-numeric:tabular-nums}
.presentateur .notes-p{flex:1;overflow:auto;padding:20px;background:var(--color-background);color:var(--text-body);font-size:20px;line-height:1.5;white-space:pre-wrap}
` + styleDesActivites + styleDuDessin(nom);
