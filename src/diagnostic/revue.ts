// La fiche de revue (PKG-E) : ce qu'il reste à trancher dans le PPT de validation pour les séquences livrées — chaque
// constat du rapport, où il se trouve, le geste attendu dans PowerPoint — et un chronomètre par point. Le temps mesuré,
// rapporté aux constats de toute la journée, donne le temps humain résiduel d'un deck (le chiffrage). Page locale : elle
// porte le contenu du client et ne se publie pas (I-PKG-9).
import { stringify2 } from "../lib/json";
import { verifierSequences, type SeanceSpec } from "../pivot/seance-spec";
import type { Theme } from "../theme/theme";
import { esc, STYLE_DOCUMENT } from "./rapport-html";
import { REGLES, type Rapport } from "./regles";

/** Le geste attendu dans le PPT de validation, par règle. */
const GESTES_DE_PAS: readonly (readonly [RegExp, string])[] = [
  [/^Zone proposée/, "Zone proposée ✦ (tirets ambre) : si elle est juste, la renommer « G·zone » dans le volet Sélection ; sinon la poser sur l'élément désigné, puis la renommer."],
  [/^Sans zone/, "Dupliquer une zone, la poser sur l'élément désigné, coller son coin à la pastille du pas."],
  [/^Sans consigne/, "Écrire la consigne au rang du pas, dans la liste Consignes."],
];
const GESTES: Readonly<Record<string, string>> = {
  H2: "Écran dense : garder, alléger (le surplus descend aux notes ou au papier), ou découper la diapositive.",
  H3: "Trop de pastilles sur une capture : découper la diapositive, ou garder.",
  H5: "Capture faible ou muette : la remplacer (Changer l'image), la légender, ou garder.",
  H6: "Énoncé repris d'un autre cas : écrire le bon énoncé.",
  H8: "Marqueur d'inachèvement : compléter le texte ou le retirer (bloquant).",
  H9: "Séquence hors norme : la découper, ou garder.",
  H1: "Un temps manque : ajouter la diapositive qui le porte, ou garder.",
  DESSIN: "Schéma : vérifier les couleurs fondues et le dévoilement (le pas dans le nom des formes) ; corriger dans les formes.",
  VIDE: "Diapositive vide : la supprimer ou la compléter.",
};

interface Point {
  readonly id: string;
  readonly regle: string;
  readonly niveau: string;
  readonly ou: string;
  readonly message: string;
  readonly geste: string;
}

