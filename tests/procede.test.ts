// Témoins de GEN-1 : le procédé (profil et thème en données, épinglés par leur empreinte), l'écart à la source (borné sur la
// chaîne, compté sur la revue), et le code qui ne nomme aucun client.
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { describe, expect, it } from "vitest";
import { ecartDeLivraison } from "../src/ecart/ecart";
import { emettre } from "../src/emission/emettre";
import { lire } from "../src/lecture/lire";
import { chargerProcede, versionsEnEcart } from "../src/procede/procede";
import { avecConversionsFigees, chargerConversions } from "../src/medias/convertir";
import { sha256 } from "../src/lib/json";
import type { SeanceSpec } from "../src/pivot/seance-spec";
import { qualifierReleve } from "../src/qualification/qualifier";
import { relever } from "../src/releve/releve";
import { deckSynthetique } from "./fixture";
import { ONET, PROFIL } from "./procede";

async function chaine() {
  const { releve, medias } = relever(await deckSynthetique(), "deck.pptx");
  const pivot0 = qualifierReleve(releve, PROFIL).spec;
  const ppt = emettre(pivot0, { theme: ONET.theme, media: (h) => { const m = medias.get(h); return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined; } });
  return { releve, pivot0, ppt };
}

const copie = (s: SeanceSpec): SeanceSpec => JSON.parse(JSON.stringify(s)) as SeanceSpec;

