// Les activités dérivées en salle (ACT-1) : leur rendu par geste et la régie au clavier. La salle répond à voix haute ou à
// main levée, l'animateur saisit ce qui sort (Rappel), l'ordre dicté (Classement), la colonne de chaque carte
// (Catégorisation), puis dévoile le corrigé ; à la télécommande, → suffit : consigne, puis corrigé. Rien ne quitte la page.
import { TOUCHES_DE_REGIE } from "../../activites/habillage";
import { LIBELLES_DE_GESTE } from "../../pivot/libelles";
import type { BlocDeSalle } from "../donnees";
import { capture, el, type Contexte } from "./rendu";

/** Une saisie de la régie ; l'état d'une activité est la suite de ses saisies (⌫ retire la dernière). */
type Saisie = { readonly n: number } | { readonly carte: number; readonly colonne: number };

export interface EtatDActivite {
  readonly saisies: readonly Saisie[];
  /** La carte choisie, en attente de sa colonne (Catégorisation). */
  readonly carte: number | null;
}

export const ETAT_INITIAL: EtatDActivite = { saisies: [], carte: null };

/** Ce que la régie reçoit : un chiffre de 1 à 9, ⌫, Échap. */
export type Action = number | "retour" | "echap";

type ContenuDe<G extends string> = Extract<NonNullable<BlocDeSalle["activite"]>["contenu"], { geste: G }>;

/** Le Rappel : les éléments marqués, dans l'ordre où ils sont sortis (marquer deux fois retire la marque). */
function sortis(e: EtatDActivite): number[] {
  const out: number[] = [];
  for (const s of e.saisies) if ("n" in s) { const i = out.indexOf(s.n); if (i >= 0) out.splice(i, 1); else out.push(s.n); }
  return out;
}

/** Le Classement : les numéros de présentation dans l'ordre dicté. */
const dictes = (e: EtatDActivite): number[] => e.saisies.flatMap((s) => ("n" in s ? [s.n] : []));

/** La Catégorisation : la colonne où la salle a rangé chaque carte (la dernière saisie l'emporte). */
function rangees(e: EtatDActivite): Map<number, number> {
  const m = new Map<number, number>();
  for (const s of e.saisies) if ("carte" in s) m.set(s.carte, s.colonne);
  return m;
}

/** Une activité est en jeu à sa première étape (la consigne), une Sélection sur image n'attend rien du clavier. */
const enJeu = (b: BlocDeSalle, etape: number) => b.activite && b.activite.geste !== "selection-sur-image" && etape === 1;

/** Une action de la régie sur l'activité courante : le nouvel état, ou `null` si elle ne la concerne pas (la touche garde son sens). */
export function saisir(b: BlocDeSalle, etape: number, e: EtatDActivite, a: Action): EtatDActivite | null {
  const act = b.activite;
  if (!act || !enJeu(b, etape)) return null;
  if (a === "echap") return e.carte !== null ? { ...e, carte: null } : null;
  if (a === "retour") return e.carte !== null ? { ...e, carte: null } : e.saisies.length ? { ...e, saisies: e.saisies.slice(0, -1) } : null;
  const c = act.contenu;
  switch (c.geste) {
    case "rappel":
      return a <= c.items.length ? { ...e, saisies: [...e.saisies, { n: a }] } : e;
    case "classement": {
      const deja = dictes(e);
      return a <= c.items.length && !deja.includes(a) ? { ...e, saisies: [...e.saisies, { n: a }] } : e;
    }
    case "categorisation":
      if (e.carte !== null && a <= c.categories.length) return { saisies: [...e.saisies, { carte: e.carte, colonne: a }], carte: null };
      return a <= c.cartes.length ? { ...e, carte: a } : e;
    default:
      return null;
  }
}

/** Ce que le présentateur lit sous les notes : les touches du geste, et ce que la salle a déjà donné. */
export function regie(b: BlocDeSalle, e: EtatDActivite): string {
  const act = b.activite;
  if (!act) return "";
  const c = act.contenu;
  const etat = c.geste === "rappel" ? `sortis : ${sortis(e).join(", ") || "aucun"} sur ${c.items.length}`
    : c.geste === "classement" ? `ordre dicté : ${dictes(e).join(", ") || "—"}`
      : c.geste === "categorisation" ? `rangées : ${rangees(e).size} cartes sur ${c.cartes.length}${e.carte !== null ? ` · carte ${e.carte} choisie` : ""}` : "";
  return `Régie (${LIBELLES_DE_GESTE[act.geste]}) — ${TOUCHES_DE_REGIE[act.geste]}${etat ? `\n${etat}` : ""}`;
}

