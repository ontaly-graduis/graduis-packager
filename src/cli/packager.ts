// CLI du packager — relever, qualifier, émettre le PPT de validation, le lire, construire la salle, le papier ; préparer
// la revue chronométrée, livrer, comparer deux livraisons ; rejouer un procédé contre sa référence ; mesurer le corpus d'épreuve.
// Tout ce qui fait une production (profil, thème, charte, prise) vient du procédé (`--procede`) : le code ne nomme aucun client.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { sha256, stringify2 } from "../lib/json";
import { relever } from "../releve/releve";
import { medianeMots, medianeResolution, mesurer } from "../releve/mesures";
import { qualifierReleve } from "../qualification/qualifier";
import { SeanceSpec } from "../pivot/seance-spec";
import { diagnostiquer } from "../diagnostic/regles";
import { rapportHtml } from "../diagnostic/rapport-html";
import { construireSalle } from "../salle/construire";
import type { Devoilement } from "../salle/donnees";
import { emettre } from "../emission/emettre";
import { diapositivesDesBlocs, estUnPptDeValidation, lire } from "../lecture/lire";
import { revueHtml } from "../diagnostic/revue";
import { avecConversionsFigees, convertisseur, versionDeLibreOffice } from "../medias/convertir";
import { construirePapier, PPP_MIN, type SousResolue } from "../papier/construire";
import { textesAttendus, type DonneesDePapier } from "../papier/donnees";
import { chromiumDisponible, imprimer, versionDuNavigateur } from "../papier/imprimer";
import { recetter } from "../papier/recette";
import { livrer, type Manifeste } from "../livraison/livrer";
import { differ, diffHtml } from "../livraison/diff";
import { planche } from "../livraison/planche";
import type { Releve } from "../releve/releve";
import { chargerProcede, type ProcedeCharge } from "../procede/procede";
import { rejouer } from "../procede/rejouer";
import { chargerCorpus } from "../corpus/corpus";
import { mesurerCorpus, veritesAPreparer } from "../corpus/mesure";
import { tableauEnMarkdown } from "../corpus/tableau";

/** Relève un deck et écrit `releve.json` et les médias hashés dans le dossier de sortie. */
function ecrireReleve(deck: string, sortie: string | undefined) {
  const nom = basename(deck);
  const { releve, medias } = relever(new Uint8Array(readFileSync(deck)), nom);
  const dossier = sortie ?? join("out", basename(nom, extname(nom)));
  mkdirSync(join(dossier, "medias"), { recursive: true });
  const texte = stringify2(releve);
  writeFileSync(join(dossier, "releve.json"), texte);
  for (const [h, { ext, octets }] of medias) writeFileSync(join(dossier, "medias", `${h.slice(7)}.${ext}`), octets);
  return { nom, releve, medias, dossier, texte };
}

/**
 * Le pivot d'où dérivent les sorties : lu dans le PPT de validation (la lecture grammaticale, seule livrable, I-PKG-4), ou
 * qualifié d'un deck hérité (la lecture heuristique : un aperçu, à valider).
 */
function pivotDe(fichier: string, sortie: string | undefined, p: ProcedeCharge) {
  const octets = new Uint8Array(readFileSync(fichier));
  if (estUnPptDeValidation(octets)) {
    const { spec, ecarts } = lire(octets, p.profil);
    const { releve, medias } = relever(octets, basename(fichier));
    const dossier = sortie ?? join("out", basename(fichier, extname(fichier)));
    mkdirSync(dossier, { recursive: true });
    return { spec, releve, medias, dossier, grammaticale: true, ecarts };
  }
  const { releve, medias, dossier } = ecrireReleve(fichier, sortie);
  const { spec } = qualifierReleve(releve, p.profil);
  return { spec: SeanceSpec.parse(spec), releve, medias, dossier, grammaticale: false, ecarts: [] };
}

