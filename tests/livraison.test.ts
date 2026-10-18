// Témoins de la livraison (PKG-E) : seul le PPT de validation livre ; les trois sorties et le rapport sous un manifeste
// déterministe ; un bloquant arrête tout ; le scénario de modification — une capture remplacée dans PowerPoint, la chaîne
// rejouée — ne change qu'un bloc, et le diff le dit.
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { describe, expect, it } from "vitest";
import { emettre } from "../src/emission/emettre";
import { differ } from "../src/livraison/diff";
import { diagnostiquer } from "../src/diagnostic/regles";
import { revueHtml } from "../src/diagnostic/revue";
import { diapositivesDesBlocs, lire } from "../src/lecture/lire";
import { livrer } from "../src/livraison/livrer";
import { stringify2 } from "../src/lib/json";
import { SeanceSpec } from "../src/pivot/seance-spec";
import { qualifierReleve } from "../src/qualification/qualifier";
import { relever } from "../src/releve/releve";
import { chargerTheme } from "../src/theme/theme";
import { deckDeTableau, deckSynthetique, png } from "./fixture";

const theme = chargerTheme("gabarits/theme-onet");

async function pptDeValidation(deck: Uint8Array) {
  const { releve, medias } = relever(deck, "deck.pptx");
  const spec = SeanceSpec.parse(qualifierReleve(releve).spec);
  return { releve, octets: emettre(spec, { jetons: theme.jetons, media: (h) => { const m = medias.get(h); return m ? { ext: m.ext, octets: m.octets, px: releve.medias[h]?.px ?? null } : undefined; } }) };
}

/** Ce que fait PowerPoint pour « Changer l'image » : une nouvelle partie média, la relation de l'image pointée dessus. */
function changerLImage(octets: Uint8Array, diapo: number, nouvelle: ArrayLike<number>): Uint8Array {
  const p = unzipSync(octets);
  const xml = strFromU8(p[`ppt/slides/slide${diapo}.xml`]!);
  const rId = xml.match(/name="G·capture"[\s\S]*?r:embed="(rId\d+)"/)![1]!;
  const rels = `ppt/slides/_rels/slide${diapo}.xml.rels`;
  p[rels] = strToU8(strFromU8(p[rels]!).replace(new RegExp(`(Id="${rId}"[^>]*Target=")[^"]+`), "$1../media/image-nouvelle.png"));
  p["ppt/media/image-nouvelle.png"] = new Uint8Array(nouvelle);
  return zipSync(p as Zippable);
}

describe("la livraison (PKG-E)", () => {
  it("ne livre que depuis un PPT de validation : un deck hérité est refusé (I-PKG-4)", async () => {
    await expect(livrer(await deckSynthetique(), "deck.pptx", { theme })).rejects.toThrow(/l'heuristique ne livre jamais/);
  });

  it("livre la salle, le papier, le PPT d'animation et le rapport sous un manifeste déterministe", async () => {
    const { releve, octets } = await pptDeValidation(await deckDeTableau());
    const a = await livrer(octets, "validation.pptx", { theme, releveSource: releve });
    const b = await livrer(octets, "validation.pptx", { theme, releveSource: releve });
    expect([...a.fichiers.keys()].sort()).toEqual(["animation.pptx", "manifeste.json", "papier.html", "rapport.html", "rapport.json", "salle.html", "seance-spec.json"]);
    expect(stringify2(a.manifeste)).toBe(stringify2(b.manifeste));
    expect(Object.keys(a.manifeste.sorties).sort()).toEqual(["animation.pptx", "papier.html", "rapport.html", "salle.html"]);
    expect(a.manifeste.ecarts).toEqual([]);
    // Le PPT d'animation est le PPT d'auteur réémis : relu, il donne le même pivot.
    expect(a.manifeste.pivot).toBe((await livrer(a.fichiers.get("animation.pptx") as Uint8Array, "animation.pptx", { theme })).manifeste.pivot);
  });

  it("refuse de livrer une séquence qui porte un constat bloquant (H8)", async () => {
    const { releve, octets } = await pptDeValidation(await deckSynthetique());
    const l = await livrer(octets, "validation.pptx", { theme, releveSource: releve });
    expect(l.bloquants.map((k) => k.regle)).toEqual(["H8"]);
    expect(l.fichiers.size).toBe(0);
  });

  it("rejoue la chaîne après une capture remplacée : un seul bloc change, sa capture et les pas qui la désignent ; le diff le dit", async () => {
    const { octets } = await pptDeValidation(await deckSynthetique());
    const avant = await livrer(octets, "validation.pptx", { theme });
    const apres = await livrer(changerLImage(octets, 2, new Uint8Array(png(1600, 800, 0xcc))), "validation.pptx", { theme });
    const d = differ({ manifeste: avant.manifeste, spec: JSON.parse(avant.fichiers.get("seance-spec.json") as string) },
      { manifeste: apres.manifeste, spec: JSON.parse(apres.fichiers.get("seance-spec.json") as string) });
    expect(d.ppt.avant).not.toBe(d.ppt.apres);
    expect(d.blocs.map((b) => [b.id, b.etat, b.changements.map((c) => c.chemin)])).toEqual([["b002", "modifie", ["visuels[0].media", "pas[0].capture", "pas[1].capture"]]]);
    expect(Object.fromEntries(d.sorties.map((s) => [s.fichier, s.etat]))).toEqual({ "animation.pptx": "modifiee", "papier.html": "modifiee", "salle.html": "modifiee" });
  });

  it("prépare la fiche de revue : la relecture, puis chaque constat à trancher dans l'ordre du PPT, son geste, un chronomètre", async () => {
    const { releve, octets } = await pptDeValidation(await deckSynthetique());
    const { spec } = lire(octets);
    const rapport = diagnostiquer(spec, releve, qualifierReleve(releve).qualifications);
    const html = revueHtml(rapport, spec, diapositivesDesBlocs(octets), ["s001"], theme);
    const points = [...html.matchAll(/<li data-id="([^"]+)" data-regle="([^"]+)"><span class="niveau [^"]+">[^<]+<\/span><span class="ou">([^<]+)<\/span>/g)].map((m) => [m[2], m[3]]);
    expect(points[0]).toEqual(["RELIRE", "s001"]);
    expect(points).toContainEqual(["H8", "diapo 3"]);
    expect(html).toContain("compléter le texte ou le retirer");
    const horsTheme = html.replace(/<style id="theme">[\s\S]*?<\/style>/, "").replace(/data:[^"')]+/g, "");
    expect(horsTheme.match(/#[0-9a-fA-F]{6}\b/g) ?? []).toEqual([]);
  });
});