const numero = (ctx: Contexte, n: number | string, classe = "num-act") => el(ctx.doc, "span", classe, String(n));

/** Le Rappel : une case par élément ; ce qui sort paraît aussitôt, le reste au corrigé. */
function rappel(ctx: Contexte, c: ContenuDe<"rappel">, corrige: boolean, e: EtatDActivite): HTMLElement {
  const marques = sortis(e);
  const dernier = e.saisies.length ? marques[marques.length - 1] : undefined;
  const ol = el(ctx.doc, "ol", "act-rappel");
  ol.style.setProperty("--n", String(c.items.length));
  c.items.forEach((t, i) => {
    const sorti = marques.includes(i + 1);
    const li = el(ctx.doc, "li", sorti ? "sorti" : corrige ? "a-retenir" : "vide");
    if (corrige && !sorti) li.style.setProperty("--i", String(i));
    if (sorti && dernier === i + 1 && ctx.anime === "aucun") li.classList.add("neuf");
    li.append(numero(ctx, i + 1), el(ctx.doc, "span", "texte-act", sorti || corrige ? t : ""));
    ol.append(li);
  });
  return ol;
}

/** Le Classement : les éléments mélangés, numérotés ; l'ordre dicté se remplit à côté ; le corrigé dit ce qui était juste. */
function classement(ctx: Contexte, c: ContenuDe<"classement">, corrige: boolean, e: EtatDActivite): HTMLElement {
  const ordre = dictes(e);
  const racine = el(ctx.doc, "div", "act-classement");
  racine.style.setProperty("--n", String(c.items.length));
  const propositions = el(ctx.doc, "ol", "act-propositions");
  c.presentation.forEach((i, k) => {
    const li = el(ctx.doc, "li", ordre.includes(k + 1) ? "placee" : "");
    li.append(numero(ctx, k + 1), el(ctx.doc, "span", "texte-act", c.items[i]!));
    propositions.append(li);
  });
  const ordonne = el(ctx.doc, "ol", "act-ordre");
  c.items.forEach((juste, rang) => {
    const dicte = ordre[rang];
    const propose = dicte !== undefined ? c.items[c.presentation[dicte - 1]!]! : undefined;
    const li = el(ctx.doc, "li", corrige ? (propose === undefined ? "corrige" : propose === juste ? "corrige juste" : "corrige faux") : propose === undefined ? "vide" : "remplie");
    if (corrige) li.style.setProperty("--i", String(rang));
    if (!corrige && dicte !== undefined && rang === ordre.length - 1 && ctx.anime === "aucun") li.classList.add("neuf");
    li.append(numero(ctx, rang + 1, "rang-act"));
    if (corrige) {
      li.append(el(ctx.doc, "span", "texte-act", juste));
      if (propose !== undefined && propose !== juste) li.append(el(ctx.doc, "span", "dicte", `dicté : ${dicte}`));
    } else if (propose !== undefined) li.append(numero(ctx, dicte!), el(ctx.doc, "span", "texte-act", propose));
    ordonne.append(li);
  });
  racine.append(propositions, ordonne);
  return racine;
}