function emettreCommande(deck: string, sortie: string | undefined, p: ProcedeCharge): void {
  const { spec, releve, medias, dossier } = pivotDe(deck, sortie, p);
  const octets = emettre(spec, {
    theme: p.theme,
    media: (h) => { const m = medias.get(h); return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined; },
  });
  writeFileSync(join(dossier, "validation.pptx"), octets);
  const blocs = spec.sequences.flatMap((s) => s.blocs);
  console.log([
    `# PPT de validation — ${spec.source.nom}`,
    `${dossier}/validation.pptx · ${(octets.length / 1e6).toFixed(1)} Mo · empreinte ${sha256(octets)}`,
    `${blocs.length} blocs · ${spec.sequences.length} séquences · ${blocs.reduce((n, b) => n + b.pas.length, 0)} pas`
      + ` · ${blocs.filter((b) => b.figure === "schema" && (b.dessin || b.composition)).length} schémas en formes natives`
      + ` (${blocs.filter((b) => b.figure === "schema" && b.composition && b.dessin).length} recomposés, leur dessin d'origine en annexe masquée)`,
    "à relire et corriger dans PowerPoint, puis : packager lire validation.pptx",
  ].join("\n"));
}

function lireCommande(fichier: string, sortie: string | undefined, p: ProcedeCharge): void {
  const octets = new Uint8Array(readFileSync(fichier));
  if (!estUnPptDeValidation(octets)) {
    console.error(`${fichier} n'est pas un PPT de validation (il ne dit pas de quel deck il procède).`);
    process.exit(2);
  }
  const { spec, ecarts } = lire(octets, p.profil);
  const dossier = sortie ?? join("out", basename(fichier, extname(fichier)));
  mkdirSync(dossier, { recursive: true });
  const texte = stringify2(spec);
  writeFileSync(join(dossier, "seance-spec.json"), texte);
  console.log([
    `# Lecture — ${fichier}`,
    `pivot ${sha256(texte)} → ${dossier}/seance-spec.json`,
    ecarts.length ? `écarts à la grammaire (${ecarts.length}) :` : "aucun écart à la grammaire",
    ...ecarts.map((e) => `  diapositive ${e.diapo} : ${e.message}`),
  ].join("\n"));
}

async function salleCommande(deck: string, sortie: string | undefined, p: ProcedeCharge, sequences: string[] | undefined, devoilement: Devoilement): Promise<void> {
  const { spec, releve, medias, dossier, grammaticale } = pivotDe(deck, sortie, p);
  const { html, nonAffichables } = await construireSalle(spec, {
    prise: { devoilement },
    theme: p.theme,
    ...(p.profil.pratique ? { pratique: p.profil.pratique } : {}),
    media: (h) => {
      const m = medias.get(h);
      return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined;
    },
    ...(sequences ? { sequences } : {}),
    convertir: avecConversionsFigees(p.conversions, convertisseur(join(dossier, "medias-converties"))),
  });
  const nom = sequences ? `salle-${sequences.join("-")}.html` : "salle.html";
  writeFileSync(join(dossier, nom), html);
  console.log([
    `# Salle — ${spec.source.nom}${grammaticale ? " (lue dans le PPT de validation)" : " (lecture heuristique : un aperçu, à valider)"}`,
    `${dossier}/${nom} · ${(Buffer.byteLength(html) / 1e6).toFixed(1)} Mo · empreinte ${sha256(html)}`,
    `dévoilement ${devoilement}${sequences ? ` · séquences ${sequences.join(", ")}` : " · toutes les séquences"}`,
    nonAffichables.length ? `médias non affichables (à convertir) : ${nonAffichables.length}` : "tous les médias sont affichables",
  ].join("\n"));
}

/** Imprime une page de papier et recette sa couche texte ; écrit le PDF à côté. */
async function imprimerEtRecetter(html: string, attendus: readonly string[], pdf: string): Promise<string[]> {
  const i = await imprimer(html);
  writeFileSync(pdf, i.pdf);
  const r = recetter(attendus, i.lu.pages);
  return [
    `${pdf} · ${i.lu.pages.length} pages · ${(i.pdf.length / 1e6).toFixed(1)} Mo · pagination stable en ${i.passes} passes`,
    `recette de la couche texte : ${r.trouves}/${r.cherches} lignes retrouvées${r.manquants.length ? ` — manquantes : ${r.manquants.slice(0, 8).map((m) => `« ${m.slice(0, 60)} »`).join(", ")}` : ""}`,
  ];
}

