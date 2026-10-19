// Le script de la page de revue : une diapositive à la fois, rendue par pdf.js ; un geste confirme ou corrige sa figure et l'écrit.
import * as pdfjs from "/pdfjs/pdf.min.mjs";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

const $ = (id) => document.getElementById(id);
const etat = { donnees: null, deck: 0, i: 0, pdfs: new Map(), rendu: 0 };
const libelle = (id) => {
  const f = etat.donnees.figures.find((x) => x.id === id);
  return f ? f.libelle : id;
};
const deck = () => etat.donnees.decks[etat.deck];
const ligne = () => deck().lignes[etat.i];
const vues = (d) => d.lignes.filter((l) => l.vue === "1").length;
const sansAccents = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

function memoriser() {
  try { localStorage.setItem("revue-figures", JSON.stringify({ deck: deck().id, i: etat.i })); } catch { /* sans mémoire */ }
}

/** La page du PDF d'une diapositive : PowerPoint peut omettre les masquées ; sinon pas de correspondance sûre. */
function pageDe(d, n, pages) {
  const total = d.lignes.length;
  if (pages === total) return n;
  if (pages === total - d.masquees.length && !d.masquees.includes(n)) return n - d.masquees.filter((m) => m < n).length;
  return null;
}

function pdfDe(d) {
  if (d.rendu !== "pret") return null;
  if (!etat.pdfs.has(d.id)) etat.pdfs.set(d.id, pdfjs.getDocument({ url: `/rendu/${d.id}`, isEvalSupported: false }).promise);
  return etat.pdfs.get(d.id);
}

async function dessiner() {
  const d = deck();
  const l = ligne();
  const cadre = $("cadre");
  const jeton = ++etat.rendu;
  const vide = (texte) => { cadre.classList.remove("charge"); cadre.innerHTML = ""; const v = document.createElement("div"); v.className = "vide"; v.textContent = texte; cadre.append(v); };
  const doc = pdfDe(d);
  if (!doc) return vide(d.rendu === "en-cours" ? "PowerPoint rend ce deck en PDF… la diapositive s'affichera d'elle-même." : "Pas de rendu de ce deck : ouvrir la diapositive dans PowerPoint.");
  const pdf = await doc;
  const p = pageDe(d, Number(l.diapo), pdf.numPages);
  if (p === null) return vide("Cette diapositive n'est pas dans le rendu PDF (masquée ?).");
  // Une page lourde met un instant à se rendre : la précédente s'estompe en attendant.
  cadre.classList.add("charge");
  const page = await pdf.getPage(p);
  if (jeton !== etat.rendu) return;
  const base = page.getViewport({ scale: 1 });
  const echelle = Math.min(cadre.clientWidth / base.width, cadre.clientHeight / base.height) * (window.devicePixelRatio || 1);
  const vue = page.getViewport({ scale: echelle });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(vue.width);
  canvas.height = Math.floor(vue.height);
  canvas.style.width = `${Math.floor(vue.width / (window.devicePixelRatio || 1))}px`;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport: vue }).promise;
  if (jeton !== etat.rendu) return;
  cadre.classList.remove("charge");
  cadre.innerHTML = "";
  cadre.append(canvas);
}

function afficherDecks() {
  const total = etat.donnees.decks.reduce((s, d) => s + d.lignes.length, 0);
  const vu = etat.donnees.decks.reduce((s, d) => s + vues(d), 0);
  $("progres").textContent = `${vu} diapositives vues sur ${total} · ${etat.donnees.decks.filter((d) => d.revue).length} deck(s) revu(s) sur ${etat.donnees.decks.length}`;
  $("decks").replaceChildren(...etat.donnees.decks.map((d, k) => {
    const b = document.createElement("button");
    b.className = "deck" + (k === etat.deck ? " actif" : "");
    const nom = document.createElement("span");
    nom.className = "nom";
    nom.textContent = d.nom.replace(/\.pptx$/i, "");
    const info = document.createElement("span");
    info.className = "info";
    info.textContent = `${vues(d)}/${d.lignes.length} vues${d.revue ? " · revu ✓" : ""}${d.rendu === "en-cours" ? " · rendu en cours" : ""}`;
    const barre = document.createElement("div");
    barre.className = "barre";
    const i = document.createElement("i");
    i.style.width = `${(100 * vues(d)) / d.lignes.length}%`;
    barre.append(i);
    b.append(nom, info, barre);
    b.onclick = () => ouvrirDeck(k);
    return b;
  }));
}

function afficherChoix() {
  const l = ligne();
  $("numero").textContent = `${l.diapo} / ${deck().lignes.length}`;
  $("titre-diapo").textContent = l.titre || "(sans titre)";
  $("proposee").textContent = libelle(l.regles);
  $("signal").textContent = l.signal;
  $("note").value = l.note;
  const filtre = sansAccents($("filtre").value.trim());
  for (const b of document.querySelectorAll(".figure")) {
    b.classList.toggle("proposee", b.dataset.id === l.regles);
    b.classList.toggle("choisie", b.dataset.id === l.verite);
    b.classList.toggle("cachee", Boolean(filtre) && !sansAccents(b.textContent).includes(filtre) && !b.dataset.id.includes(filtre));
  }
  $("autre").value = l.verite.startsWith("autre : ") ? l.verite.slice(8) : "";
  const d = deck();
  $("revu").disabled = !d.revue && vues(d) < d.lignes.length;
  $("revu").textContent = d.revue ? "Rouvrir ce deck" : `Marquer ce deck revu${vues(d) < d.lignes.length ? ` (${d.lignes.length - vues(d)} à voir)` : ""}`;
  $("revu").className = d.revue ? "action secondaire" : "action";
}

