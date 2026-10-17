// Le lecteur de salle : charge les données embarquées, met la scène à l'échelle, navigue au clavier, pilote le présentateur.
import type { DonneesDeSalle } from "../donnees";
import { debut, fin, precedent, suivant, type Position } from "./etat";
import { rendreDiapo, type Contexte } from "./rendu";

const lire = <T>(id: string): T => JSON.parse(document.getElementById(id)?.textContent ?? "null") as T;
const donnees = lire<DonneesDeSalle>("donnees");
const medias = lire<Record<string, string>>("medias");
const plats = donnees.sequences.flatMap((s) => s.blocs.map((b, rang) => ({ s, b, rang })));
const etapes = plats.map((x) => x.b.etapes);

let pos: Position = debut();
let zoom = false;
let noir = false;
let notes = false;
const debutSeance = Date.now();
let minuteur: { fin: number; pause: number | null } | null = null;
let presentateur: Window | null = null;

const scene = document.getElementById("scene")!;
const surcouche = document.getElementById("surcouche")!;

function depuisAncre(): void {
  const [id, e] = decodeURIComponent(location.hash.slice(1)).split(".");
  const i = plats.findIndex((x) => x.b.id === id);
  if (i >= 0) pos = { bloc: i, etape: Math.min(Number(e) || 0, etapes[i] ?? 0) };
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
}

function contexte(doc: Document, z: boolean): Contexte {
  return { doc, medias, zoom: z };
}

function rendre(): void {
  const x = plats[pos.bloc];
  if (!x) return;
  scene.replaceChildren(rendreDiapo(contexte(document, zoom), x.s, x.b, x.rang, pos.etape));
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
    c.append(rendreDiapo(contexte(d, false), s.s, s.b, s.rang, etape));
    c.style.transform = `scale(${v.clientWidth / 1920})`;
    v.replaceChildren(c);
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
    + `<div class="colonne-d"><div class="vignette petite" id="suivante"></div><div class="notes-p" id="notes"></div></div></body></html>`);
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
      pos = suivant(pos, etapes); break;
    case "ArrowLeft": case "ArrowUp": case "PageUp": case "Backspace":
      pos = precedent(pos, etapes); break;
    case "Home": pos = debut(); break;
    case "End": pos = fin(etapes); break;
    case "b": case "B": case ".": noir = !noir; break;
    case "z": case "Z": zoom = !zoom; break;
    case "n": case "N": notes = !notes; break;
    case "t": case "T": basculerMinuteur(); break;
    case "p": case "P": ouvrirPresentateur(); break;
    case "f": case "F": void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()); break;
    case "Escape": zoom = false; noir = false; notes = false; break;
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
