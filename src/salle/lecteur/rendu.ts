// Le rendu d'un bloc de salle en diapositive 1920 × 1080, au thème : une composition par figure.
import { dessinEnSvg } from "../../dessin/svg";
import type { Composition, Structure, Vignette } from "../../pivot/seance-spec";
import type { BlocDeSalle, SequenceDeSalle, VisuelDeSalle } from "../donnees";
import { planDeDevoilement } from "../unites";

export interface Contexte {
  readonly doc: Document;
  /** Hash de média → data-URI ; `logo` → le logo du thème. */
  readonly medias: Readonly<Record<string, string>>;
  /** Le zoom sur la zone courante (touche Z). */
  readonly zoom: boolean;
  /** Ce qui s'anime au rendu : l'entrée du bloc, le seul dévoilement de l'étape, ou rien (présentateur). */
  readonly anime: "bloc" | "etape" | "aucun";
}

const LARGEUR = 1920;
const CORPS = { x: 96, largeur: LARGEUR - 192, hauteur: 780 };
const ZOOM_MAX = 2.2;

type Attrs = Readonly<Record<string, string>>;

export function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, classe = "", texte?: string, attrs: Attrs = {}): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export function liste(ctx: Contexte, lignes: readonly string[], etape: number, devoile: boolean, classe = "liste"): HTMLElement {
  const ul = el(ctx.doc, "ul", classe);
  lignes.forEach((l, i) => {
    const cache = devoile && i >= etape;
    const courant = devoile && i === etape - 1;
    ul.append(el(ctx.doc, "li", cache ? "cache" : courant ? `courant${ctx.anime === "etape" ? " apparait" : ""}` : "", l));
  });
  return ul;
}

/** Un texte du pivot, sa graisse (`**…**`) rendue. */
function riche(ctx: Contexte, parent: HTMLElement, texte: string): HTMLElement {
  texte.split(/(\*\*[^*]+?\*\*)/).forEach((morceau) => {
    if (!morceau) return;
    if (morceau.startsWith("**") && morceau.endsWith("**")) parent.append(el(ctx.doc, "strong", "", morceau.slice(2, -2)));
    else parent.append(ctx.doc.createTextNode(morceau));
  });
  return parent;
}

/**
 * L'organisation d'une diapositive de texte : des rangées, des colonnes (en fiches quand elles sont plusieurs), et dans
 * chaque colonne un flux d'unités — paragraphes, items, définitions — qui se dévoilent une à une ; un intertitre paraît
 * avec la première unité qu'il annonce.
 */
