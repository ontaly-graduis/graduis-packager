// Le diff de deux livraisons (P3 : une modification se lit en diff) : le PPT d'auteur, le pivot bloc par bloc et champ par
// champ, chaque sortie. Une image changée (une capture remplacée) se montre avant et après.
import { esc, STYLE_DOCUMENT } from "../diagnostic/rapport-html";
import type { Bloc, SeanceSpec } from "../pivot/seance-spec";
import type { Theme } from "../theme/theme";
import type { Manifeste } from "./livrer";

export interface Changement {
  readonly chemin: string;
  readonly avant: unknown;
  readonly apres: unknown;
}

export interface BlocChange {
  readonly id: string;
  readonly diapo: number;
  readonly titre: string | null;
  readonly etat: "ajoute" | "retire" | "modifie";
  readonly changements: readonly Changement[];
}

export interface SortieComparee {
  readonly fichier: string;
  readonly etat: "identique" | "modifiee" | "ajoutee" | "retiree";
  readonly note?: string;
}

export interface Diff {
  readonly ppt: { readonly avant: string; readonly apres: string };
  readonly pivot: { readonly avant: string; readonly apres: string };
  readonly sorties: readonly SortieComparee[];
  readonly blocs: readonly BlocChange[];
}

/** Un dessin se compare élément par élément : au-delà, le détail n'aide pas la relecture. */
const REPLIES = /^(dessin\.elements\[\d+\]|composition\.(cas|etapes|lignes|colonnes|legende)\[\d+\]|structure\.rangees\[\d+\])/;

function comparer(a: unknown, b: unknown, chemin: string, out: Changement[]): void {
  const replie = chemin.match(REPLIES)?.[0];
  if (replie && replie !== chemin) {
    if (JSON.stringify(a) !== JSON.stringify(b) && !out.some((c) => c.chemin === replie)) out.push({ chemin: replie, avant: "…", apres: "…" });
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) comparer(a[i], b[i], `${chemin}[${i}]`, out);
    return;
  }
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const cles = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of cles) comparer((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], chemin ? `${chemin}.${k}` : k, out);
    return;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ chemin, avant: a, apres: b });
}

export function differ(avant: { manifeste: Manifeste; spec: SeanceSpec }, apres: { manifeste: Manifeste; spec: SeanceSpec }): Diff {
  const blocsDe = (s: SeanceSpec) => new Map(s.sequences.flatMap((q) => q.blocs).map((b) => [b.id, b]));
  const [a, b] = [blocsDe(avant.spec), blocsDe(apres.spec)];
  const blocs: BlocChange[] = [];
  const decrit = (x: Bloc) => ({ id: x.id, diapo: x.source.diapo, titre: x.titre });
  for (const [id, x] of a) {
    const y = b.get(id);
    if (!y) { blocs.push({ ...decrit(x), etat: "retire", changements: [] }); continue; }
    const changements: Changement[] = [];
    comparer(x, y, "", changements);
    if (changements.length) blocs.push({ ...decrit(y), etat: "modifie", changements });
  }
  for (const [id, y] of b) if (!a.has(id)) blocs.push({ ...decrit(y), etat: "ajoute", changements: [] });
  const fichiers = [...new Set([...Object.keys(avant.manifeste.sorties), ...Object.keys(apres.manifeste.sorties)])].sort();
  const sorties = fichiers.map((fichier): SortieComparee => {
    const [x, y] = [avant.manifeste.sorties[fichier], apres.manifeste.sorties[fichier]];
    if (!x) return { fichier, etat: "ajoutee" };
    if (!y) return { fichier, etat: "retiree" };
    // Un PDF est daté par Chromium : il se compare par sa couche texte.
    if (x.texte && y.texte) return x.texte === y.texte
      ? { fichier, etat: x.empreinte === y.empreinte ? "identique" : "modifiee", note: "même couche texte" }
      : { fichier, etat: "modifiee", note: "couche texte changée" };
    return { fichier, etat: x.empreinte === y.empreinte ? "identique" : "modifiee" };
  });
  return {
    ppt: { avant: avant.manifeste.ppt.empreinte, apres: apres.manifeste.ppt.empreinte },
    pivot: { avant: avant.manifeste.pivot, apres: apres.manifeste.pivot },
    sorties, blocs,
  };
}

