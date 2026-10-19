// La revue de la vérité de terrain (GEN-0) : un serveur local (127.0.0.1) qui montre chaque diapositive rendue par PowerPoint,
// la figure des règles, et écrit chaque geste de l'humain dans le tableur de vérité ; « deck revu » passe au manifeste.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify2 } from "../lib/json";
import { Paquet } from "../ooxml/paquet";
import { FIGURES } from "../pivot/seance-spec";
import { LIBELLES } from "../pivot/libelles";
import { CANDIDATES, ecrireTableur, figureDeVerite, lireTableur, type CorpusCharge, type LigneDeVerite } from "./corpus";

const ICI = dirname(fileURLToPath(import.meta.url));
const PDFJS = join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "build");

/** Les libellés des figures candidates (spec § 4.5), pour la page. */
const LIBELLES_CANDIDATES: Readonly<Record<(typeof CANDIDATES)[number], string>> = {
  citation: "Citation", "chiffre-cle": "Chiffre clé", comparaison: "Comparaison", chronologie: "Chronologie", graphique: "Graphique",
  video: "Vidéo", "consigne-atelier": "Consigne d'atelier", quiz: "Quiz", programme: "Programme",
};

type Rendu = "pret" | "en-cours" | "absent";

interface DeckEnRevue {
  readonly id: number;
  readonly nom: string;
  readonly chemin: string;
  readonly tableur: string;
  readonly pdf: string;
  /** Les diapositives masquées : PowerPoint peut les omettre du PDF. */
  readonly masquees: readonly number[];
  rendu: Rendu;
}

export interface OptionsDeRevue {
  /** Le dossier de la mesure : les rendus PDF y vivent (`rendus/`). */
  readonly dossier: string;
  /** Le rendu d'un deck en PDF (PowerPoint) ; sans lui, la page montre les diapositives sans vignette. */
  readonly rendre?: (deck: string, pdf: string) => Promise<boolean>;
}

function corps(req: IncomingMessage): Promise<unknown> {
  return new Promise((ok, ko) => {
    let t = "";
    req.on("data", (c: Buffer) => { t += c.toString("utf8"); });
    req.on("end", () => { try { ok(JSON.parse(t || "{}")); } catch (e) { ko(e); } });
    req.on("error", ko);
  });
}

/** Écrit sans jamais laisser un fichier à moitié écrit : un fichier voisin, puis un renommage. */
function ecrireAtomique(fichier: string, contenu: string): void {
  writeFileSync(fichier + ".tmp", contenu);
  renameSync(fichier + ".tmp", fichier);
}

