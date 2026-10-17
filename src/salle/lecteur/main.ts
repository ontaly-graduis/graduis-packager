// Le lecteur de salle : charge les données embarquées, met la scène à l'échelle, navigue au clavier, pilote le présentateur.
import type { DonneesDeSalle } from "../donnees";
import { debut, fin, precedent, suivant, type Position } from "./etat";
import { rendreDiapo, type Contexte } from "./rendu";
import { ajusterTextes } from "./textes";
import { debutsDePages, decalageCourant, decalagePage, type Item } from "./defilement";

const lire = <T>(id: string): T => JSON.parse(document.getElementById(id)?.textContent ?? "null") as T;
const donnees = lire<DonneesDeSalle>("donnees");
const medias = lire<Record<string, string>>("medias");
const plats = donnees.sequences.flatMap((s) => s.blocs.map((b, rang) => ({ s, b, rang })));
/** Les étapes de chaque bloc : celles du dévoilement, ou les pages d'un contenu statique qui déborde (mesurées au rendu). */
const etapes = plats.map((x) => x.b.etapes);

let pos: Position = debut();
let zoom = false;
let noir = false;
let notes = false;
let aide = false;
const debutSeance = Date.now();
let minuteur: { fin: number; pause: number | null } | null = null;
let presentateur: Window | null = null;
/** Le sens du dernier mouvement : un retour arrive sur la dernière page du bloc précédent. */
let sens: "avant" | "arriere" | "saut" = "saut";
let blocRendu = -1;
let etapeRendue = -1;
/** Les transformations des éléments qui glissent (rail, plan de capture), pour les animer d'une étape à l'autre. */
const glisses = new Map<string, string>();

const scene = document.getElementById("scene")!;
const surcouche = document.getElementById("surcouche")!;

/** Les commandes de la salle, telles que l'aide les présente. */
const COMMANDES: readonly (readonly [readonly string[], string])[] = [
  [["→", "↓", "Espace", "Entrée", "Page ↓"], "Avancer : pas suivant, page suivante, diapositive suivante"],
  [["←", "↑", "Page ↑", "⌫"], "Reculer"],
  [["Origine", "Fin"], "Aller au début, à la fin"],
  [["Z"], "Zoomer sur le pas courant d'une capture (et revenir)"],
  [["T"], "Minuteur de l'activité : démarrer, mettre en pause"],
  [["B", "."], "Écran noir"],
  [["N"], "Notes de l'animateur en surimpression"],
  [["P"], "Fenêtre du présentateur : diapositive courante, suivante, notes, chrono"],
  [["F"], "Plein écran"],
  [["?"], "Cette aide"],
  [["Échap"], "Tout fermer : zoom, écran noir, notes, aide"],
];

/** Le bouton « ? » : discret en projection, il paraît quand la souris bouge. */
const boutonAide = document.createElement("button");
boutonAide.className = "aide-bouton";
boutonAide.type = "button";
boutonAide.textContent = "?";
boutonAide.setAttribute("aria-label", "Aide : les commandes de la salle (touche ?)");
boutonAide.addEventListener("click", () => {
  aide = !aide;
  rendreSurcouche();
});
document.body.append(boutonAide);
let veille: number | undefined;
document.addEventListener("mousemove", () => {
  boutonAide.classList.add("visible");
  clearTimeout(veille);
  veille = window.setTimeout(() => boutonAide.classList.remove("visible"), 2500);
});

function panneauAide(): HTMLElement {
  const p = document.createElement("div");
  p.className = "aide-commandes";
  p.setAttribute("role", "dialog");
  p.setAttribute("aria-label", "Commandes de la salle");
  const titre = document.createElement("h2");
  titre.textContent = "Commandes de la salle";
  const table = document.createElement("table");
  for (const [touches, effet] of COMMANDES) {
    const tr = document.createElement("tr");
    const k = document.createElement("td");
    touches.forEach((t, i) => {
      if (i) k.append(" ");
      const kbd = document.createElement("kbd");
      kbd.textContent = t;
      k.append(kbd);
    });
    const e = document.createElement("td");
    e.textContent = effet;
    tr.append(k, e);
    table.append(tr);
  }
  const pied = document.createElement("p");
  pied.textContent = "L'adresse garde la diapositive et l'étape (#b034.2) : on reprend une séance là où on l'a laissée.";
  p.append(titre, table, pied);
  return p;
}

function depuisAncre(): void {
  const [id, e] = decodeURIComponent(location.hash.slice(1)).split(".");
  const i = plats.findIndex((x) => x.b.id === id);
  // Un contenu statique n'a ses pages qu'une fois mesuré : son étape se borne au rendu.
  if (i >= 0) pos = { bloc: i, etape: plats[i]!.b.etapes > 0 ? Math.min(Number(e) || 0, etapes[i] ?? 0) : Number(e) || 0 };
}

function echelle(): void {
  const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  scene.style.transform = `translate(-50%, -50%) scale(${s})`;
}