function afficherBande() {
  $("bande").replaceChildren(...deck().lignes.map((l, k) => {
    const c = document.createElement("span");
    c.className = "case" + (l.vue === "1" ? (l.verite === l.regles ? " vue" : " corrigee") : "") + (k === etat.i ? " courante" : "");
    c.title = `${l.diapo} · ${libelle(l.verite)}${l.titre ? ` — ${l.titre}` : ""}`;
    c.onclick = () => aller(k);
    return c;
  }));
  $("bande").children[etat.i]?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

/** Les noms « autre » déjà saisis dans tout le corpus : proposés à la saisie, pour qu'une figure garde une seule graphie. */
function afficherAutres() {
  const noms = [...new Set(etat.donnees.decks.flatMap((d) => d.lignes.map((l) => l.verite)).filter((v) => v.startsWith("autre : ")).map((v) => v.slice(8)))].sort();
  $("autres").replaceChildren(...noms.map((n) => { const o = document.createElement("option"); o.value = n; return o; }));
}

function afficher() {
  afficherAutres();
  afficherDecks();
  afficherChoix();
  afficherBande();
  memoriser();
  void dessiner();
}

function aller(k) {
  etat.i = Math.max(0, Math.min(deck().lignes.length - 1, k));
  $("erreur").textContent = "";
  afficher();
}

function ouvrirDeck(k) {
  etat.deck = k;
  const d = deck();
  const premiere = d.lignes.findIndex((l) => l.vue !== "1");
  etat.i = premiere < 0 ? 0 : premiere;
  afficher();
}

async function choisir(verite) {
  const d = deck();
  const l = ligne();
  const r = await fetch(`/verite/${d.id}`, { method: "POST", body: JSON.stringify({ diapo: Number(l.diapo), verite, note: $("note").value }) });
  const x = await r.json();
  if (!r.ok) { $("erreur").textContent = x.erreur; return; }
  d.lignes[etat.i] = x;
  $("filtre").value = "";
  if (etat.i < d.lignes.length - 1) aller(etat.i + 1);
  else afficher();
}

async function marquerRevu() {
  const d = deck();
  const r = await fetch(`/revue/${d.id}`, { method: "POST", body: JSON.stringify({ revue: !d.revue }) });
  const x = await r.json();
  if (!r.ok) { $("erreur").textContent = x.erreur; return; }
  d.revue = x.revue;
  afficher();
}

function boutons(groupe, cible) {
  $(cible).replaceChildren(...etat.donnees.figures.filter((f) => f.groupe === groupe).map((f) => {
    const b = document.createElement("button");
    b.className = "figure";
    b.dataset.id = f.id;
    b.textContent = f.libelle;
    b.onclick = () => choisir(f.id);
    return b;
  }));
}

document.addEventListener("keydown", (e) => {
  if (!etat.donnees || e.metaKey || e.ctrlKey || e.altKey) return;
  const cible = e.target;
  if (cible === $("autre")) {
    if (e.key === "Enter" && cible.value.trim()) { e.preventDefault(); void choisir(`autre : ${cible.value.trim()}`); }
    return;
  }
  if (cible === $("note")) {
    if (e.key === "Enter") { e.preventDefault(); void choisir(ligne().verite); }
    return;
  }
  const filtre = $("filtre");
  if (e.key === "Escape") { filtre.value = ""; filtre.blur(); afficherChoix(); return; }
  if (e.key === "Enter") {
    e.preventDefault();
    const premiere = filtre.value.trim() && [...document.querySelectorAll(".figure:not(.cachee)")][0];
    void choisir(premiere ? premiere.dataset.id : ligne().verite);
    return;
  }
  if (cible === filtre) return;
  if (e.key === "ArrowRight") { e.preventDefault(); void choisir(ligne().verite); return; }
  if (e.key === "ArrowLeft") { e.preventDefault(); aller(etat.i - 1); return; }
  if (e.key === "N" || (e.key === "n" && !filtre.value)) {
    const lignes = deck().lignes;
    const k = lignes.findIndex((l, j) => j > etat.i && l.vue !== "1");
    if (k >= 0) { e.preventDefault(); aller(k); return; }
  }
  if (e.key.length === 1 && /\S/.test(e.key)) { filtre.focus(); }
});

$("filtre").addEventListener("input", afficherChoix);
$("revu").onclick = marquerRevu;
window.addEventListener("resize", () => void dessiner());

async function demarrer() {
  etat.donnees = await (await fetch("/donnees")).json();
  $("titre").textContent = `Revue des figures — corpus « ${etat.donnees.corpus} »`;
  boutons("figure", "figures");
  boutons("candidate", "candidates");
  let memoire = null;
  try { memoire = JSON.parse(localStorage.getItem("revue-figures") ?? "null"); } catch { /* sans mémoire */ }
  const k = memoire ? etat.donnees.decks.findIndex((d) => d.id === memoire.deck) : -1;
  if (k >= 0) { etat.deck = k; etat.i = Math.min(memoire.i, deck().lignes.length - 1); afficher(); }
  else ouvrirDeck(Math.max(0, etat.donnees.decks.findIndex((d) => !d.revue)));
  // Tant que PowerPoint rend des decks, la page suit leur état.
  const suivre = setInterval(async () => {
    const x = await (await fetch("/donnees")).json();
    let change = false;
    x.decks.forEach((d, j) => { if (etat.donnees.decks[j].rendu !== d.rendu) { etat.donnees.decks[j].rendu = d.rendu; change = true; } });
    if (change) afficher();
    if (!x.decks.some((d) => d.rendu === "en-cours")) clearInterval(suivre);
  }, 4000);
}

void demarrer();