const sousResoluesEnTexte = (s: readonly SousResolue[]) =>
  s.length ? `captures sous ${PPP_MIN} ppp à l'impression (signalées, imprimées) : ${s.map((x) => `${x.bloc} ${x.ppp} ppp`).join(", ")}` : `toutes les captures à ${PPP_MIN} ppp ou plus`;

async function papierCommande(deck: string, sortie: string | undefined, procede: ProcedeCharge, sequences: string[] | undefined): Promise<void> {
  const { spec, releve, medias, dossier, grammaticale } = pivotDe(deck, sortie, procede);
  const p = await construirePapier(spec, {
    theme: procede.theme,
    ...(procede.profil.pratique ? { pratique: procede.profil.pratique } : {}),
    media: (h) => { const m = medias.get(h); return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined; },
    ...(sequences ? { sequences } : {}),
    convertir: avecConversionsFigees(procede.conversions, convertisseur(join(dossier, "medias-converties"))),
  });
  const suffixe = sequences ? `-${sequences.join("-")}` : "";
  const html = join(dossier, `papier${suffixe}.html`);
  writeFileSync(html, p.html);
  const lignes = [
    `# Papier — ${spec.source.nom}${grammaticale ? " (lu dans le PPT de validation)" : " (lecture heuristique : un aperçu, à valider)"}`,
    `${html} · ${(Buffer.byteLength(p.html) / 1e6).toFixed(1)} Mo · empreinte ${sha256(p.html)}`,
    `séquences ${p.donnees.sequences.length} · blocs ${p.donnees.sequences.reduce((n, s) => n + s.blocs.length, 0)} · annexes ${p.donnees.annexes.length} · lignes à recetter ${p.attendus.length}`,
    sousResoluesEnTexte(p.sousResolues),
    p.nonAffichables.length ? `médias non affichables (à convertir) : ${p.nonAffichables.length}` : "tous les médias sont affichables",
  ];
  if (await chromiumDisponible()) lignes.push(...await imprimerEtRecetter(p.html, p.attendus, join(dossier, `participant${suffixe}.pdf`)));
  else lignes.push(`aucun Chromium ici : la page est prête — packager imprimer ${html}, là où Chrome est installé`);
  console.log(lignes.join("\n"));
}

/** Imprime une page de papier déjà construite (là où un Chromium existe) ; l'oracle se relit dans ses données. */
async function imprimerCommande(fichier: string, sortie: string | undefined): Promise<void> {
  const html = readFileSync(fichier, "utf8");
  const json = html.match(/<script type="application\/json" id="donnees">([\s\S]*?)<\/script>/)?.[1];
  if (!json) throw new Error(`${fichier} n'est pas une page de papier`);
  const donnees = JSON.parse(json) as DonneesDePapier;
  const dossier = sortie ?? join(fichier, "..");
  const pdf = join(dossier, basename(fichier, ".html").replace(/^papier/, "participant") + ".pdf");
  console.log([`# Impression — ${fichier}`, ...await imprimerEtRecetter(html, textesAttendus(donnees), pdf)].join("\n"));
}

