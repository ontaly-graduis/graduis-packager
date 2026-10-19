// Le plan de la séance : toutes les diapositives par séquence, filtrables au clavier ; on y choisit où aller.
import { libelleDeBloc } from "../../pivot/libelles";
import type { DonneesDeSalle } from "../donnees";
import { el } from "./rendu";

interface Entree {
  /** L'indice du bloc dans la salle (0…n-1) ; son numéro affiché est l'indice + 1. */
  readonly bloc: number;
  readonly titre: string;
  readonly figure: string;
}

/** Le texte où chercher : sans accents ni casse. */
const plier = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Les séquences du plan, numérotées comme la salle les enchaîne. */
export function sequencesDuPlan(d: DonneesDeSalle): { titre: string; entrees: Entree[] }[] {
  let bloc = 0;
  return d.sequences.map((s) => ({
    titre: s.numero !== null ? `Séquence ${s.numero} · ${s.titre}` : s.titre,
    entrees: s.blocs.map((b) => ({ bloc: bloc++, titre: b.titre || b.lignes[0] || libelleDeBloc(b), figure: libelleDeBloc(b) })),
  }));
}

/**
 * Le panneau du plan, posé dans le document qui l'a demandé (la salle, ou le présentateur : le choix ne se voit pas en salle).
 * Taper filtre (titre, figure, séquence, ou numéro) ; ↑ ↓ choisissent ; Entrée ou un clic y va ; Échap ou un clic à côté ferme.
 */
export function panneauDuPlan(doc: Document, sequences: ReturnType<typeof sequencesDuPlan>, courant: number, aller: (bloc: number) => void, fermer: () => void): HTMLElement {
  const fond = el(doc, "div", "plan-seance-fond");
  const p = el(doc, "div", "plan-seance");
  p.setAttribute("role", "dialog");
  p.setAttribute("aria-label", "Plan de la séance");
  const champ = el(doc, "input");
  champ.type = "search";
  champ.placeholder = "Filtrer : titre, figure, séquence ou numéro";
  champ.setAttribute("aria-label", "Filtrer les diapositives");
  const liste = el(doc, "div", "plan-seance-liste");
  const items: { li: HTMLLIElement; section: HTMLElement; bloc: number; texte: string }[] = [];
  for (const s of sequences) {
    const section = el(doc, "section");
    const ol = el(doc, "ol");
    for (const x of s.entrees) {
      const li = el(doc, "li", x.bloc === courant ? "courant" : "");
      const b = el(doc, "button");
      b.type = "button";
      b.append(el(doc, "span", "num", String(x.bloc + 1)), el(doc, "span", "titre", x.titre), el(doc, "span", "figure", x.figure));
      b.addEventListener("click", () => aller(x.bloc));
      li.append(b);
      ol.append(li);
      items.push({ li, section, bloc: x.bloc, texte: plier(`${x.titre} ${x.figure} ${s.titre}`) });
    }
    section.append(el(doc, "h3", "", s.titre), ol);
    liste.append(section);
  }
  p.append(el(doc, "h2", "", "Aller à une diapositive"), champ, liste, el(doc, "p", "", "↑ ↓ choisir · Entrée y aller · Échap fermer"));
  fond.append(p);

  let actif = 0;
  const visibles = () => items.filter((x) => !x.li.hidden);
  const marquer = (i: number, ou: ScrollLogicalPosition = "nearest") => {
    const v = visibles();
    actif = Math.max(0, Math.min(i, v.length - 1));
    items.forEach((x) => x.li.classList.remove("actif"));
    v[actif]?.li.classList.add("actif");
    v[actif]?.li.scrollIntoView({ block: ou });
  };
  const filtrer = () => {
    const q = plier(champ.value.trim());
    const numero = /^\d+$/.test(q);
    for (const x of items) x.li.hidden = q !== "" && !(numero ? String(x.bloc + 1).startsWith(q) : x.texte.includes(q));
    for (const s of new Set(items.map((x) => x.section))) s.hidden = !items.some((x) => x.section === s && !x.li.hidden);
    // Sans filtre, la courante, au milieu de la liste ; filtré, la première trouvée.
    if (q === "") marquer(Math.max(0, items.findIndex((x) => x.bloc === courant)), "center");
    else marquer(0);
  };
  champ.addEventListener("input", filtrer);
  fond.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") marquer(actif + (e.key === "ArrowDown" ? 1 : -1));
    else if (e.key === "Enter") {
      const x = visibles()[actif];
      if (x) aller(x.bloc);
    } else if (e.key === "Escape") fermer();
    else return;
    // La touche est au plan : la salle, qu'il vient de rendre, ne la voit pas.
    e.preventDefault();
    e.stopPropagation();
  });
  fond.addEventListener("click", (e) => {
    if (e.target === fond) fermer();
  });
  // Posé, le champ prend la main tout de suite (une touche frappée aussitôt est pour lui) ; la diapositive courante se montre.
  doc.body.append(fond);
  champ.focus();
  filtrer();
  return fond;
}