export function revueHtml(rapport: Rapport, spec: SeanceSpec, positions: ReadonlyMap<string, number>, sequences: readonly string[], theme: Theme): string {
  verifierSequences(spec, sequences);
  const blocs = spec.sequences.flatMap((q) => q.blocs);
  const positionDe = (source: number) => { const b = blocs.find((x) => x.source.diapo === source); return (b ? positions.get(b.id) : undefined) ?? 10000 + source; };
  const diapoDuBloc = (source: number | null) => {
    if (source === null) return "séquence";
    const n = positionDe(source);
    return n < 10000 ? `diapo ${n}` : `source ${source}`;
  };
  const retenus = rapport.constats.filter((k) => k.niveau !== "info" && k.sequence !== null && sequences.includes(k.sequence));
  const points: Point[] = [
    ...sequences.map((s) => {
      const n = spec.sequences.find((q) => q.id === s)?.blocs.length ?? 0;
      return { id: `relire-${s}`, regle: "RELIRE", niveau: "a-valider", ou: s, message: `Relire la séquence diapositive par diapositive (${n} diapositives).`, geste: "Parcourir le PPT de validation : titres, textes, captures, zones, consignes ; corriger sur place." };
    }),
    // Dans l'ordre du PPT : ce qui vaut pour la séquence d'abord, puis diapositive par diapositive.
    ...retenus.map((k, i) => ({ k, i, n: k.diapo === null ? -1 : positionDe(k.diapo) })).sort((a, b) => a.n - b.n || a.i - b.i).map(({ k, i }) => ({
      id: `${k.regle}-${i}`, regle: k.regle, niveau: k.niveau, ou: diapoDuBloc(k.diapo), message: k.message,
      geste: (k.regle === "PAS" ? GESTES_DE_PAS.find(([m]) => m.test(k.message))?.[1] : undefined) ?? GESTES[k.regle] ?? REGLES[k.regle]?.action ?? "",
    })),
  ];
  // Les comptes de toute la journée, pour l'extrapolation : constats par règle, diapositives à relire.
  const parRegle: Record<string, number> = {};
  for (const k of rapport.constats) if (k.niveau !== "info") parRegle[k.regle] = (parRegle[k.regle] ?? 0) + 1;
  const diapositivesRelues = sequences.reduce((n, s) => n + (spec.sequences.find((q) => q.id === s)?.blocs.length ?? 0), 0);
  const donnees = { pivot: rapport.pivot, sequences, points: points.map((p) => ({ id: p.id, regle: p.regle })), journee: { parRegle, diapositives: blocs.length, diapositivesRelues } };
  const lignes = points.map((p) => `<li data-id="${esc(p.id)}" data-regle="${esc(p.regle)}"><span class="niveau ${p.niveau}">${esc(p.regle)}</span><span class="ou">${esc(p.ou)}</span>`
    + `<span><b>${esc(p.message)}</b><br><small>${esc(p.geste)}</small></span><span class="chrono"><button type="button">Commencer</button><output>0:00</output></span></li>`).join("");
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revue — ${esc(sequences.join(", "))}</title>
<style id="theme">${theme.jetons}\n${theme.polices}</style>
<style>${STYLE_DOCUMENT}
.points{list-style:none;margin:0;padding:0}
.points li{display:grid;grid-template-columns:88px 92px 1fr 150px;gap:var(--space-3);align-items:start;background:var(--color-background);box-shadow:var(--shadow-card);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-2)}
.points li.fait{opacity:.6}
.points small{color:var(--text-secondary)}
.chrono{display:flex;gap:var(--space-2);align-items:center;justify-content:flex-end}
.chrono button,.actions button{font:var(--fw-semibold) 13px var(--font-base);padding:6px 12px;border:1px solid var(--color-primary);background:var(--color-background);color:var(--color-primary);border-radius:var(--radius-interactive);cursor:pointer}
.chrono button.en-cours{background:var(--color-primary);color:var(--text-on-primary)}
.chrono output{font-variant-numeric:tabular-nums;min-width:44px;text-align:right}
.actions{display:flex;gap:var(--space-3);align-items:center;margin:var(--space-4) 0}
.actions label{font-size:var(--fs-meta);color:var(--text-secondary)}
.actions input{width:64px;font:inherit}</style></head>
<body><div class="page">
<header><img src="${theme.logo}" alt="Onet"><div><h1>Fiche de revue chronométrée</h1>
<p>${esc(rapport.source.nom)} · séquences ${esc(sequences.join(", "))} · ${points.length} points · pivot ${esc(rapport.pivot.slice(7, 19))}</p></div></header>
<div class="tuiles"><div class="tuile"><b id="mesure">0 min</b><span>mesurées sur les séquences</span></div>
<div class="tuile"><b id="faits">0 / ${points.length}</b><span>points tranchés</span></div>
<div class="tuile a-valider"><b id="deck">—</b><span>extrapolé au deck (cible : 1 jour)</span></div></div>
<div class="actions"><label>Relecture d'ensemble et livraison (min, une fois par deck) <input id="fixe" type="number" min="0" value="30"></label><button type="button" id="exporter">Exporter la mesure</button></div>
<h2>Points à trancher dans le PPT de validation</h2>
<ol class="points">${lignes}</ol>
<footer>Graduis Packager · Ontaly — un chronomètre par point : « Commencer », puis « Fait ». La mesure reste dans ce navigateur ; « Exporter » l'enregistre.</footer>
</div>
<script type="application/json" id="revue">${stringify2(donnees).replace(/</g, "\\u003c")}</script>
<script>
(() => {
  const d = JSON.parse(document.getElementById("revue").textContent);
  const cle = "revue:" + d.pivot + ":" + d.sequences.join(",");
  let etat = {};
  try { etat = JSON.parse(localStorage.getItem(cle) || "{}"); } catch (e) { etat = {}; }
  const garder = () => { try { localStorage.setItem(cle, JSON.stringify(etat)); } catch (e) {} };
  const secondes = (id) => { const x = etat[id] || {}; return (x.cumul || 0) + (x.depuis ? (Date.now() - x.depuis) / 1000 : 0); };
  const mmss = (s) => Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0");
  const lignes = [...document.querySelectorAll(".points li")];
  function calculer() {
    let total = 0, faits = 0;
    const parRegle = {};
    for (const p of d.points) {
      const s = secondes(p.id); total += s;
      if (etat[p.id] && etat[p.id].fait) { faits += 1; (parRegle[p.regle] = parRegle[p.regle] || []).push(s); }
    }
    const moyenne = (l) => l.reduce((a, b) => a + b, 0) / l.length;
    const constats = Object.entries(parRegle).filter(([r]) => r !== "RELIRE").flatMap(([, l]) => l);
    const repli = constats.length ? moyenne(constats) : 0;
    let deck = (parRegle.RELIRE ? moyenne(parRegle.RELIRE) / Math.max(1, d.journee.diapositivesRelues / d.sequences.length) * d.journee.diapositives : 0);
    for (const [r, n] of Object.entries(d.journee.parRegle)) deck += n * (parRegle[r] ? moyenne(parRegle[r]) : repli);
    deck += Number(document.getElementById("fixe").value || 0) * 60;
    document.getElementById("mesure").textContent = Math.round(total / 60) + " min";
    document.getElementById("faits").textContent = faits + " / " + d.points.length;
    document.getElementById("deck").textContent = faits ? (deck / 3600).toFixed(1).replace(".", ",") + " h" : "—";
    for (const li of lignes) {
      const x = etat[li.dataset.id] || {};
      li.querySelector("output").textContent = mmss(secondes(li.dataset.id));
      const b = li.querySelector("button");
      b.textContent = x.depuis ? "Fait" : x.fait ? "Reprendre" : "Commencer";
      b.classList.toggle("en-cours", !!x.depuis);
      li.classList.toggle("fait", !!x.fait && !x.depuis);
    }
    return { total, deck };
  }
  for (const li of lignes) li.querySelector("button").addEventListener("click", () => {
    const x = etat[li.dataset.id] = etat[li.dataset.id] || { cumul: 0 };
    if (x.depuis) { x.cumul += (Date.now() - x.depuis) / 1000; delete x.depuis; x.fait = true; }
    else {
      for (const [id, y] of Object.entries(etat)) if (y.depuis && id !== li.dataset.id) { y.cumul += (Date.now() - y.depuis) / 1000; delete y.depuis; }
      x.depuis = Date.now(); x.fait = false;
    }
    garder(); calculer();
  });
  document.getElementById("fixe").addEventListener("input", calculer);
  document.getElementById("exporter").addEventListener("click", () => {
    const { total, deck } = calculer();
    const mesure = { pivot: d.pivot, sequences: d.sequences, minutesMesurees: Math.round(total / 60), heuresExtrapoleesAuDeck: Math.round(deck / 360) / 10,
      relectureFixeMinutes: Number(document.getElementById("fixe").value || 0), points: d.points.map((p) => ({ ...p, secondes: Math.round(secondes(p.id)), fait: !!(etat[p.id] && etat[p.id].fait) })) };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(mesure, null, 2) + "\\n"], { type: "application/json" }));
    a.download = "mesure-revue-" + d.sequences.join("-") + ".json";
    a.click();
  });
  calculer();
  setInterval(calculer, 1000);
})();
</script>
</body></html>
`;
}