/** Livre depuis un PPT de validation : les trois sorties, le rapport et le manifeste, dans `livraison[-séquences]/`. */
async function livrerCommande(fichier: string, sortie: string | undefined, p: ProcedeCharge, sequences: string[] | undefined): Promise<void> {
  const octets = new Uint8Array(readFileSync(fichier));
  const voisin = join(dirname(fichier), "releve.json");
  if (!existsSync(voisin)) throw new Error(`relevé du deck hérité absent (${voisin}) : sans lui, ni rapport ni écart à la source (I-PKG-19) — packager relever <deck> d'abord`);
  const releveSource = JSON.parse(readFileSync(voisin, "utf8")) as Releve;
  const imprimante = await chromiumDisponible();
  const l = await livrer(octets, basename(fichier), {
    procede: p, releveSource, convertir: convertisseur(join(dirname(fichier), "medias-converties")),
    ...(sequences ? { sequences } : {}), ...(imprimante ? { imprimer } : {}),
  });
  if (l.bloquants.length) {
    console.error([`# Livraison refusée — ${l.bloquants.length} constat(s) bloquant(s) dans les séquences livrées`, ...l.bloquants.map((k) => `diapo ${k.diapo ?? "—"} · ${k.regle} · ${k.message}`)].join("\n"));
    process.exit(1);
  }
  const dossier = sortie ?? join(dirname(fichier), `livraison${sequences ? `-${sequences.join("-")}` : ""}`);
  mkdirSync(dossier, { recursive: true });
  for (const [nom, contenu] of l.fichiers) writeFileSync(join(dossier, nom), contenu);
  const m = l.manifeste;
  console.log([
    `# Livraison — ${m.ppt.nom} (${m.source.nom})`,
    `${dossier}/manifeste.json · PPT d'auteur ${m.ppt.empreinte.slice(7, 19)} · pivot ${m.pivot.slice(7, 19)}${sequences ? ` · séquences ${sequences.join(", ")}` : ""}`,
    ...Object.entries(m.sorties).map(([f, x]) => `  ${f} ${x.empreinte.slice(7, 19)}${x.recette ? ` · ${x.pages} pages · recette ${x.recette}` : ""}`),
    `rapport : ${l.rapport.synthese.constats.bloquant} bloquant(s) sur la journée, aucun dans les séquences livrées`,
    ecartEnTexte(l.manifeste),
    m.ecarts.length ? `écarts de lecture : ${m.ecarts.length}` : "aucun écart à la grammaire",
    imprimante ? (l.manquants.length ? `recette du papier : manquent ${l.manquants.slice(0, 5).map((x) => `« ${x.slice(0, 50)} »`).join(", ")}` : "papier imprimé et recetté")
      : "aucun Chromium ici : papier laissé en HTML — packager imprimer, là où Chrome est installé",
  ].join("\n"));
}

/** La planche avant/après d'une livraison, face au deck hérité. */
async function plancheCommande(deck: string, livraison: string, p: ProcedeCharge): Promise<void> {
  const m = JSON.parse(readFileSync(join(livraison, "manifeste.json"), "utf8")) as Manifeste;
  const spec = JSON.parse(readFileSync(join(livraison, "seance-spec.json"), "utf8")) as SeanceSpec;
  const salle = Object.keys(m.sorties).find((f) => f.startsWith("salle"));
  if (!salle) throw new Error(`${livraison} : pas de salle livrée`);
  const html = await planche(deck, spec, join(livraison, salle), p.theme);
  writeFileSync(join(livraison, "avant-apres.html"), html);
  console.log(`# Avant / après — ${join(livraison, "avant-apres.html")} · ${(Buffer.byteLength(html) / 1e6).toFixed(1)} Mo`);
}

/** La fiche de revue chronométrée des séquences retenues, à côté du PPT de validation. */
function revueCommande(fichier: string, sortie: string | undefined, p: ProcedeCharge, sequences: string[] | undefined): void {
  const octets = new Uint8Array(readFileSync(fichier));
  if (!estUnPptDeValidation(octets)) throw new Error(`${fichier} n'est pas un PPT de validation`);
  const voisin = join(dirname(fichier), "releve.json");
  if (!existsSync(voisin)) throw new Error(`relevé du deck hérité absent (${voisin}) : packager relever <deck> d'abord`);
  const releve = JSON.parse(readFileSync(voisin, "utf8")) as Releve;
  const { spec } = lire(octets, p.profil);
  const rapport = diagnostiquer(spec, releve, qualifierReleve(releve, p.profil).qualifications, { charte: p.procede.charte, profil: p.profil });
  const retenues = sequences ?? spec.sequences.map((q) => q.id);
  const html = revueHtml(rapport, spec, diapositivesDesBlocs(octets), retenues, p.theme, p.procede.charte);
  const sortieHtml = join(sortie ?? dirname(fichier), `revue${sequences ? `-${sequences.join("-")}` : ""}.html`);
  writeFileSync(sortieHtml, html);
  const points = (html.match(/<li data-id=/g) ?? []).length;
  console.log([`# Revue — ${basename(fichier)} · séquences ${retenues.join(", ")}`, `${sortieHtml} · ${points} points à trancher, chronométrés`].join("\n"));
}

