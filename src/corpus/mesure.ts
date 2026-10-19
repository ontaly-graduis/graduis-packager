// La mesure du corpus d'épreuve : chaque deck relevé, qualifié au profil de mesure et lu en lectures étendues ; les tableurs
// de vérité préremplis ; le tableau comparé. Hors de la chaîne de production : rien n'en sort vers une livraison (GEN-0).
import { existsSync } from "node:fs";
import { relever } from "../releve/releve";
import { qualifierReleve } from "../qualification/qualifier";
import { lireVerite, tableurDeVerite, type CorpusCharge, type DeckCharge } from "./corpus";
import { lireEtendu, type Lectures } from "./lectures";
import { tableauDuCorpus, type MesureDeDeck, type Tableau } from "./tableau";

/** Les tableurs de vérité des decks du tableau qui n'en ont pas encore : jamais réécrits, ils portent les corrections humaines. */
export function veritesAPreparer(c: CorpusCharge): { readonly deck: DeckCharge; readonly contenu: string }[] {
  return c.decks.filter((d) => d.deck.role === "tableau" && !existsSync(d.verite)).map((d) => {
    const { releve } = relever(d.octets, d.nom);
    const q = qualifierReleve(releve, c.profil);
    return { deck: d, contenu: tableurDeVerite(q.spec, q.qualifications) };
  });
}

export function mesurerCorpus(c: CorpusCharge): { readonly tableau: Tableau; readonly lectures: ReadonlyMap<string, Lectures> } {
  const lectures = new Map<string, Lectures>();
  const mesures = c.decks.map((d): MesureDeDeck => {
    const { releve } = relever(d.octets, d.nom);
    const l = lireEtendu(d.octets, releve);
    lectures.set(d.nom, l);
    const base = { nom: d.nom, famille: d.deck.famille, client: d.deck.client, role: d.deck.role, lectures: l };
    if (d.deck.role !== "tableau") return base;
    const { qualifications } = qualifierReleve(releve, c.profil);
    if (d.deck.verite !== "revue") return { ...base, qualifications };
    if (!existsSync(d.verite)) throw new Error(`${d.nom} : vérité dite revue, mais ${d.verite} est absent (corpus preparer)`);
    return { ...base, qualifications, verite: lireVerite(d.verite, releve.diapositives.length) };
  });
  return {
    tableau: tableauDuCorpus({ nom: c.corpus.nom, empreinte: c.empreinte, profil: c.corpus.profil.empreinte }, mesures),
    lectures,
  };
}