export function servirRevue(c: CorpusCharge, manifeste: string, options: OptionsDeRevue): Server {
  const decks: DeckEnRevue[] = c.decks.flatMap((d, id) => {
    if (d.deck.role !== "tableau") return [];
    if (!existsSync(d.verite)) throw new Error(`${d.nom} : pas de tableur de vérité (corpus preparer d'abord)`);
    const pdf = join(options.dossier, "rendus", `${basename(d.nom, ".pptx")}-${d.deck.empreinte.slice(7, 19)}.pdf`);
    const masquees = new Paquet(d.octets).diapositives().filter((x) => x.masquee).map((x) => x.n);
    return [{ id, nom: d.nom, chemin: d.chemin, tableur: d.verite, pdf, masquees, rendu: existsSync(pdf) ? "pret" : options.rendre ? "en-cours" : "absent" }];
  });

  // Les rendus manquants, un deck après l'autre (PowerPoint n'en exporte qu'un à la fois) ; la page suit leur état.
  void (async () => {
    for (const d of decks.filter((x) => x.rendu === "en-cours")) d.rendu = (await options.rendre!(d.chemin, d.pdf)) ? "pret" : "absent";
  })();

  const revues = () => {
    const m = JSON.parse(readFileSync(manifeste, "utf8")) as { decks: { verite?: string }[] };
    return m.decks.map((x) => x.verite === "revue");
  };
  const etat = () => {
    const r = revues();
    return decks.map((d) => ({ id: d.id, nom: d.nom, rendu: d.rendu, revue: r[d.id] ?? false, masquees: d.masquees, lignes: lireTableur(d.tableur) }));
  };
  const deckDe = (url: string, prefixe: string) => decks.find((d) => url === `${prefixe}${d.id}`);

  return createServer(async (req, res) => {
    const envoyer = (code: number, type: string, contenu: string | Buffer) => {
      res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
      res.end(contenu);
    };
    const json = (code: number, x: unknown) => envoyer(code, "application/json; charset=utf-8", JSON.stringify(x));
    try {
      const url = (req.url ?? "/").split("?")[0]!;
      if (req.method === "GET" && url === "/") return envoyer(200, "text/html; charset=utf-8", readFileSync(join(ICI, "revue", "page.html")));
      if (req.method === "GET" && url === "/client.js") return envoyer(200, "text/javascript; charset=utf-8", readFileSync(join(ICI, "revue", "client.js")));
      if (req.method === "GET" && (url === "/pdfjs/pdf.min.mjs" || url === "/pdfjs/pdf.worker.min.mjs")) {
        return envoyer(200, "text/javascript; charset=utf-8", readFileSync(join(PDFJS, basename(url))));
      }
      if (req.method === "GET" && url === "/donnees") {
        return json(200, {
          corpus: c.corpus.nom,
          figures: [
            ...FIGURES.map((id) => ({ id, libelle: LIBELLES[id], groupe: "figure" })),
            ...CANDIDATES.map((id) => ({ id, libelle: LIBELLES_CANDIDATES[id], groupe: "candidate" })),
          ],
          decks: etat(),
        });
      }
      if (req.method === "GET" && url.startsWith("/rendu/")) {
        const d = deckDe(url, "/rendu/");
        return d && d.rendu === "pret" ? envoyer(200, "application/pdf", readFileSync(d.pdf)) : json(404, { erreur: "pas de rendu" });
      }
      if (req.method === "POST" && url.startsWith("/verite/")) {
        const d = deckDe(url, "/verite/");
        const b = (await corps(req)) as { diapo?: number; verite?: string; note?: string };
        const figure = figureDeVerite(b.verite ?? "");
        if (!d || !figure) return json(400, { erreur: `« ${b.verite ?? ""} » n'est ni une figure, ni une candidate, ni « autre : <nom> »` });
        const lignes = lireTableur(d.tableur);
        const i = lignes.findIndex((l) => Number.parseInt(l.diapo, 10) === b.diapo);
        if (i < 0) return json(400, { erreur: `diapositive ${b.diapo} absente du tableur` });
        const ligne: LigneDeVerite = { ...lignes[i]!, verite: figure, vue: "1", note: (b.note ?? lignes[i]!.note).trim() };
        lignes[i] = ligne;
        ecrireAtomique(d.tableur, ecrireTableur(lignes));
        return json(200, ligne);
      }
      if (req.method === "POST" && url.startsWith("/revue/")) {
        const d = deckDe(url, "/revue/");
        const b = (await corps(req)) as { revue?: boolean };
        if (!d) return json(404, { erreur: "deck inconnu" });
        const restantes = lireTableur(d.tableur).filter((l) => l.vue !== "1").length;
        if (b.revue && restantes) return json(409, { erreur: `${restantes} diapositive(s) pas encore vue(s)` });
        const m = JSON.parse(readFileSync(manifeste, "utf8")) as { decks: Record<string, unknown>[] };
        m.decks[d.id] = { ...m.decks[d.id], verite: b.revue ? "revue" : "a-revoir" };
        ecrireAtomique(manifeste, stringify2(m));
        return json(200, { revue: Boolean(b.revue) });
      }
      json(404, { erreur: "inconnu" });
    } catch (e) {
      json(500, { erreur: e instanceof Error ? e.message : String(e) });
    }
  });
}