/** Les médias embarqués d'une salle (hash → data-URI), pour montrer une image avant et après. */
function mediasDeSalle(dossier: string, m: Manifeste): Record<string, string> {
  const salle = Object.keys(m.sorties).find((f) => f.startsWith("salle"));
  const html = salle && existsSync(join(dossier, salle)) ? readFileSync(join(dossier, salle), "utf8") : "";
  const json = html.match(/<script type="application\/json" id="medias">([\s\S]*?)<\/script>/)?.[1];
  return json ? JSON.parse(json) as Record<string, string> : {};
}

/** Compare deux livraisons : écrit `diff.html` et `diff.json` dans la seconde. */
function diffCommande(a: string, b: string, sortie: string | undefined, p: ProcedeCharge): void {
  const charger = (d: string) => ({ manifeste: JSON.parse(readFileSync(join(d, "manifeste.json"), "utf8")) as Manifeste, spec: JSON.parse(readFileSync(join(d, "seance-spec.json"), "utf8")) as SeanceSpec });
  const [x, y] = [charger(a), charger(b)];
  const d = differ(x, y);
  const dossier = sortie ?? b;
  writeFileSync(join(dossier, "diff.json"), stringify2(d));
  writeFileSync(join(dossier, "diff.html"), diffHtml(d, p.theme, { avant: mediasDeSalle(a, x.manifeste), apres: mediasDeSalle(b, y.manifeste) }));
  console.log([
    `# Diff — ${a} → ${b}`,
    `PPT d'auteur ${d.ppt.avant === d.ppt.apres ? "identique" : "modifié"} · pivot ${d.pivot.avant === d.pivot.apres ? "identique" : "modifié"} → ${dossier}/diff.html`,
    ...d.blocs.map((k) => `  ${k.id} (diapositive d'origine ${k.diapo}) ${k.etat} : ${k.changements.map((c) => c.chemin).join(", ")}`),
    ...d.sorties.map((s) => `  ${s.fichier} : ${s.etat}${s.note ? ` (${s.note})` : ""}`),
  ].join("\n"));
}

function qualifierCommande(deck: string, sortie: string | undefined, p: ProcedeCharge): void {
  const { releve, dossier } = ecrireReleve(deck, sortie);
  const { spec, qualifications } = qualifierReleve(releve, p.profil);
  SeanceSpec.parse(spec);
  writeFileSync(join(dossier, "seance-spec.json"), stringify2(spec));
  const rapport = diagnostiquer(spec, releve, qualifications, { charte: p.procede.charte, profil: p.profil });
  writeFileSync(join(dossier, "rapport.json"), stringify2(rapport));
  writeFileSync(join(dossier, "rapport.html"), rapportHtml(rapport, p.theme, p.procede.charte));
  const s = rapport.synthese;
  console.log([
    `# Qualification — ${releve.deck.nom}`,
    `pivot ${rapport.pivot} → ${dossier}/seance-spec.json`,
    `rapport → ${dossier}/rapport.html`,
    "",
    `figures : ${Object.entries(s.figures).map(([f, n]) => `${f} ${n}`).join(" · ")}`,
    `pas : ${s.pas.total} · repère ${s.pas.repere} · légende ${s.pas.legende} · proposée ${s.pas.proposee} · sans zone ${s.pas.sansZone} · sans consigne ${s.pas.sansConsigne}`,
    `constats : ${Object.entries(s.constats).map(([n, v]) => `${n} ${v}`).join(" · ")}`,
  ].join("\n"));
}