export function structure(ctx: Contexte, s: Structure, etape: number, devoile: boolean): HTMLElement {
  const racine = el(ctx.doc, "div", "structure");
  const plan = planDeDevoilement(s);
  let a = 0;
  let dansFiche = false;
  const cache = (u: number) => devoile && u >= etape;
  // Dans une fiche, c'est la fiche qui paraît ; ses lignes ne s'animent pas une à une.
  const etat = (u: number) => (cache(u) ? "cache" : devoile && u === etape - 1 ? `courant${ctx.anime === "etape" && !dansFiche ? " apparait" : ""}` : "");
  /** L'atome suivant, dans l'ordre du plan : un `li` à l'état de son unité. */
  const atome = (classe: string) => {
    const li = el(ctx.doc, "li", `${classe} ${etat(plan.atomes[a] ?? 0)}`.trim());
    a += 1;
    return li;
  };
  const details = (parent: HTMLElement, lignes: readonly string[] | undefined) => {
    if (!lignes?.length) return;
    const d = el(ctx.doc, "div", "details");
    lignes.forEach((t, j) => { if (j) d.append(el(ctx.doc, "br")); riche(ctx, d, t); });
    parent.append(d);
  };
  for (const r of s.rangees) {
    const rangee = el(ctx.doc, "div", "rangee");
    rangee.style.setProperty("--n", String(r.colonnes.length));
    for (const c of r.colonnes) {
      const fiche = r.colonnes.length > 1 || !!c.visuel;
      dansFiche = fiche;
      const uniteDeFiche = plan.atomes[a] ?? 0;
      const flux = el(ctx.doc, "ul", `flux${fiche ? " fiche" : ""}`);
      for (const x of c.noeuds) {
        if (x.type === "titre") flux.append(riche(ctx, atome("intertitre"), x.texte));
        else if (x.type === "paragraphe") flux.append(riche(ctx, atome("para"), x.texte));
        else if (x.type === "liste") {
          x.items.forEach((it, k) => {
            const li = atome(`item${x.numerotee ? " numero" : ""}`);
            if (x.numerotee) li.dataset.n = String(k + 1);
            riche(ctx, li, it.texte);
            details(li, it.details);
            flux.append(li);
          });
        } else {
          for (const e of x.entrees) {
            const li = atome("def");
            li.append(riche(ctx, el(ctx.doc, "span", "terme"), e.terme));
            const t = riche(ctx, el(ctx.doc, "span", "definition"), e.texte);
            details(t, e.details);
            li.append(t);
            flux.append(li);
          }
        }
      }
      const boite = c.visuel ? el(ctx.doc, "div", "fiche-illustree") : flux;
      if (c.visuel) boite.append(el(ctx.doc, "img", "illustration", undefined, { src: ctx.medias[c.visuel] ?? "", alt: "" }), flux);
      // Une fiche paraît entière : son cadre aussi se cache tant qu'elle n'est pas dévoilée.
      if (fiche && cache(uniteDeFiche)) boite.classList.add("cache");
      if (fiche && devoile && uniteDeFiche === etape - 1 && ctx.anime === "etape") boite.classList.add("apparait");
      rangee.append(boite);
    }
    racine.append(rangee);
  }
  return racine;
}

/**
 * Une fenêtre défilante : le contenu glisse sur un rail. Le lecteur mesure après rendu et décale le rail —
 * pour suivre l'item courant d'un dévoilement (la pile monte), ou page par page pour un contenu statique.
 */
function defile(ctx: Contexte, ...contenus: HTMLElement[]): HTMLElement {
  const f = el(ctx.doc, "div", "defile");
  const rail = el(ctx.doc, "div", "rail");
  rail.dataset.glisse = "rail";
  rail.append(...contenus);
  f.append(rail, el(ctx.doc, "span", "indice", "▾"));
  return f;
}

/** Une capture à sa taille d'affichage, rognée comme dans le deck, avec un plan zoomable qui porte image et zones. */
export function capture(ctx: Contexte, v: VisuelDeSalle, maxL: number, maxH: number): { boite: HTMLElement; plan: HTMLElement; l: number; h: number } {
  const [nl, nh] = v.px ?? [1600, 900];
  const [rg, rh, rd, rb] = (v.rognage ?? [0, 0, 0, 0]).map((x) => x / 100000) as [number, number, number, number];
  const vl = nl * (1 - rg - rd);
  const vh = nh * (1 - rh - rb);
  const s = Math.min(maxL / vl, maxH / vh);
  const [l, h] = [vl * s, vh * s];
  const boite = el(ctx.doc, "div", "capture");
  boite.style.width = `${l}px`;
  boite.style.height = `${h}px`;
  const plan = el(ctx.doc, "div", "plan");
  plan.dataset.glisse = "plan";
  const src = ctx.medias[v.media];
  if (src) {
    const img = el(ctx.doc, "img", "", undefined, { src, alt: "" });
    Object.assign(img.style, { width: `${nl * s}px`, height: `${nh * s}px`, left: `${-rg * nl * s}px`, top: `${-rh * nh * s}px` });
    plan.append(img);
  } else {
    plan.append(el(ctx.doc, "div", "absent", "Image à convertir pour la salle"));
  }
  boite.append(plan);
  return { boite, plan, l, h };
}

