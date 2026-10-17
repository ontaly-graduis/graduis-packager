// La feuille de la salle : scène 1920 × 1080, compositions par figure, présentateur — jetons du thème seulement.
import { ROLES } from "../pivot/seance-spec";

/** Les schémas redessinés : un rôle de couleur → remplissage (f-), trait (s-), texte (c-), d'après `--dessin-<rôle>` du thème. */
const STYLE_DESSIN = `
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
`;

export const STYLE_SALLE = `
*{box-sizing:border-box}
html,body{margin:0;height:100%;overflow:hidden;background:var(--color-nav-bg);font-family:var(--font-base)}
#scene{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform-origin:center;background:var(--color-background);overflow:hidden;color:var(--text-body)}
.diapo{position:absolute;inset:0;display:flex;flex-direction:column;padding:64px 96px 40px}
.entete{display:flex;justify-content:space-between;align-items:flex-start;gap:48px;border-left:var(--filet-width) solid var(--color-primary);padding-left:28px}
.entete h1{margin:0;font-size:46px;line-height:1.15;color:var(--text-strong);font-weight:var(--fw-bold);max-width:1480px}
.entete .logo{height:46px;flex:none}
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
.f-mise-en-pratique .corps{flex-direction:column;gap:32px}
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
/* Défilement : un rail qui glisse dans une fenêtre ; fondus aux bords coupés, indice de suite pour les pages. */
.defile{position:relative;flex:1;min-height:0;min-width:0;width:100%;overflow:hidden}
.defile .rail{position:relative;transition:transform var(--mvt-entree) var(--courbe-douce)}
.defile::before,.defile::after{content:"";position:absolute;left:0;right:0;height:80px;pointer-events:none;opacity:0;z-index:1;transition:opacity var(--mvt-moyen) var(--courbe-standard)}
.defile::before{top:0;background:linear-gradient(var(--color-background),transparent)}
.defile::after{bottom:0;background:linear-gradient(transparent,var(--color-background))}
.defile.haut::before,.defile.bas::after{opacity:1}
.defile .indice{position:absolute;left:50%;bottom:4px;z-index:2;font-size:34px;line-height:1;color:var(--color-primary);opacity:0;pointer-events:none;transition:opacity var(--mvt-moyen) var(--courbe-standard)}
.defile.bas .indice{opacity:1;animation:chevBob var(--mvt-volet) ease-in-out infinite}
/* Mouvement du thème : entrée de diapositive en cascade, dévoilement de l'item courant, apparition des encadrés. */
.diapo.entree .entete{animation:screenIn var(--mvt-entree) var(--courbe-ressort) both}
.diapo.entree .corps>*{animation:tempsIn var(--mvt-temps) var(--courbe-ressort) both;animation-delay:var(--mvt-decalage-max)}
.diapo.entree .corps>:nth-child(1){animation-delay:var(--mvt-decalage-depart)}
.diapo.entree .corps>:nth-child(2){animation-delay:calc(var(--mvt-decalage-depart) + var(--mvt-decalage))}
.diapo.entree .corps>:nth-child(3){animation-delay:calc(var(--mvt-decalage-depart) + 2 * var(--mvt-decalage))}
.diapo.entree .corps>:nth-child(4){animation-delay:calc(var(--mvt-decalage-depart) + 3 * var(--mvt-decalage))}
.diapo.entree .puce{animation-name:ctaIn;animation-duration:var(--mvt-cta)}
.diapo.entree.f-transition .numero{animation-name:popIn}
.diapo.entree.f-transition .sommaire li{animation:tempsIn var(--mvt-temps) var(--courbe-ressort) both;animation-delay:calc(var(--mvt-decalage-depart) + 3 * var(--mvt-decalage))}
.diapo.entree.f-transition .sommaire li:nth-child(n+2){animation-delay:var(--mvt-decalage-max)}
.f-transition .filet{height:6px;width:240px;background:var(--color-button)}
.diapo.entree .filet{animation:hairlineGrow var(--mvt-temps) var(--courbe-douce) both;animation-delay:calc(var(--mvt-decalage-depart) + 2 * var(--mvt-decalage))}
.diapo.entree.f-transition .sommaire{animation:none}
.diapo.entree.apres-volet .entete,.diapo.entree.apres-volet .corps>:nth-child(n){animation-delay:calc(var(--mvt-volet) / 2)}
li.apparait{animation:tempsIn var(--mvt-temps) var(--courbe-ressort) both}
.zone.apparait{animation:popIn var(--mvt-entree) var(--courbe-ressort) both}
.volet{position:absolute;inset:0;z-index:5;background:var(--color-nav-bg);color:var(--text-on-primary);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:0 160px;animation:voletOut var(--mvt-volet) var(--courbe-volet) forwards}
.volet .surtitre{font-size:26px;font-weight:var(--fw-bold);letter-spacing:3px;text-transform:uppercase;opacity:.85;animation:voletLabel var(--mvt-entree) ease forwards}
.volet .titre{font-size:64px;font-weight:var(--fw-bold);line-height:1.1;max-width:24ch;animation:voletLabel var(--mvt-entree) ease forwards}
#surcouche{position:fixed;inset:0;pointer-events:none}
.aide-bouton{position:fixed;right:20px;bottom:20px;z-index:3;width:44px;height:44px;border-radius:50%;border:none;background:var(--color-primary);color:var(--text-on-primary);font:var(--fw-bold) 22px var(--font-base);cursor:pointer;box-shadow:var(--shadow-raised);opacity:0;transition:opacity var(--mvt-moyen) var(--courbe-standard)}
.aide-bouton.visible,.aide-bouton.ouvert,.aide-bouton:focus-visible{opacity:1}
.aide-commandes{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,92vw);max-height:88vh;overflow:auto;pointer-events:auto;padding:28px 36px 24px;background:var(--color-background);color:var(--text-body);border-top:var(--rule-top) solid var(--color-primary);box-shadow:var(--shadow-overlay);font-size:16px;line-height:1.45;animation:popIn var(--mvt-entree) var(--courbe-ressort) both}
.aide-commandes h2{margin:0 0 16px;font-size:var(--fs-h2);color:var(--text-strong)}
.aide-commandes table{border-collapse:collapse;width:100%}
.aide-commandes td{padding:7px 0;border-bottom:var(--border-hairline);vertical-align:middle}
.aide-commandes td:first-child{width:46%;padding-right:16px}
.aide-commandes kbd{display:inline-block;min-width:34px;margin:2px 0;padding:3px 9px;border:1px solid var(--color-border);border-bottom-width:3px;border-radius:var(--radius-interactive);background:var(--color-surface);color:var(--text-strong);font:var(--fw-semibold) 14px var(--font-base);text-align:center}
.aide-commandes p{margin:14px 0 0;font-size:var(--fs-meta);color:var(--text-secondary)}
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
`+ STYLE_DESSIN;