function releverCommande(deck: string, sortie: string | undefined, p: ProcedeCharge | undefined): void {
  const { nom, releve, medias, dossier, texte } = ecrireReleve(deck, sortie);

  const m = mesurer(releve, p?.profil);
  const pc = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)} %` : "—");
  const lignes = [
    `# Relevé — ${nom}`,
    `empreinte du relevé ${sha256(texte)}`,
    `écrit dans ${dossier}/ (releve.json + ${medias.size} médias)`,
    "",
    `diapositives ${m.diapositives} · dispositions ${m.dispositions} · masques ${m.masques}`,
    `mots ${m.mots} · médiane/diapo ${medianeMots(releve)} · denses (>90) ${m.denses.length}`,
    `notes ${m.notes}/${m.diapositives}`,
    `pas-à-pas ${m.pasAPas} · captures sans pastille ${m.capturesSeules} · autres ${m.autres}`,
    `pastilles sur capture ${m.pastillesSur}, dont accolées à une zone ${m.pastillesSurZone}`,
    `pastilles hors capture ${m.pastillesHors}, dont proches d'un texte ${m.pastillesHorsTexte}`,
    `résolution des captures : médiane ${medianeResolution(m).toFixed(2)}, sous 1,0 : ${m.resolutions.filter((x) => x < 1).length}/${m.resolutions.length}` +
      (m.capturesIllisibles ? ` (${m.capturesIllisibles} non lues)` : ""),
    `médias à convertir pour la salle : ${Object.entries(m.nonWeb).map(([e, n]) => `${n} ${e.toUpperCase()}`).join(", ") || "aucun"}` +
      ` · objets OLE et graphiques : ${Object.entries(m.graphiques).map(([g, n]) => `${n} ${g}`).join(", ") || "aucun"}`,
    `marqueurs d'inachèvement : ${m.inacheves.map(([n, w]) => `${n} « ${w} »`).join(", ") || "aucun"}`,
    "",
    `appariement : ${m.appariement.pas} pas · paires repère-légende ${m.appariement.paires} · repères seuls ${m.appariement.reperesSeuls}` +
      ` · légendes seules ${m.appariement.legendesSeules} · zone ${pc(m.appariement.avecZone, m.appariement.pas)}` +
      ` · consigne ${pc(m.appariement.avecConsigne, m.appariement.pas)} · complets (zone et consigne) ${pc(m.appariement.complets, m.appariement.pas)}`,
    "",
    p ? `séquences, par le profil ${p.profil.nom} (n0 · diapos · démo · pas-à-pas · captures · pratique par formule · par disposition · étapes clés · mots)`
      : "séquences : il faut un profil de source pour les lire (--procede)",
    ...m.sequences.map((q) =>
      [q.n0, q.diapositives, q.demonstrations, q.pasAPas, q.captures, q.pratiquesParFormule, q.pratiquesParDisposition, q.etapesCles]
        .map((v, i) => String(v).padStart(i === 0 ? 4 : 3)).join(" ") + ` ${String(q.mots).padStart(5)}  ${q.titre.slice(0, 56)}`),
  ];
  console.log(lignes.join("\n"));
}

/** L'écart à la source d'une livraison, en une ligne. */
function ecartEnTexte(m: Manifeste): string {
  const e = m.ecart;
  return `écart à la source (sensibilité ${e.sensibilite}) : chaîne ${e.chaine.inventes} mot(s) inventé(s), ${e.chaine.inversions} inversion(s)`
    + ` ; revue ${e.revue.inventes} mot(s) nouveau(x), ${e.revue.inversions} inversion(s), ${e.revue.retirees} diapositive(s) retirée(s),`
    + ` ${e.revue.ajoutes + e.revue.dupliques} bloc(s) ajouté(s) ; ${Math.round(e.conserve * 1000) / 10} % du texte d'origine conservé`;
}

