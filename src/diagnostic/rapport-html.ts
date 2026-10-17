// Le rapport d'anomalies et d'équilibrage en page HTML autonome, au thème ONET (0 hex hors jetons).
import type { Theme } from "../theme/theme";
import { NIVEAUX, REGLES, type Constat, type Niveau, type Rapport } from "./regles";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const LIBELLE_NIVEAU: Readonly<Record<Niveau, string>> = {
  bloquant: "Bloquant", avis: "Avis", "a-valider": "À valider", info: "Info",
};

const LIBELLE_FIGURE: Readonly<Record<string, string>> = {
  couverture: "Couverture", "ecran-animation": "Écran d'animation", transition: "Transition", objectifs: "Objectifs",
  contenu: "Contenu", processus: "Processus", schema: "Schéma", demonstration: "Démonstration", "pas-a-pas": "Pas-à-pas",
  capture: "Capture", "mise-en-pratique": "Mise en pratique", "etapes-cles": "Étapes clés", synthese: "Synthèse",
  glossaire: "Glossaire", renvoi: "Renvoi",
};

const STYLE = `
*{box-sizing:border-box}
body{margin:0;background:var(--color-surface);color:var(--text-body);font-family:var(--font-base);font-size:15px;line-height:1.55}
.page{max-width:var(--canvas-max);margin:0 auto;padding:var(--space-6) var(--space-5) var(--space-7)}
header{display:flex;gap:var(--space-5);align-items:center;background:var(--color-background);border-top:var(--rule-top) solid var(--color-primary);box-shadow:var(--shadow-card);padding:var(--space-5) var(--space-6);margin-bottom:var(--space-6)}
header img{height:36px}
header h1{margin:0;font-size:var(--fs-h2);line-height:var(--lh-heading);color:var(--text-strong);font-weight:var(--fw-bold)}
header p{margin:var(--space-1) 0 0;color:var(--text-secondary);font-size:var(--fs-meta)}
h2{font-size:var(--fs-h3);color:var(--text-strong);margin:var(--space-7) 0 var(--space-4);font-weight:var(--fw-bold)}
.tuiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--space-4)}
.tuile{background:var(--color-background);box-shadow:var(--shadow-card);padding:var(--space-4) var(--space-5);border-left:var(--filet-width) solid var(--color-border)}
.tuile b{display:block;font-size:var(--fs-h1);line-height:1.1;color:var(--text-strong);font-variant-numeric:tabular-nums}
.tuile span{font-size:var(--fs-meta);color:var(--text-secondary)}
.tuile.bloquant{border-left-color:var(--color-error)}.tuile.avis{border-left-color:var(--color-warning)}.tuile.a-valider{border-left-color:var(--color-info)}
table{width:100%;border-collapse:collapse;background:var(--color-background);box-shadow:var(--shadow-card);font-size:14px}
th,td{padding:var(--space-2) var(--space-3);text-align:left;border-bottom:var(--border-hairline);vertical-align:top}
th{font-size:var(--fs-meta);color:var(--text-secondary);font-weight:var(--fw-semibold);text-transform:uppercase;letter-spacing:var(--ls-label)}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
td.t{text-align:center}
.oui{color:var(--color-success);font-weight:var(--fw-bold)}.non{color:var(--color-error);font-weight:var(--fw-bold)}
tr.op td:first-child{border-left:var(--filet-width) solid var(--color-primary)}
.regle{background:var(--color-background);box-shadow:var(--shadow-card);margin-bottom:var(--space-4)}
.regle h3{margin:0;padding:var(--space-3) var(--space-5);font-size:15px;color:var(--text-strong);border-bottom:var(--border-hairline);display:flex;justify-content:space-between;gap:var(--space-4)}
.regle h3 small{color:var(--text-secondary);font-weight:var(--fw-regular)}
.regle .action{margin:0;padding:var(--space-2) var(--space-5) 0;font-size:var(--fs-meta);color:var(--text-secondary)}
.regle ul{list-style:none;margin:0;padding:var(--space-2) var(--space-5) var(--space-3)}
.regle li{display:grid;grid-template-columns:96px 92px 1fr;gap:var(--space-3);padding:var(--space-1) 0;align-items:baseline}
.niveau{font-size:12px;font-weight:var(--fw-semibold);padding:2px var(--space-2);border-radius:var(--radius-interactive);text-align:center}
.niveau.bloquant{background:var(--color-error-bg);color:var(--color-error)}
.niveau.avis{background:var(--color-warning-bg);color:var(--color-warning)}
.niveau.a-valider{background:var(--color-info-bg);color:var(--color-info)}
.niveau.info{background:var(--color-surface);color:var(--text-secondary)}
.ou{font-size:var(--fs-meta);color:var(--text-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}
details{margin-top:var(--space-4)}
summary{cursor:pointer;color:var(--color-primary);font-weight:var(--fw-semibold)}
footer{margin-top:var(--space-7);font-size:var(--fs-meta);color:var(--text-secondary)}
`;

