// Le rendu d'un bloc de salle en diapositive 1920 × 1080, au thème : une composition par figure.
import type { BlocDeSalle, SequenceDeSalle, VisuelDeSalle } from "../donnees";

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

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, classe = "", texte?: string, attrs: Attrs = {}): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function liste(ctx: Contexte, lignes: readonly string[], etape: number, devoile: boolean, classe = "liste"): HTMLElement {
  const ul = el(ctx.doc, "ul", classe);
  lignes.forEach((l, i) => {
    const cache = devoile && i >= etape;
    const courant = devoile && i === etape - 1;
    ul.append(el(ctx.doc, "li", cache ? "cache" : courant ? `courant${ctx.anime === "etape" ? " apparait" : ""}` : "", l));
  });
  return ul;
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
function capture(ctx: Contexte, v: VisuelDeSalle, maxL: number, maxH: number): { boite: HTMLElement; plan: HTMLElement; l: number; h: number } {
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
  return b.visuels.slice(0, 2).map((v) => capture(ctx, v, maxL, maxH / Math.min(2, b.visuels.length)).boite);
}

function tableau(ctx: Contexte, lignes: readonly (readonly string[])[]): HTMLElement {
  const t = el(ctx.doc, "table", "tableau");
  lignes.forEach((ligne, i) => {
    const tr = el(ctx.doc, "tr");
    for (const cellule of ligne) tr.append(el(ctx.doc, i === 0 ? "th" : "td", "", cellule));
    t.append(tr);
  });
  return t;
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
    entete.append(el(ctx.doc, "h1", "", b.titre ?? ""), el(ctx.doc, "img", "logo", undefined, { src: ctx.medias.logo ?? "", alt: "Onet" }));
    d.append(entete);
  }
  const corps = el(ctx.doc, "div", "corps");
  switch (b.figure) {
    case "couverture": {
      corps.append(el(ctx.doc, "img", "logo-grand", undefined, { src: ctx.medias.logo ?? "", alt: "Onet" }));
      const [premier, ...reste] = [b.titre ?? "", ...b.lignes].filter(Boolean);
      corps.append(el(ctx.doc, "h1", "titre-couverture", premier ?? ""), liste(ctx, reste, 0, false, "sous-titres"));
      break;
    }
    case "transition":
      corps.append(el(ctx.doc, "div", "numero", seq.numero !== null ? String(seq.numero) : ""), el(ctx.doc, "h1", "", b.titre ?? ""), el(ctx.doc, "div", "filet"), liste(ctx, b.lignes, 0, false, "sommaire"));
      break;
    case "ecran-animation": {
      const [premier, ...reste] = b.lignes;
      corps.append(el(ctx.doc, "div", "grand", premier ?? b.titre ?? ""));
      for (const l of reste) corps.append(el(ctx.doc, "p", "", l));
      if (b.duree) corps.append(puce(ctx, `${b.duree} minutes`, "duree"));
      break;
    }
    case "demonstration":
      corps.append(el(ctx.doc, "div", "etiquette", "Démonstration"), el(ctx.doc, "div", "grand", b.lignes.filter((l) => !/démonstration/i.test(l)).join(" ") || b.titre || ""));
      break;
    case "mise-en-pratique": {
      corps.append(puce(ctx, "À vous de jouer", "a-vous"), defile(ctx, liste(ctx, b.lignes, etape, devoile)));
      if (b.aide) corps.append(el(ctx.doc, "p", "aide", "Vous pouvez vous aider du pas-à-pas."));
      if (b.duree) corps.append(puce(ctx, `${b.duree} minutes`, "duree"));
      break;
    }
    case "etapes-cles":
      corps.append(defile(ctx, liste(ctx, b.lignes, etape, devoile, "liste numerotee")));
      break;
    case "pas-a-pas":
      corps.append(pasAPas(ctx, b, etape));
      break;
    case "capture":
    case "schema":
      corps.classList.add("centre");
      corps.append(...visuels(ctx, b, CORPS.largeur, CORPS.hauteur));
      // Les textes d'un schéma sont les étiquettes de son dessin : ils ne se listent pas à côté.
      if (b.figure === "schema" && !b.visuels.length) corps.append(el(ctx.doc, "div", "etiquette", "Schéma dessiné — rendu vectoriel à venir (PKG-B2)"));
      if (b.figure === "capture" && b.lignes.length) corps.append(liste(ctx, b.lignes, 0, false, "liste legende"));
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
      texte.append(defile(ctx, liste(ctx, b.lignes, etape, devoile), ...b.tableaux.map((t) => tableau(ctx, t))));
      corps.append(texte);
      if (b.visuels.length) {
        const colonne = el(ctx.doc, "div", "visuels");
        colonne.append(...visuels(ctx, b, 680, CORPS.hauteur));
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