/** Rejoue un procédé sur un deck (et le PPT revu) : la chaîne entière, puis la comparaison à sa référence. */
async function rejouerCommande(p: ProcedeCharge, deck: string, revue: string | undefined, sortie: string | undefined, sequences: string[] | undefined, nouvelleReference: string | undefined): Promise<void> {
  const imprimante = await chromiumDisponible();
  const dossier = sortie ?? join("out", "rejeu", p.procede.nom, basename(deck, extname(deck)));
  const r = await rejouer(p, {
    deck, ...(revue ? { revue } : {}), ...(sequences ? { sequences } : {}), sortie: dossier,
    ...(imprimante ? { imprimer } : {}), convertir: convertisseur(join(dossier, "medias-converties")),
    moteurs: { chromium: await versionDuNavigateur(), libreoffice: versionDeLibreOffice() },
    ...(nouvelleReference ? { nouvelleReference } : {}),
  });
  const lignes = [
    `# Rejeu — ${p.procede.nom} · ${basename(deck)}${revue ? ` · revue ${basename(revue)}` : ""} · ${r.extrait} → ${dossier}`,
    ...p.absences.map((a) => `ABSENT  ${a} : données du client hors dépôt, le rejeu ne peut être conforme`),
    ...(p.conversions ? [`conversions figées : ${p.conversions.svg.size} (${p.conversions.provenance})`] : []),
    ...(r.versions.length ? ["versions en écart (la conformité se juge aux empreintes) :", ...r.versions.map((v) => `  ${v.quoi} : ${v.trouvee ?? "absent"} au lieu de ${v.attendue ?? "absent"}`)] : ["versions : celles du procédé"]),
    ...r.comparaisons.map((c) => (c.attendue !== null && c.attendue === c.obtenue ? `  identique  ${c.quoi}` : `  DIFFÉRENT  ${c.quoi} : ${c.obtenue ?? "absent"} au lieu de ${c.attendue ?? "(pas de référence)"}`)),
    ...(r.refus.length ? [`livraison refusée (${r.refus.length}) :`, ...r.refus.map((x) => `  ${x}`)] : []),
    `écart à la source : chaîne ${r.ecart.chaine.inventes.length} mot(s) inventé(s), ${r.ecart.chaine.inversions} inversion(s) ; revue ${r.ecart.revue.inventes.length} mot(s) nouveau(x), ${r.ecart.revue.retirees.length} diapositive(s) retirée(s)`,
    ...(nouvelleReference ? [`empreintes obtenues écrites dans ${nouvelleReference} (${r.cas} · ${r.extrait})`] : []),
    r.conforme ? `conforme à la référence (${r.comparaisons.length} empreintes identiques)` : `NON CONFORME : ${r.comparaisons.filter((c) => c.attendue === null || c.attendue !== c.obtenue).length} écart(s) à la référence — monter de version est un acte (rejeu, diff, décision)`,
  ];
  console.log(lignes.join("\n"));
  if (!r.conforme) process.exit(1);
}

/**
 * Le corpus d'épreuve (GEN-0), hors chaîne : `preparer` écrit les tableurs de vérité manquants (jamais ceux qui existent) ;
 * `mesurer` écrit les lectures étendues de chaque deck et le tableau comparé.
 */
function corpusCommande(action: string, manifeste: string, sortie: string | undefined): void {
  const c = chargerCorpus(manifeste);
  if (action === "preparer") {
    const aEcrire = veritesAPreparer(c);
    for (const { deck, contenu } of aEcrire) writeFileSync(deck.verite, contenu);
    const gardes = c.decks.filter((d) => d.deck.role === "tableau" && !aEcrire.some((x) => x.deck === d));
    console.log([
      `# Corpus ${c.corpus.nom} — vérité de terrain`,
      ...aEcrire.map(({ deck }) => `écrit ${deck.verite}`),
      ...gardes.map((d) => `gardé ${d.verite}`),
      "Corriger la colonne « verite » là où les règles se trompent, puis passer le deck à « verite »: \"revue\" dans le manifeste.",
    ].join("\n"));
    return;
  }
  const { tableau, lectures } = mesurerCorpus(c);
  const dossier = sortie ?? join("out", "corpus", c.corpus.nom);
  for (const [nom, l] of lectures) {
    mkdirSync(join(dossier, basename(nom, extname(nom))), { recursive: true });
    writeFileSync(join(dossier, basename(nom, extname(nom)), "lectures.json"), stringify2(l));
  }
  writeFileSync(join(dossier, "tableau.json"), stringify2(tableau));
  const md = tableauEnMarkdown(tableau);
  writeFileSync(join(dossier, "tableau.md"), md);
  console.log(md + `\n→ ${dossier}/tableau.md, tableau.json et les lectures de ${lectures.size} deck(s)`);
}