const court = (h: string) => h.slice(7, 19);
const valeur = (v: unknown) => (v === undefined ? "—" : typeof v === "string" ? (v.startsWith("sha256:") ? court(v) : v) : JSON.stringify(v));
const LIBELLE_ETAT: Readonly<Record<string, string>> = { identique: "identique", modifiee: "à jour", ajoutee: "ajoutée", retiree: "retirée", ajoute: "ajouté", retire: "retiré", modifie: "modifié" };

/** La page du diff, au thème ; `images` : les médias des deux livraisons (hash → data-URI) pour montrer une image changée. */
export function diffHtml(d: Diff, theme: Theme, images: { readonly avant: Readonly<Record<string, string>>; readonly apres: Readonly<Record<string, string>> }): string {
  const sorties = d.sorties.map((s) => `<tr><td>${esc(s.fichier)}</td><td><span class="niveau ${s.etat === "identique" ? "info" : "a-valider"}">${LIBELLE_ETAT[s.etat]}</span></td><td>${esc(s.note ?? "")}</td></tr>`).join("");
  const blocs = d.blocs.map((b) => {
    const lignes = b.changements.map((c) => `<li><span class="ou">${esc(c.chemin)}</span><span>${esc(valeur(c.avant))} → ${esc(valeur(c.apres))}</span></li>`).join("");
    const medias = b.changements.filter((c) => typeof c.avant === "string" && typeof c.apres === "string" && /^visuels\[\d+\]\.media$/.test(c.chemin));
    const vues = medias.map((c) => {
      const [x, y] = [images.avant[c.avant as string], images.apres[c.apres as string]];
      return x && y ? `<div class="avant-apres"><figure><img src="${x}" alt=""><figcaption>avant</figcaption></figure><figure><img src="${y}" alt=""><figcaption>après</figcaption></figure></div>` : "";
    }).join("");
    return `<section class="regle"><h3><span>${esc(b.id)} · diapositive d'origine ${b.diapo} · ${esc(b.titre ?? "")}</span><small>${LIBELLE_ETAT[b.etat]}</small></h3><ul class="changements">${lignes}</ul>${vues}</section>`;
  }).join("");
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diff de livraison</title>
<style id="theme">${theme.jetons}\n${theme.polices}</style>
<style>${STYLE_DOCUMENT}
.changements li{grid-template-columns:minmax(160px,30%) 1fr}
.avant-apres{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);padding:0 var(--space-5) var(--space-4)}
.avant-apres figure{margin:0}.avant-apres img{width:100%;border:var(--border-hairline)}
.avant-apres figcaption{font-size:var(--fs-meta);color:var(--text-secondary);text-align:center}</style></head>
<body><div class="page">
<header><img src="${theme.logo}" alt="Onet"><div><h1>Ce qui a changé</h1>
<p>PPT d'auteur ${esc(court(d.ppt.avant))} → ${esc(court(d.ppt.apres))} · pivot ${esc(court(d.pivot.avant))} → ${esc(court(d.pivot.apres))}</p></div></header>
<h2>Sorties</h2>
<table><thead><tr><th>Fichier</th><th>État</th><th></th></tr></thead><tbody>${sorties}</tbody></table>
<h2>Pivot : ${d.blocs.length} bloc${d.blocs.length > 1 ? "s" : ""} changé${d.blocs.length > 1 ? "s" : ""}</h2>
${blocs || "<p>Aucun bloc ne change.</p>"}
<footer>Graduis Packager · Ontaly — diff dérivé des manifestes et des pivots de deux livraisons.</footer>
</div></body></html>
`;
}
