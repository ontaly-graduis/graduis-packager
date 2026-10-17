// CLI du packager — `packager relever <deck.pptx> [--sortie <dossier>]` : relevé, médias hashés, mesures.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { sha256, stringify2 } from "../lib/json";
import { relever } from "../releve/releve";
import { medianeMots, medianeResolution, mesurer } from "../releve/mesures";
import { qualifierReleve } from "../qualification/qualifier";
import { SeanceSpec } from "../pivot/seance-spec";
import { diagnostiquer } from "../diagnostic/regles";
import { rapportHtml } from "../diagnostic/rapport-html";
import { chargerTheme } from "../theme/theme";

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

function qualifierCommande(deck: string, sortie: string | undefined, dossierTheme: string): void {
  const { releve, dossier } = ecrireReleve(deck, sortie);
  const { spec, qualifications } = qualifierReleve(releve);
  SeanceSpec.parse(spec);
  writeFileSync(join(dossier, "seance-spec.json"), stringify2(spec));
  const rapport = diagnostiquer(spec, releve, qualifications);
  writeFileSync(join(dossier, "rapport.json"), stringify2(rapport));
  writeFileSync(join(dossier, "rapport.html"), rapportHtml(rapport, chargerTheme(dossierTheme)));
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

function releverCommande(deck: string, sortie: string | undefined): void {
  const { nom, releve, medias, dossier, texte } = ecrireReleve(deck, sortie);

  const m = mesurer(releve);
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
    "séquences (n0 · diapos · démo · pas-à-pas · captures · à vous de jouer · règles du jeu · retenez · mots)",
    ...m.sequences.map((q) =>
      [q.n0, q.diapositives, q.demonstrations, q.pasAPas, q.captures, q.aVousDeJouer, q.reglesDuJeu, q.etapesCles]
        .map((v, i) => String(v).padStart(i === 0 ? 4 : 3)).join(" ") + ` ${String(q.mots).padStart(5)}  ${q.titre.slice(0, 56)}`),
  ];
  console.log(lignes.join("\n"));
}

const [commande, ...args] = process.argv.slice(2);
const option = (nom: string) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
};
if (commande === "relever" && args[0]) releverCommande(args[0], option("--sortie"));
else if (commande === "qualifier" && args[0]) qualifierCommande(args[0], option("--sortie"), option("--theme") ?? "gabarits/theme-onet");
else {
  console.error("usage : packager relever|qualifier <deck.pptx> [--sortie <dossier>] [--theme <dossier>]");
  process.exit(2);
}