const [commande, ...args] = process.argv.slice(2);
const option = (nom: string) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
};
// Les identifiants de séquence s'écrivent en minuscules (s030) ; « S030 » vaut « s030 ».
const sequences = option("--sequences")?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const nomDuProcede = option("--procede");
/** Le procédé des commandes qui en ont besoin : il n'y a pas de défaut, le code ne choisit aucun client. */
const procede = (): ProcedeCharge => {
  if (!nomDuProcede) {
    console.error(`${commande} : il faut un procédé (--procede <nom ou fichier>, ex. ceux de procedes/)`);
    process.exit(2);
  }
  return chargerProcede(nomDuProcede);
};
if (commande === "relever" && args[0]) releverCommande(args[0], option("--sortie"), nomDuProcede ? procede() : undefined);
else if (commande === "qualifier" && args[0]) qualifierCommande(args[0], option("--sortie"), procede());
else if (commande === "emettre" && args[0]) emettreCommande(args[0], option("--sortie"), procede());
else if (commande === "lire" && args[0]) lireCommande(args[0], option("--sortie"), procede());
else if (commande === "salle" && args[0]) {
  // Le dévoilement est celui de la prise du procédé, sauf à le forcer pour un aperçu.
  const p = procede();
  const devoilement = option("--devoilement") === "ecran" ? "ecran" : option("--devoilement") === "pastille" ? "pastille" : p.procede.prise.devoilement;
  await salleCommande(args[0], option("--sortie"), p, sequences, devoilement);
} else if (commande === "papier" && args[0]) {
  await papierCommande(args[0], option("--sortie"), procede(), sequences);
} else if (commande === "imprimer" && args[0]) {
  await imprimerCommande(args[0], option("--sortie"));
} else if (commande === "planche" && args[0] && args[1] && !args[1].startsWith("--")) {
  await plancheCommande(args[0], args[1], procede());
} else if (commande === "revue" && args[0]) {
  revueCommande(args[0], option("--sortie"), procede(), sequences);
} else if (commande === "livrer" && args[0]) {
  await livrerCommande(args[0], option("--sortie"), procede(), sequences);
} else if (commande === "diff" && args[0] && args[1] && !args[1].startsWith("--")) {
  diffCommande(args[0], args[1], option("--sortie"), procede());
} else if (commande === "rejouer" && args[0] && args[1] && !args[1].startsWith("--")) {
  await rejouerCommande(chargerProcede(args[0]), args[1], option("--revue"), option("--sortie"), sequences, option("--nouvelle-reference"));
} else if (commande === "corpus" && (args[0] === "preparer" || args[0] === "mesurer") && args[1]) {
  corpusCommande(args[0], args[1], option("--sortie"));
} else {
  console.error("usage : packager relever|qualifier|emettre|lire|salle|papier|revue|livrer <deck.pptx | validation.pptx> --procede <procédé> | imprimer <papier.html> | diff <livraison> <livraison> --procede <procédé> | planche <deck> <livraison> --procede <procédé> | rejouer <procédé> <deck.pptx> [--revue <validation revue.pptx>] [--sortie <dossier>] [--sequences s030,…] [--nouvelle-reference <golden/…json>] [--devoilement pastille|ecran] | corpus preparer|mesurer <corpus.json> [--sortie <dossier>]");
  process.exit(2);
}