/** Le zoom qui amène une zone (en %) au centre du cadre, sans découvrir de bord. */
function zoomer(plan: HTMLElement, l: number, h: number, rect: readonly [number, number, number, number]): void {
  const [x, y, w, hz] = rect;
  const k = Math.max(1, Math.min(ZOOM_MAX, (0.6 * 100) / Math.max(w, 1), (0.6 * 100) / Math.max(hz, 1)));
  const cx = ((x + w / 2) / 100) * l;
  const cy = ((y + hz / 2) / 100) * h;
  const tx = Math.min(0, Math.max(l - l * k, l / 2 - cx * k));
  const ty = Math.min(0, Math.max(h - h * k, h / 2 - cy * k));
  plan.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`;
  plan.style.setProperty("--k", String(k));
}

function pasAPas(ctx: Contexte, b: BlocDeSalle, etape: number): HTMLElement {
  const corps = el(ctx.doc, "div", "pap");
  const rm = b.regionMap;
  const pas = rm?.pas ?? [];
  const courant = etape > 0 ? pas[etape - 1] : undefined;
  const zones = rm ? Object.entries(rm.captures).flatMap(([media, zs]) => zs.map((z) => ({ media, z }))) : [];
  const zone = courant ? zones.find((x) => x.z.step === courant.id) : undefined;
  // La capture affichée : celle de la zone courante, sinon celle du dernier pas ancré déjà dévoilé, sinon la première.
  const dejaAncres = pas.slice(0, etape).map((p) => zones.find((x) => x.z.step === p.id)).filter(Boolean);
  const media = zone?.media ?? dejaAncres[dejaAncres.length - 1]?.media ?? b.visuels.find((v) => v.capture)?.media;
  const v = b.visuels.find((x) => x.media === media) ?? b.visuels[0];
  if (v) {
    const c = capture(ctx, v, pas.length ? 1300 : CORPS.largeur, CORPS.hauteur);
    if (b.etapes === 0) {
      // Dévoilement « écran » : toutes les zones de la capture d'un coup, numérotées, sans projecteur.
      for (const x of zones.filter((x) => x.media === v.media)) {
        const [zx, zy, zw, zh] = x.z.rect;
        const z = el(ctx.doc, "div", "zone toutes");
        Object.assign(z.style, { left: `${zx}%`, top: `${zy}%`, width: `${zw}%`, height: `${zh}%` });
        z.append(el(ctx.doc, "span", "num", x.z.step.slice(1)));
        c.plan.append(z);
      }
    } else if (zone) {
      const [x, y, w, h] = zone.z.rect;
      const z = el(ctx.doc, "div", `zone${ctx.anime === "etape" ? " apparait" : ""}`);
      Object.assign(z.style, { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });
      z.append(el(ctx.doc, "span", "num", courant!.id.slice(1)));
      c.plan.append(z);
      if (ctx.zoom) zoomer(c.plan, c.l, c.h, zone.z.rect);
    }
    corps.append(c.boite);
  }
  if (pas.length) {
    const ol = el(ctx.doc, "ol", "consignes");
    pas.forEach((p, i) => {
      const courant = i === etape - 1;
      const li = el(ctx.doc, "li", i >= etape && b.etapes > 0 ? "cache" : courant ? `courant${ctx.anime === "etape" ? " apparait" : ""}` : "");
      li.append(el(ctx.doc, "span", "num", p.id.slice(1)), el(ctx.doc, "span", "", p.libelle || "—"));
      ol.append(li);
    });
    const colonne = el(ctx.doc, "div", "colonne-consignes");
    colonne.append(defile(ctx, ol));
    corps.append(colonne);
  }
  return corps;
}

function visuels(ctx: Contexte, b: BlocDeSalle, maxL: number, maxH: number): HTMLElement[] {
  const vs = b.visuels.filter((v) => v.role !== "section" && v.role !== "duree").slice(0, 2);
  return vs.map((v) => capture(ctx, v, maxL, maxH / Math.max(1, vs.length)).boite);
}

/** Une image telle quelle (pictogramme, icône, photo), ou rien si elle n'est pas affichable. */
function image(ctx: Contexte, v: VisuelDeSalle | undefined, classe: string): HTMLElement | null {
  const src = v ? ctx.medias[v.media] : undefined;
  return src ? el(ctx.doc, "img", classe, undefined, { src, alt: v?.legende ?? "" }) : null;
}

const duVisuel = (b: BlocDeSalle, role: string) => b.visuels.find((v) => v.role === role);

/** La durée d'un écran : son icône (le minuteur du deck) et ses minutes. */
function duree(ctx: Contexte, b: BlocDeSalle): HTMLElement | null {
  if (!b.duree) return null;
  const p = puce(ctx, `${b.duree} minutes`, "duree");
  const icone = image(ctx, duVisuel(b, "duree"), "icone-duree");
  if (icone) p.prepend(icone);
  return p;
}

/**
 * Un écran (animation, démonstration) : son pictogramme dans un disque, son texte, sa galerie (des images légendées : la
 * météo) et sa durée. Les autres images d'un écran sont son décor d'origine (un disque, un ornement) : le thème s'en charge.
 */
function ecran(ctx: Contexte, b: BlocDeSalle, texte: HTMLElement[]): HTMLElement {
  const racine = el(ctx.doc, "div", "ecran");
  const v = duVisuel(b, "pictogramme");
  const picto = image(ctx, v, "");
  if (picto) {
    const disque = el(ctx.doc, "div", "disque");
    if (v?.fond) disque.style.background = `var(--dessin-${v.fond})`;
    disque.append(picto);
    racine.append(disque);
  }
  const colonne = el(ctx.doc, "div", "texte-ecran");
  colonne.append(...texte);
  const legendes = b.visuels.filter((v) => v.legende !== undefined);
  if (legendes.length) {
    const galerie = el(ctx.doc, "div", "galerie");
    for (const v of legendes) {
      const f = el(ctx.doc, "figure", "");
      const i = image(ctx, v, "");
      if (i) f.append(i);
      f.append(el(ctx.doc, "figcaption", "", v.legende));
      galerie.append(f);
    }
    colonne.append(galerie);
  }
  const d = duree(ctx, b);
  if (d) colonne.append(d);
  racine.append(colonne);
  return racine;
}

export function tableau(ctx: Contexte, lignes: readonly (readonly string[])[]): HTMLElement {
  const t = el(ctx.doc, "table", "tableau");
  lignes.forEach((ligne, i) => {
    const tr = el(ctx.doc, "tr");
    for (const cellule of ligne) tr.append(el(ctx.doc, i === 0 ? "th" : "td", "", cellule));
    t.append(tr);
  });
  return t;
}

/**
 * Le schéma redessiné : le SVG du dessin, ses images résolues depuis les médias inline. S'il a une partition, l'étape
 * montre le décor et les pas atteints ; le pas qui arrive se trace (ses traits courent, ses aplats et ses textes suivent).
 */
export function schema(ctx: Contexte, b: BlocDeSalle, etape: number): HTMLElement {
  const conteneur = el(ctx.doc, "div", "schema");
  if (!b.dessin) return conteneur;
  conteneur.innerHTML = dessinEnSvg(b.dessin, b.id);
  conteneur.querySelectorAll("image[data-media]").forEach((i) => i.setAttribute("href", ctx.medias[i.getAttribute("data-media") ?? ""] ?? ""));
  if (b.etapes > 0) {
    conteneur.querySelectorAll<SVGGElement>("g[data-pas]").forEach((g) => {
      const pas = Number(g.dataset.pas);
      if (pas > etape) g.classList.add("pas-cache");
      else if (pas === etape) {
        g.classList.add("pas-courant");
        if (ctx.anime === "etape") {
          g.classList.add("trace");
          g.querySelectorAll("path").forEach((p) => {
            if (p.getAttribute("class")?.includes("s-") && !p.hasAttribute("stroke-dasharray")) p.setAttribute("pathLength", "1");
          });
        }
      } else g.classList.add("pas-fait");
    });
  }
  return conteneur;
}

/**
 * Le gabarit `cas` du wizard, composé au thème : des colonnes en regard, chacune annoncée par son bandeau numéroté, faites
 * d'étapes numérotées gardant leur manière (fond, bord) ; la légende dit ce que les manières veulent dire. Le dévoilement
 * joue « cas en entier » : une colonne par étape, ses étapes en cascade dans l'ordre de leurs numéros.
 */
export function cas(ctx: Contexte, c: Extract<Composition, { gabarit: "cas" }>, etape: number, devoile: boolean): HTMLElement {
  const racine = el(ctx.doc, "div", "cas compo");
  const colonnes = el(ctx.doc, "div", "cas-colonnes");
  colonnes.style.setProperty("--n", String(c.cas.length));
  const maniere = maniereDe;
  c.cas.forEach((k, i) => {
    const col = el(ctx.doc, "section", "cas-colonne");
    if (devoile && i >= etape) col.classList.add("cache");
    if (devoile && i === etape - 1 && ctx.anime === "etape") col.classList.add("apparait");
    const tete = el(ctx.doc, "header", `cas-tete ${k.couleur ? `b-${k.couleur}` : "b-aucun"}`);
    tete.append(el(ctx.doc, "span", "cas-numero", String(k.numero)), el(ctx.doc, "span", "cas-titre", k.titre));
    const ol = el(ctx.doc, "ol", "cas-etapes");
    k.etapes.forEach((e, j) => {
      const li = el(ctx.doc, "li", `cas-etape ${maniere(e)}`);
      li.style.setProperty("--i", String(j));
      const texte = el(ctx.doc, "div", "cas-texte");
      texte.append(el(ctx.doc, "span", "libelle", e.texte));
      if (e.detail) texte.append(el(ctx.doc, "span", "detail", e.detail));
      li.append(el(ctx.doc, "span", "cas-numero", String(e.numero)), texte);
      ol.append(li);
    });
    col.append(tete, ol);
    colonnes.append(col);
  });
  racine.append(colonnes);
  if (c.legende?.length) racine.append(legendeDeComposition(ctx, c.legende));
  return racine;
}

type EntreeDeLegende = NonNullable<Extract<Composition, { gabarit: "cas" }>["legende"]>[number];
const maniereDe = (x: { fond?: string | undefined; bord: string }) => `${x.fond ? `b-${x.fond}` : "b-aucun"} bord-${x.bord}`;

/** La légende d'une composition : un échantillon (case à la manière, ou triangle de signal) et ce qu'il nomme. */
function legendeDeComposition(ctx: Contexte, entrees: readonly EntreeDeLegende[]): HTMLElement {
  const leg = el(ctx.doc, "ul", "cas-legende");
  for (const l of entrees) {
    const li = el(ctx.doc, "li");
    const echantillon = l.forme === "triangle" ? el(ctx.doc, "span", `echantillon signal sig-${l.fond ?? "encre"}`) : el(ctx.doc, "span", `echantillon ${maniereDe(l)}`);
    li.append(echantillon, ctx.doc.createTextNode(l.texte));
    leg.append(li);
  }
  return leg;
}

/** Une vignette (icône, portrait) dessinée en SVG, ses images résolues. */
function vignette(ctx: Contexte, v: Vignette, prefixe: string, classe: string): HTMLElement {
  const e = el(ctx.doc, "span", classe);
  e.innerHTML = dessinEnSvg({ cadre: v.cadre, elements: v.elements }, prefixe);
  e.querySelectorAll("image[data-media]").forEach((i) => i.setAttribute("href", ctx.medias[i.getAttribute("data-media") ?? ""] ?? ""));
  return e;
}

/**
 * Le gabarit `tableau` du wizard, composé au thème : des couloirs nommés (et leur signe) sous des phases ; dans chaque case,
 * les étapes à leur manière, numérotées dans leur phase, avec leur signal ; des liens suivent les numéros d'une étape à la
 * suivante (le lecteur les trace une fois la mise en page faite). Le dévoilement joue phase par phase, ses étapes en
 * cascade dans l'ordre de leurs numéros.
 */
export function composerTableau(ctx: Contexte, t: Extract<Composition, { gabarit: "tableau" }>, etape: number, devoile: boolean, prefixe: string): HTMLElement {
  const racine = el(ctx.doc, "div", "tab compo");
  const grille = el(ctx.doc, "div", "tab-grille");
  grille.style.setProperty("--n", String(t.colonnes.length));
  grille.style.setProperty("--m", String(t.lignes.length));
  const etat = (j: number) => (!devoile ? "" : j >= etape ? " cache" : j === etape - 1 && ctx.anime === "etape" ? " apparait" : "");
  const place = (e: HTMLElement, ligne: string, colonne: string) => { e.style.gridRow = ligne; e.style.gridColumn = colonne; return e; };
  // Le coin : l'illustration (le persona).
  const coin = place(el(ctx.doc, "div", "tab-coin"), "1", "1");
  if (t.illustration) coin.append(vignette(ctx, t.illustration, `${prefixe}-i`, "tab-illustration"));
  grille.append(coin);
  // Les phases : un cadre à leur couleur sur toute la hauteur, leur titre en tête.
  t.colonnes.forEach((k, j) => {
    const cadre = place(el(ctx.doc, "div", `tab-phase${etat(j)}`), "1 / -1", String(j + 2));
    if (k.couleur) cadre.style.setProperty("--phase", `var(--dessin-${k.couleur})`);
    const titre = place(el(ctx.doc, "div", `tab-phase-titre${etat(j)}`, k.titre), "1", String(j + 2));
    grille.append(cadre, titre);
  });
  // Les couloirs : une bande sous les phases, leur nom et leur signe à gauche.
  t.lignes.forEach((l, i) => {
    const tete = place(el(ctx.doc, "div", "tab-ligne"), String(i + 2), "1");
    if (l.signe) tete.append(vignette(ctx, l.signe, `${prefixe}-l${i}`, "tab-signe"));
    tete.append(el(ctx.doc, "span", "tab-ligne-titre", l.titre));
    grille.append(place(el(ctx.doc, "div", "tab-couloir"), String(i + 2), "2 / -1"), tete);
  });
  // Les liens d'une étape numérotée à la suivante, dans sa phase ; le lecteur en calcule le tracé.
  const svg = ctx.doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "tab-flux");
  grille.append(svg);
  // Les cases et leurs étapes.
  const cases = new Map<string, HTMLElement>();
  const rang = new Map<number, number>();
  t.etapes.forEach((e, k) => {
    const cle = `${e.ligne}:${e.colonne}`;
    let c = cases.get(cle);
    if (!c) {
      c = place(el(ctx.doc, "div", `tab-case${etat(e.colonne)}`), String(e.ligne + 2), String(e.colonne + 2));
      cases.set(cle, c);
      grille.append(c);
    }
    const r = rang.get(e.colonne) ?? 0;
    rang.set(e.colonne, r + 1);
    const carte = el(ctx.doc, "div", `tab-etape ${maniereDe(e)}`, undefined, { "data-colonne": String(e.colonne), "data-k": String(k) });
    carte.style.setProperty("--i", String(r));
    if (e.numero !== undefined) carte.append(el(ctx.doc, "span", "cas-numero", String(e.numero)));
    carte.append(el(ctx.doc, "span", "tab-texte", e.texte));
    if (e.signal) carte.append(el(ctx.doc, "span", `signal sig-${e.signal}`));
    c.append(carte);
  });
  t.colonnes.forEach((_, j) => {
    const numerotees = t.etapes.map((e, k) => ({ e, k })).filter(({ e }) => e.colonne === j && e.numero !== undefined)
      .sort((a, b) => a.e.numero! - b.e.numero!);
    numerotees.slice(1).forEach(({ k }, n) => {
      const lien = ctx.doc.createElementNS("http://www.w3.org/2000/svg", "path");
      lien.setAttribute("class", `tab-lien${etat(j)}${etat(j).includes("apparait") ? " trace" : ""}`);
      lien.setAttribute("data-de", String(numerotees[n]!.k));
      lien.setAttribute("data-a", String(k));
      lien.setAttribute("pathLength", "1");
      lien.style.setProperty("--i", String(n));
      svg.append(lien);
    });
  });
  racine.append(grille);
  if (t.legende?.length) racine.append(legendeDeComposition(ctx, t.legende));
  return racine;
}

/** Le pictogramme d'une diapositive de texte (celui de sa disposition d'origine : objectifs, règles du jeu…), sur le côté. */
function pictogrammeDeCote(ctx: Contexte, b: BlocDeSalle, corps: HTMLElement): void {
  const v = duVisuel(b, "pictogramme");
  const i = image(ctx, v, "");
  if (!i) return;
  const cote = el(ctx.doc, "div", "pictogramme-cote");
  // Posé à l'origine sur un aplat (une icône blanche sur un bandeau) : il le garde, en disque, à la couleur de son rôle.
  if (v?.fond && v.fond !== "papier") {
    const disque = el(ctx.doc, "div", "disque");
    disque.style.background = `var(--dessin-${v.fond})`;
    disque.append(i);
    cote.append(disque);
  } else cote.append(i);
  corps.append(cote);
}

function puce(ctx: Contexte, texte: string, classe: string): HTMLElement {
  return el(ctx.doc, "span", `puce ${classe}`, texte);
}

/** La diapositive d'un bloc à une étape donnée. */
export function rendreDiapo(ctx: Contexte, seq: SequenceDeSalle, b: BlocDeSalle, rang: number, etape: number): HTMLElement {
  const d = el(ctx.doc, "section", `diapo f-${b.figure}${ctx.anime === "bloc" ? " entree" : ""}`);
  const devoile = b.etapes > 0;
  const plein = ["couverture", "transition", "ecran-animation", "demonstration"].includes(b.figure);
  if (!plein) {
    const entete = el(ctx.doc, "header", "entete");
    const vs = duVisuel(b, "section");
    const section = image(ctx, vs, "section");
    if (section && vs?.fond) section.style.background = `var(--dessin-${vs.fond})`;
    const titre = el(ctx.doc, "div", "titre-entete");
    if (section) titre.append(section);
    titre.append(el(ctx.doc, "h1", "", b.titre ?? ""));
    entete.append(titre, el(ctx.doc, "img", "logo", undefined, { src: ctx.medias.logo ?? "", alt: "Onet" }));
    d.append(entete);
  }
  const corps = el(ctx.doc, "div", "corps");
  switch (b.figure) {
    case "couverture": {
      corps.append(el(ctx.doc, "img", "logo-grand", undefined, { src: ctx.medias.logo ?? "", alt: "Onet" }));
      const [premier, ...reste] = [b.titre ?? "", ...b.lignes].filter(Boolean);
      corps.append(el(ctx.doc, "h1", "titre-couverture", premier ?? ""), liste(ctx, reste, 0, false, "sous-titres"));
      // La photo de la couverture d'origine, en panneau.
      const photo = b.visuels.find((v) => !v.role && ctx.medias[v.media]);
      if (photo) {
        const panneau = el(ctx.doc, "div", "photo-couverture");
        panneau.style.backgroundImage = `url("${ctx.medias[photo.media]}")`;
        d.append(panneau);
      }
      break;
    }
    case "transition":
      corps.append(el(ctx.doc, "div", "numero", seq.numero !== null ? String(seq.numero) : ""), el(ctx.doc, "h1", "", b.titre ?? ""), el(ctx.doc, "div", "filet"), liste(ctx, b.lignes, 0, false, "sommaire"));
      break;
    case "ecran-animation": {
      const [premier, ...reste] = b.lignes;
      corps.append(ecran(ctx, b, [el(ctx.doc, "div", "grand", premier ?? b.titre ?? ""), ...reste.map((l) => el(ctx.doc, "p", "", l))]));
      break;
    }
    case "demonstration":
      corps.append(ecran(ctx, b, [el(ctx.doc, "div", "etiquette", "Démonstration"), el(ctx.doc, "div", "grand", b.lignes.filter((l) => !/démonstration/i.test(l)).join(" ") || b.titre || "")]));
      break;
    case "mise-en-pratique": {
      const texte = el(ctx.doc, "div", "texte");
      texte.append(puce(ctx, "À vous de jouer", "a-vous"), defile(ctx, liste(ctx, b.lignes, etape, devoile)));
      if (b.aide) texte.append(el(ctx.doc, "p", "aide", "Vous pouvez vous aider du pas-à-pas."));
      const d = duree(ctx, b);
      if (d) texte.append(d);
      corps.append(texte);
      pictogrammeDeCote(ctx, b, corps);
      break;
    }
    case "etapes-cles":
      corps.append(defile(ctx, b.structure ? structure(ctx, b.structure, etape, devoile) : liste(ctx, b.lignes, etape, devoile, "liste numerotee")));
      pictogrammeDeCote(ctx, b, corps);
      break;
    case "pas-a-pas":
      corps.append(pasAPas(ctx, b, etape));
      break;
    case "schema":
      // Les textes d'un schéma sont les étiquettes de son dessin : ils ne se listent pas à côté.
      corps.classList.add("centre");
      if (b.composition?.gabarit === "cas") corps.append(cas(ctx, b.composition, etape, b.etapes > 0));
      else if (b.composition?.gabarit === "tableau") corps.append(composerTableau(ctx, b.composition, etape, b.etapes > 0, b.id));
      else if (b.dessin) corps.append(schema(ctx, b, etape));
      else corps.append(...visuels(ctx, b, CORPS.largeur, CORPS.hauteur));
      break;
    case "capture":
      corps.classList.add("centre");
      corps.append(...visuels(ctx, b, CORPS.largeur, CORPS.hauteur));
      if (b.lignes.length) corps.append(liste(ctx, b.lignes, 0, false, "liste legende"));
      break;
    case "processus":
      corps.classList.add("colonne");
      corps.append(defile(ctx, ...b.tableaux.map((t) => tableau(ctx, t)), ...(b.lignes.length ? [liste(ctx, b.lignes, 0, false, "liste legende")] : [])));
      break;
    case "glossaire":
      corps.append(defile(ctx, liste(ctx, b.lignes, 0, false, "liste glossaire")));
      break;
    case "renvoi":
      corps.classList.add("centre");
      corps.append(el(ctx.doc, "div", "etiquette", "Support associé"), liste(ctx, b.lignes, 0, false, "sommaire"));
      break;
    default: {
      const texte = el(ctx.doc, "div", "texte");
      texte.append(defile(ctx, b.structure ? structure(ctx, b.structure, etape, devoile) : liste(ctx, b.lignes, etape, devoile), ...b.tableaux.map((t) => tableau(ctx, t))));
      corps.append(texte);
      const illustrations = new Set(b.structure?.rangees.flatMap((r) => r.colonnes.flatMap((c) => (c.visuel ? [c.visuel] : []))) ?? []);
      const libres = b.visuels.filter((v) => !illustrations.has(v.media) && v.role !== "section" && v.role !== "duree" && v.role !== "pictogramme");
      if (!libres.length) pictogrammeDeCote(ctx, b, corps);
      if (libres.length) {
        const colonne = el(ctx.doc, "div", "visuels");
        colonne.append(...visuels(ctx, { ...b, visuels: libres }, 680, CORPS.hauteur));
        corps.append(colonne);
      }
    }
  }
  d.append(corps);
  if (!plein) {
    const pied = el(ctx.doc, "footer", "pied");
    pied.append(el(ctx.doc, "span", "", seq.numero !== null ? `Séquence ${seq.numero} · ${seq.titre}` : seq.titre), el(ctx.doc, "span", "", `${rang + 1} / ${seq.blocs.length}`));
    d.append(pied);
  }
  return d;
}
