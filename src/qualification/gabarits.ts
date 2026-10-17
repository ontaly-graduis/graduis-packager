// La recomposition d'un schéma par un gabarit du wizard (PKG-B4) : quand le dessin relève d'une structure connue, on en
// lit la structure et la salle la compose au thème, mise en page calculée. Aujourd'hui : le `cas` du wizard — des
// colonnes en regard, chacune annoncée par son bandeau numéroté et faite d'étapes numérotées.
import type { Composition, Dessin, ElementDeDessin, FormeDeDessin, Role } from "../pivot/seance-spec";

type Boite = readonly [number, number, number, number];
const centre = (b: Boite): [number, number] => [b[0] + b[2] / 2, b[1] + b[3] / 2];
const texteDe = (e: ElementDeDessin) => (e.type === "forme" && e.texte
  ? e.texte.paragraphes.map((p) => p.fragments.map((f) => f.texte).join("")).join(" ").replace(/\s+/g, " ").trim() : "");
const estForme = (e: ElementDeDessin): e is FormeDeDessin => e.type === "forme";
const estTrait = (e: FormeDeDessin) => /connector|^line$/i.test(e.geometrie);

/** La manière d'une étape telle que la légende la nomme : son fond, et son bord (plein, en tirets, ou sans). */
function maniere(e: FormeDeDessin): { fond?: Role; bord: "plein" | "tirets" | "aucun" } {
  const bord = !e.trait ? "aucun" : e.trait.tirets ? "tirets" : "plein";
  return { ...(e.fond ? { fond: e.fond } : {}), bord };
}

/** La légende d'un schéma : des échantillons (formes muettes) et leur libellé à droite ; ou un libellé qui est lui-même son échantillon. */
function legende(decor: readonly FormeDeDessin[]): NonNullable<Extract<Composition, { gabarit: "cas" }>["legende"]> {
  // Chaque entrée : son échantillon `e` (l'ordre horizontal) et son libellé `l` (la ligne).
  const out: { e: FormeDeDessin; l: FormeDeDessin; texte: string; maniere: ReturnType<typeof maniere> }[] = [];
  const libelles = decor.filter((e) => texteDe(e) && !estTrait(e));
  const pris = new Set<FormeDeDessin>();
  for (const s of decor.filter((e) => !texteDe(e) && !estTrait(e) && (e.fond || e.trait) && e.boite[2] < 60 && e.boite[3] < 30)) {
    const [, cy] = centre(s.boite);
    const libelle = libelles
      .filter((l) => !pris.has(l) && l.boite[0] >= s.boite[0] + s.boite[2] - 2 && l.boite[0] - (s.boite[0] + s.boite[2]) <= 14 && Math.abs(centre(l.boite)[1] - cy) <= 10)
      .sort((a, b) => a.boite[0] - b.boite[0])[0];
    if (!libelle) continue;
    pris.add(libelle);
    out.push({ e: s, l: libelle, texte: texteDe(libelle), maniere: maniere(s) });
  }
  // Un libellé encadré, sans échantillon à côté, se montre lui-même (« Actions automatiques » en tirets).
  for (const l of libelles) if (!pris.has(l) && l.trait && l.boite[3] < 30) out.push({ e: l, l, texte: texteDe(l), maniere: maniere(l) });
  // Dans l'ordre de lecture : par ligne de libellés (à 10 points près), puis de gauche à droite.
  const dy = (a: (typeof out)[number], b: (typeof out)[number]) => {
    const d = centre(a.l.boite)[1] - centre(b.l.boite)[1];
    return Math.abs(d) <= 10 ? 0 : d;
  };
  // Un signe isolé (« + ») n'est pas une entrée de légende.
  return out.filter((x) => x.texte.length > 1)
    .sort((a, b) => dy(a, b) || a.e.boite[0] - b.e.boite[0]).map((x) => ({ texte: x.texte, ...x.maniere }));
}

/** Le `cas` d'un dessin partitionné en colonnes : chaque colonne a son bandeau numéroté et au moins deux étapes numérotées. */
export function composerCas(d: Dessin): Composition | null {
  if (d.partition?.mode !== "colonnes") return null;
  const formes = d.elements.filter(estForme);
  const cas: Extract<Composition, { gabarit: "cas" }>["cas"] = [];
  for (let pas = 1; pas <= d.partition.pas; pas++) {
    const dans = formes.filter((e) => e.pas === pas);
    const pastilleDeTete = dans.find((e) => e.ordre === 0 && e.marque === "pastille");
    const bandeau = dans.find((e) => e.ordre === 0 && e.marque !== "pastille" && texteDe(e));
    if (!pastilleDeTete || !bandeau) return null;
    const etapes = dans.filter((e) => e.marque === "pastille" && (e.ordre ?? 0) >= 1)
      .map((p) => ({ p, boite: dans.find((e) => e.ordre === p.ordre && e.marque !== "pastille" && texteDe(e)) }))
      .filter((x): x is { p: FormeDeDessin; boite: FormeDeDessin } => !!x.boite)
      .sort((a, b) => (a.p.ordre ?? 0) - (b.p.ordre ?? 0));
    if (etapes.length < 2) return null;
    // Les descriptions : des textes nus de la colonne, à la hauteur d'une étape.
    const prises = new Set<FormeDeDessin>([pastilleDeTete, bandeau, ...etapes.flatMap((x) => [x.p, x.boite])]);
    const descriptions = dans.filter((e) => !prises.has(e) && texteDe(e) && !e.fond && !e.trait);
    const detailDe = (b: FormeDeDessin) => {
      const [, cy] = centre(b.boite);
      const d = descriptions.filter((x) => !prises.has(x) && Math.abs(centre(x.boite)[1] - cy) <= b.boite[3])
        .sort((a, c) => Math.abs(centre(a.boite)[1] - cy) - Math.abs(centre(c.boite)[1] - cy))[0];
      if (d) prises.add(d);
      return d;
    };
    cas.push({
      numero: Number(texteDe(pastilleDeTete)),
      titre: texteDe(bandeau),
      ...(bandeau.fond ? { couleur: bandeau.fond } : {}),
      etapes: etapes.map(({ p, boite }) => {
        const detail = detailDe(boite);
        return { numero: Number(texteDe(p)) || p.ordre!, texte: texteDe(boite), ...(detail ? { detail: texteDe(detail) } : {}), ...maniere(boite) };
      }),
    });
  }
  const leg = legende(formes.filter((e) => !e.pas));
  return { gabarit: "cas", cas: cas.sort((a, b) => a.numero - b.numero), ...(leg.length ? { legende: leg } : {}) };
}