/** La Catégorisation : les cartes à ranger, numérotées ; les colonnes, numérotées ; au corrigé, chaque carte à sa place. */
function categorisation(ctx: Contexte, c: ContenuDe<"categorisation">, corrige: boolean, e: EtatDActivite): HTMLElement {
  const places = rangees(e);
  const derniere = e.saisies[e.saisies.length - 1];
  const racine = el(ctx.doc, "div", "act-categorisation");
  racine.style.setProperty("--n", String(c.categories.length));
  const carte = (k: number) => {
    const i = c.presentation[k]!;
    const div = el(ctx.doc, "div", "carte-act");
    if (e.carte === k + 1 && !corrige) div.classList.add("choisie");
    if (!corrige && derniere && "carte" in derniere && derniere.carte === k + 1 && ctx.anime === "aucun") div.classList.add("neuf");
    if (corrige) {
      const rangee = places.get(k + 1);
      div.classList.add(rangee === undefined ? "corrige" : rangee - 1 === c.cartes[i]!.categorie ? "juste" : "faux");
      div.style.setProperty("--i", String(k));
    }
    div.append(numero(ctx, k + 1), el(ctx.doc, "span", "texte-act", c.cartes[i]!.texte));
    return div;
  };
  const reserve = el(ctx.doc, "div", "act-reserve");
  if (!corrige) c.presentation.forEach((_, k) => { if (!places.has(k + 1)) reserve.append(carte(k)); });
  const colonnes = el(ctx.doc, "div", "act-colonnes");
  c.categories.forEach((nom, j) => {
    const col = el(ctx.doc, "section", "colonne-act");
    const tete = el(ctx.doc, "header", "tete-act");
    tete.append(numero(ctx, j + 1, "num-colonne"), el(ctx.doc, "span", "", nom));
    col.append(tete);
    c.presentation.forEach((i, k) => {
      if (corrige ? c.cartes[i]!.categorie === j : places.get(k + 1) === j + 1) col.append(carte(k));
    });
    colonnes.append(col);
  });
  racine.append(el(ctx.doc, "div", "intitule-act", c.intitule), reserve, colonnes);
  return racine;
}

/** La Sélection sur image : la capture sans ses zones ; la consigne du pas, puis sa zone ; les pas faits gardent la leur. */
function selection(ctx: Contexte, b: BlocDeSalle, c: ContenuDe<"selection-sur-image">, etape: number): HTMLElement {
  const racine = el(ctx.doc, "div", "act-selection");
  const k = Math.max(0, Math.ceil(etape / 2) - 1);
  const courant = c.pas[k];
  const devoile = etape > 0 && etape % 2 === 0;
  const v = b.visuels.find((x) => x.media === courant?.capture) ?? b.visuels[0];
  if (v) {
    const cap = capture(ctx, v, 1240, 760);
    c.pas.forEach((p, j) => {
      if (p.capture !== v.media || j > k || (j === k && !devoile)) return;
      const [x, y, w, h] = p.zone;
      const z = el(ctx.doc, "div", `zone${j === k ? " courante" : " faite"}${j === k && ctx.anime !== "aucun" ? " apparait" : ""}`);
      Object.assign(z.style, { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });
      z.append(el(ctx.doc, "span", "num", String(p.numero)));
      cap.plan.append(z);
    });
    racine.append(cap.boite);
  }
  const ol = el(ctx.doc, "ol", "act-pas");
  c.pas.forEach((p, j) => {
    const li = el(ctx.doc, "li", j < k || (j === k && devoile) ? "faite" : j === k ? "courant" : "a-venir");
    li.append(numero(ctx, p.numero), el(ctx.doc, "span", "texte-act", j <= k ? p.consigne : ""));
    ol.append(li);
  });
  racine.append(ol);
  return racine;
}

/**
 * Une activité à son étape : sa consigne, d'où elle dérive, son geste et sa durée, puis le jeu selon le geste — la consigne
 * à l'étape 1, le corrigé à la suivante (une Sélection sur image : la consigne de chaque pas, puis sa zone).
 */
export function activite(ctx: Contexte, b: BlocDeSalle, etape: number, e: EtatDActivite): HTMLElement {
  const act = b.activite!;
  const corps = el(ctx.doc, "div", "act compo");
  const tete = el(ctx.doc, "div", "act-tete");
  const puces = el(ctx.doc, "div", "act-puces");
  puces.append(el(ctx.doc, "span", "puce geste-act", LIBELLES_DE_GESTE[act.geste]));
  if (b.duree) puces.append(el(ctx.doc, "span", "puce duree", `${b.duree} minutes`));
  tete.append(el(ctx.doc, "p", "consigne-act", act.consigne), el(ctx.doc, "p", "source-act", act.source), puces);
  const corrige = etape >= b.etapes || b.etapes === 0;
  const c = act.contenu;
  const jeu = c.geste === "rappel" ? rappel(ctx, c, corrige, e)
    : c.geste === "classement" ? classement(ctx, c, corrige, e)
      : c.geste === "categorisation" ? categorisation(ctx, c, corrige, e) : selection(ctx, b, c, etape);
  if (corrige && c.geste !== "selection-sur-image") corps.classList.add("au-corrige");
  corps.append(tete, jeu);
  return corps;
}