describe("le procédé (GEN-1)", () => {
  it("charge le procédé ONET : profil et thème à leur empreinte, sensibilité minimale, prise pastille par pastille", () => {
    expect(ONET.procede.nom).toBe("onet-boost");
    expect(ONET.procede.sensibilite).toBe("minimale");
    expect(ONET.procede.prise).toEqual({ devoilement: "pastille" });
    expect(PROFIL.dispositions.length).toBeGreaterThan(0);
    expect(ONET.empreinte).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("refuse un profil qui a changé sans décision (G-4)", () => {
    const dossier = mkdtempSync(join(tmpdir(), "procede-"));
    mkdirSync(join(dossier, "procedes"));
    const p = JSON.parse(readFileSync("procedes/onet-boost.json", "utf8"));
    p.profil = { chemin: resolve("gabarits/profil-onet.json"), empreinte: `sha256:${"0".repeat(64)}` };
    p.theme.chemin = resolve(p.theme.chemin);
    writeFileSync(join(dossier, "procedes", "autre.json"), JSON.stringify(p));
    expect(() => chargerProcede(join(dossier, "procedes", "autre.json"))).toThrow(/ne correspond\(ent\) plus à l'empreinte épinglée/);
  });

  it("épingle ses versions : le verrou du dépôt est celui du procédé, rien ne refuse le rejeu", () => {
    const enEcart = versionsEnEcart(ONET, { chromium: ONET.procede.versions.moteurs.chromium, libreoffice: ONET.procede.versions.moteurs.libreoffice });
    expect(enEcart.filter((v) => v.bloquante)).toEqual([]);
  });
});

describe("les conversions figées (MV-1)", () => {
  const EMF = `sha256:${"a".repeat(64)}`;
  function figer(svg: string) {
    const d = mkdtempSync(join(tmpdir(), "conversions-"));
    writeFileSync(join(d, "a.svg"), svg);
    writeFileSync(join(d, "manifeste.json"), JSON.stringify({
      schema: "graduis/conversions@0", outil: "témoin", banc_serveurs_conformes: { convertir_metafichier: { serveur: "libreoffice", version: "témoin" } },
      document: "deck.pptx", document_sha256: `sha256:${"b".repeat(64)}`, genere_le: "2026-10-18",
      assets: [{ source_sha256: EMF, source_ext: "emf", media_type: "image/svg+xml", path: "a.svg", asset_sha256: sha256(svg), transcode: "témoin" }],
    }));
    return d;
  }

  it("passent avant LibreOffice ; un média qui n'y est pas va au repli", () => {
    const c = chargerConversions(join(figer("<svg/>"), "manifeste.json"));
    const convertir = avecConversionsFigees(c, () => new Uint8Array([9]))!;
    expect(new TextDecoder().decode(convertir(EMF, "emf", new Uint8Array()) ?? undefined)).toBe("<svg/>");
    expect(convertir(`sha256:${"c".repeat(64)}`, "emf", new Uint8Array())).toEqual(new Uint8Array([9]));
  });

  it("refusent un SVG qui n'est plus celui du manifeste (G-4)", () => {
    const d = figer("<svg/>");
    writeFileSync(join(d, "a.svg"), "<svg>retouché</svg>");
    expect(() => chargerConversions(join(d, "manifeste.json"))).toThrow(/n'est plus celui du manifeste/);
  });

  it("absentes (données du client hors dépôt), le procédé se charge et le dit", () => {
    const dossier = mkdtempSync(join(tmpdir(), "procede-"));
    mkdirSync(join(dossier, "procedes"));
    const p = JSON.parse(readFileSync("procedes/onet-boost.json", "utf8"));
    p.profil.chemin = resolve(p.profil.chemin);
    p.theme.chemin = resolve(p.theme.chemin);
    p.conversions.chemin = join(dossier, "absentes", "manifeste.json");
    writeFileSync(join(dossier, "procedes", "sans-conversions.json"), JSON.stringify(p));
    const charge = chargerProcede(join(dossier, "procedes", "sans-conversions.json"));
    expect([charge.conversions, charge.absences.length]).toEqual([null, 1]);
  });
});

describe("l'écart à la source (I-PKG-19)", () => {
  it("la chaîne n'invente aucun mot et garde l'ordre ; relu sans revue, rien ne change", async () => {
    const { releve, pivot0, ppt } = await chaine();
    const e = ecartDeLivraison(releve, pivot0, lire(ppt, PROFIL).spec, "minimale");
    expect([e.chaine.inventes, e.chaine.inversions, e.revue.inventes, e.revue.retirees]).toEqual([[], 0, [], []]);
    expect(e.franchies).toEqual([]);
  });

  it("ce que la revue porte dans le PPT est compté, jamais bloquant", async () => {
    const { releve, pivot0, ppt } = await chaine();
    const p = unzipSync(ppt);
    p["ppt/slides/slide3.xml"] = strToU8(strFromU8(p["ppt/slides/slide3.xml"]!).replace("A rédiger", "Commander seul"));
    const e = ecartDeLivraison(releve, pivot0, lire(zipSync(p as Zippable), PROFIL).spec, "minimale");
    expect(e.revue.inventes.map((m) => m.mot)).toEqual(["commander", "seul"]);
    expect(e.franchies).toEqual([]);
  });

  it("un mot inventé ou un bloc déplacé par la chaîne franchit les bornes de la minimale", async () => {
    const { releve, pivot0 } = await chaine();
    const invente = copie(pivot0);
    invente.sequences[0]!.blocs[2]!.textes.push("Distracteur");
    expect(ecartDeLivraison(releve, invente, invente, "minimale").franchies).toEqual([expect.stringMatching(/^1 mot\(s\) inventé\(s\) par la chaîne .*« distracteur »/)]);
    const deplace = copie(pivot0);
    const blocs = deplace.sequences[0]!.blocs;
    [blocs[1], blocs[2]] = [blocs[2]!, blocs[1]!];
    expect(ecartDeLivraison(releve, deplace, deplace, "minimale").franchies).toEqual(["1 bloc(s) déplacé(s) par la chaîne (minimale : ordre identique)"]);
  });
});

describe("le code ne nomme aucun client (GEN-1)", () => {
  // Le nom du client, son programme, son logiciel, son thème, les dispositions de son gabarit : ce qui vit dans les données.
  const TERMES = [/\bonet\b/i, /\bboost\b/i, /montserrat/i, /\bOracle\b/, /acheteur/i, /Slide transition/, /Votre promotion/, /Regles du jeu/, /Que retenez/, /ptp-/i, /\bMeteo\b/];
  const fichiers = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? fichiers(join(d, f)) : [join(d, f)]));

  it("aucune mention dans src/ : profil, thème, charte et procédé vivent dans gabarits/ et procedes/", () => {
    const mentions = fichiers("src").flatMap((f) => readFileSync(f, "utf8").split("\n")
      .flatMap((l, i) => TERMES.filter((t) => t.test(l)).map((t) => `${f}:${i + 1} ${t}`)));
    expect(mentions).toEqual([]);
  });
});