const mmss = (ms: number) => {
  const t = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

function rendreSurcouche(): void {
  surcouche.replaceChildren();
  if (minuteur) {
    const restant = minuteur.pause !== null ? minuteur.fin - minuteur.pause : minuteur.fin - Date.now();
    const chip = document.createElement("div");
    chip.className = `minuteur${restant < 60000 ? " bientot" : ""}${minuteur.pause !== null ? " pause" : ""}`;
    chip.textContent = mmss(restant);
    surcouche.append(chip);
  }
  if (notes) {
    const n = document.createElement("div");
    n.className = "notes";
    n.textContent = plats[pos.bloc]?.b.notes || "Pas de notes pour cette diapositive.";
    surcouche.append(n);
  }
  if (noir) {
    const n = document.createElement("div");
    n.className = "noir";
    surcouche.append(n);
  }
  if (aide) surcouche.append(panneauAide());
  boutonAide.classList.toggle("ouvert", aide);
}

function contexte(doc: Document, z: boolean, anime: Contexte["anime"]): Contexte {
  return { doc, medias, zoom: z, anime };
}

/**
 * Mesure les fenêtres défilantes d'une diapositive rendue et décale leurs rails : en dévoilement, la pile suit
 * l'item courant ; un contenu statique se lit page par page (l'étape vaut la page). Rend le nombre de pages.
 */
function ajuster(racine: Element, etapesDuDevoilement: number, etape: number): number {
  ajusterTextes(racine);
  let pages = 1;
  racine.querySelectorAll<HTMLElement>(".defile").forEach((f, k) => {
    const rail = f.querySelector<HTMLElement>(".rail");
    if (!rail) return;
    const r0 = rail.getBoundingClientRect();
    const s = r0.height / (rail.offsetHeight || 1) || 1;
    const items: (Item & { e: Element })[] = [...rail.querySelectorAll("li, tr")].map((e) => {
      const r = e.getBoundingClientRect();
      return { haut: (r.top - r0.top) / s, bas: (r.bottom - r0.top) / s, e };
    });
    const total = rail.offsetHeight;
    const fenetre = f.clientHeight;
    let decalage = 0;
    if (etapesDuDevoilement > 0) {
      const courant = items.find((x) => x.e.classList.contains("courant"));
      decalage = courant ? decalageCourant(courant, total, fenetre) : 0;
    } else {
      const debuts = debutsDePages(items, fenetre);
      if (k === 0) pages = debuts.length;
      decalage = decalagePage(debuts, etape, total, fenetre);
      f.classList.toggle("bas", decalage < total - fenetre - 1);
    }
    f.classList.toggle("haut", decalage > 1);
    rail.style.transform = decalage ? `translateY(${-decalage}px)` : "";
  });
  return pages;
}

/** Anime d'une étape à l'autre ce qui glisse (rail, plan zoomé) : de la transformation d'avant vers la nouvelle. */
function glisser(racine: Element, memeBloc: boolean): void {
  racine.querySelectorAll<HTMLElement>("[data-glisse]").forEach((e, i) => {
    const cle = `${e.dataset.glisse}-${i}`;
    const nouvelle = e.style.transform;
    const avant = glisses.get(cle) ?? "";
    if (memeBloc && avant !== nouvelle) {
      e.style.transition = "none";
      e.style.transform = avant;
      void e.offsetWidth;
      e.style.transition = "";
      e.style.transform = nouvelle;
    }
    glisses.set(cle, nouvelle);
  });
}

/** Le volet de la séquence : en quittant sa transition, le panneau navy balaie l'écran et révèle la suite. */
function volet(x: (typeof plats)[number]): HTMLElement {
  const v = document.createElement("div");
  v.className = "volet";
  const sur = document.createElement("div");
  sur.className = "surtitre";
  sur.textContent = x.s.numero !== null ? `Séquence ${x.s.numero}` : "";
  const titre = document.createElement("div");
  titre.className = "titre";
  titre.textContent = x.s.titre;
  v.append(sur, titre);
  v.addEventListener("animationend", (e) => { if (e.target === v) v.remove(); });
  return v;
}

function rendre(): void {
  const x = plats[pos.bloc];
  if (!x) return;
  const memeBloc = blocRendu === pos.bloc;
  const avant = plats[blocRendu];
  const avecVolet = !memeBloc && sens === "avant" && avant?.b.figure === "transition" && avant.s === x.s;
  const anime = !memeBloc ? "bloc" : etapeRendue !== pos.etape ? "etape" : "aucun";
  const diapo = rendreDiapo(contexte(document, zoom, anime), x.s, x.b, x.rang, pos.etape);
  if (avecVolet) diapo.classList.add("apres-volet");
  scene.replaceChildren(diapo, ...(avecVolet ? [volet(x)] : []));
  if (!memeBloc) glisses.clear();
  if (x.b.etapes === 0) {
    const pages = ajuster(diapo, 0, pos.etape);
    const mesuree = etapes[pos.bloc] !== pages - 1;
    etapes[pos.bloc] = pages - 1;
    const etape = sens === "arriere" && !memeBloc && mesuree ? pages - 1 : Math.min(pos.etape, pages - 1);
    if (etape !== pos.etape) {
      pos = { bloc: pos.bloc, etape };
      ajuster(diapo, 0, pos.etape);
    }
  } else {
    ajuster(diapo, x.b.etapes, pos.etape);
  }
  glisser(diapo, memeBloc);
  blocRendu = pos.bloc;
  etapeRendue = pos.etape;
  history.replaceState(null, "", `#${x.b.id}.${pos.etape}`);
  rendreSurcouche();
  rendrePresentateur();
}

function rendrePresentateur(): void {
  const w = presentateur;
  if (!w || w.closed) return;
  const d = w.document;
  const x = plats[pos.bloc];
  if (!x) return;
  const ensuite = suivant(pos, etapes);
  const y = plats[ensuite.bloc]!;
  const cadre = (id: string, s: typeof x, etape: number) => {
    const v = d.getElementById(id)!;
    const c = d.createElement("div");
    c.className = "cadre";
    const diapo = rendreDiapo(contexte(d, false, "aucun"), s.s, s.b, s.rang, etape);
    c.append(diapo);
    c.style.transform = `scale(${v.clientWidth / 1920})`;
    v.replaceChildren(c);
    ajuster(diapo, s.b.etapes, etape);
  };
  cadre("courante", x, pos.etape);
  cadre("suivante", y, ensuite.etape);
  d.getElementById("notes")!.textContent = x.b.notes || "Pas de notes pour cette diapositive.";
  d.getElementById("position")!.textContent =
    `${x.s.numero !== null ? `Séquence ${x.s.numero} · ` : ""}${x.rang + 1} / ${x.s.blocs.length}${x.b.etapes ? ` · étape ${pos.etape} / ${x.b.etapes}` : ""}`;
}

function ouvrirPresentateur(): void {
  if (presentateur && !presentateur.closed) {
    presentateur.focus();
    return;
  }
  const w = window.open("", "salle-presentateur", "width=1280,height=760");
  if (!w) return;
  const styles = [...document.querySelectorAll("style")].map((s) => s.textContent ?? "").join("\n");
  w.document.open();
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Présentateur — ${document.title}</title><style>${styles}</style></head>`
    + `<body class="presentateur"><div class="colonne-g"><div class="vignette" id="courante"></div><div class="barre"><span id="position"></span><span id="chrono"></span></div></div>`
    + `<div class="colonne-d"><div class="vignette petite" id="suivante"></div><div class="notes-p" id="notes"></div>`
    + `<div class="rappel">→ avancer · ← reculer · Z zoom · T minuteur · B noir · ? aide (dans la salle)</div></div></body></html>`);
  w.document.close();
  w.document.addEventListener("keydown", touche);
  w.addEventListener("resize", rendrePresentateur);
  presentateur = w;
  rendrePresentateur();
}

function basculerMinuteur(): void {
  const duree = (plats[pos.bloc]?.b.duree ?? 10) * 60000;
  if (!minuteur) minuteur = { fin: Date.now() + duree, pause: null };
  else if (minuteur.pause === null) minuteur = { ...minuteur, pause: Date.now() };
  else minuteur = { fin: minuteur.fin + (Date.now() - minuteur.pause), pause: null };
}

function touche(e: KeyboardEvent): void {
  const avant = pos;
  switch (e.key) {
    case "ArrowRight": case "ArrowDown": case "PageDown": case " ": case "Enter":
      pos = suivant(pos, etapes); sens = "avant"; break;
    case "ArrowLeft": case "ArrowUp": case "PageUp": case "Backspace":
      pos = precedent(pos, etapes); sens = "arriere"; break;
    case "Home": pos = debut(); sens = "saut"; break;
    case "End": pos = fin(etapes); sens = "saut"; break;
    case "b": case "B": case ".": noir = !noir; break;
    case "z": case "Z": zoom = !zoom; break;
    case "n": case "N": notes = !notes; break;
    case "t": case "T": basculerMinuteur(); break;
    case "p": case "P": ouvrirPresentateur(); break;
    case "f": case "F": void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()); break;
    case "?": aide = !aide; rendreSurcouche(); e.preventDefault(); return;
    case "Escape": zoom = false; noir = false; notes = false; aide = false; break;
    default: return;
  }
  e.preventDefault();
  if (avant.bloc !== pos.bloc) minuteur = null;
  rendre();
}

document.addEventListener("keydown", touche);
window.addEventListener("resize", echelle);
// Une ancre saisie ou suivie (`#b034.2`) mène à ce bloc, à cette étape ; `replaceState` ne déclenche pas cet évènement.
window.addEventListener("hashchange", () => {
  depuisAncre();
  sens = "saut";
  rendre();
});
setInterval(() => {
  if (minuteur) rendreSurcouche();
  const chrono = presentateur && !presentateur.closed ? presentateur.document.getElementById("chrono") : null;
  if (chrono) chrono.textContent = mmss(Date.now() - debutSeance);
}, 1000);
depuisAncre();
echelle();
rendre();
// Les polices inline se chargent de façon asynchrone : les textes des schémas se réajustent une fois la police prête.
void document.fonts?.ready.then(() => ajusterTextes(scene));