function tuile(valeur: number | string, libelle: string, classe = ""): string {
  return `<div class="tuile ${classe}"><b>${esc(String(valeur))}</b><span>${esc(libelle)}</span></div>`;
}

function constat(k: Constat, numeros: ReadonlyMap<string, number | null>): string {
  const num = k.sequence ? numeros.get(k.sequence) : null;
  const ou = k.diapo !== null ? `diapo ${k.diapo}` : num ? `séquence ${num}` : k.sequence ? "ouverture" : "";
  return `<li><span class="niveau ${k.niveau}">${LIBELLE_NIVEAU[k.niveau]}</span><span class="ou">${esc(ou)}</span><span>${esc(k.message)}</span></li>`;
}

export function rapportHtml(r: Rapport, theme: Theme): string {
  const s = r.synthese;
  const marque = (b: boolean) => (b ? `<span class="oui">✓</span>` : `<span class="non">—</span>`);
  const numeros = new Map(r.sequences.map((l) => [l.id, l.numero]));
  const sequences = r.sequences.map((l) => `<tr class="${l.operatoire ? "op" : ""}"><td class="n">${l.numero ?? ""}</td><td>${esc(l.titre)}</td><td class="n">${l.diapositives}</td>`
    + `<td class="t">${marque(l.temps.E)}</td><td class="t">${marque(l.temps.R)}</td><td class="t">${marque(l.temps["R*"])}</td>`
    + `<td class="n">${l.demonstrations}</td><td class="n">${l.pas}</td><td class="n">${l.mots}</td></tr>`).join("");
  const regles = Object.keys(REGLES).map((cle) => {
    const liste = r.constats.filter((k) => k.regle === cle).sort((a, b) => NIVEAUX.indexOf(a.niveau) - NIVEAUX.indexOf(b.niveau) || (a.diapo ?? 0) - (b.diapo ?? 0));
    if (!liste.length) return "";
    const regle = REGLES[cle]!;
    return `<section class="regle"><h3><span>${esc(cle)} · ${esc(regle.libelle)}</span><small>${liste.length} constat${liste.length > 1 ? "s" : ""}</small></h3>`
      + `<p class="action">${esc(regle.action)}</p><ul>${liste.map((k) => constat(k, numeros)).join("")}</ul></section>`;
  }).join("");
  const qualification = r.qualification.map((q) => `<tr><td class="n">${q.diapo}</td><td>${esc(LIBELLE_FIGURE[q.figure] ?? q.figure)}</td>`
    + `<td>${q.temps ?? "—"}</td><td>${esc(q.titre ?? "")}</td><td>${esc(q.signal)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rapport — ${esc(r.source.nom)}</title>
<style id="theme">${theme.jetons}\n${theme.polices}</style>
<style>${STYLE}</style></head>
<body><div class="page">
<header><img src="${theme.logo}" alt="Onet"><div><h1>Rapport d'anomalies et d'équilibrage</h1>
<p>${esc(r.source.nom)} · source ${esc(r.source.empreinte.slice(7, 19))} · pivot ${esc(r.pivot.slice(7, 19))}</p></div></header>
<div class="tuiles">
${tuile(s.diapositives, "diapositives")}
${tuile(s.figures["pas-a-pas"] ?? 0, "pas-à-pas")}
${tuile(s.pas.total, `pas relevés, ${s.pas.total - s.pas.sansZone} ancrés`)}
${tuile(s.constats.bloquant, "bloquants", "bloquant")}
${tuile(s.constats.avis, "avis", "avis")}
${tuile(s.constats["a-valider"], "à valider", "a-valider")}
</div>
<h2>Séquences</h2>
<table><thead><tr><th class="n">N°</th><th>Séquence</th><th class="n">Diapos</th><th>E</th><th>R</th><th>R*</th><th class="n">Démos</th><th class="n">Pas</th><th class="n">Mots</th></tr></thead><tbody>${sequences}</tbody></table>
<h2>Constats</h2>
${regles}
<details><summary>Qualification des ${r.qualification.length} diapositives</summary>
<table><thead><tr><th class="n">Diapo</th><th>Figure</th><th>Temps</th><th>Titre</th><th>Signal</th></tr></thead><tbody>${qualification}</tbody></table></details>
<footer>Graduis Packager · Ontaly — rapport dérivé du pivot, régénéré à chaque relevé.</footer>
</div></body></html>
`;
}
