// Le relevé d'un schéma → son dessin au pivot : formes, textes, images et tableaux en points, couleurs projetées sur les rôles du thème.
import type { Boite } from "../ooxml/formes";
import type { Corps as CorpsLu, Fond, Trait } from "../ooxml/styles";
import { FLECHES, TIRETS, type Corps, type Dessin, type ElementDeDessin, type Role, type TraitDeDessin } from "../pivot/seance-spec";
import type { DiapositiveReleve, FormeReleve } from "../releve/releve";
import { dedans } from "../releve/geometrie";
import type { Couleur } from "../ooxml/couleurs";
import { cleDeCouleur, projeter, roleDe, roleDeTexte, type Projection } from "./roles";
import { numeroDePastille, partitionner } from "./partition";

const EMU_PAR_POINT = 12700;
const pt = (emu: number) => Math.round((emu / EMU_PAR_POINT) * 100) / 100;
const boitePt = (b: Boite): [number, number, number, number] => [pt(b[0]), pt(b[1]), pt(b[2]), pt(b[3])];

const ANCRAGES: Readonly<Record<string, Corps["ancrage"]>> = { t: "haut", ctr: "milieu", b: "bas" };
const ALIGNEMENTS: Readonly<Record<string, Corps["paragraphes"][number]["alignement"]>> = { l: "gauche", ctr: "centre", r: "droite", just: "justifie", dist: "justifie" };

/** Le rôle d'une couleur d'origine selon la projection du schéma (rôle naturel à défaut). */
type VersRole = (c: Couleur) => Role;

function traitEnDessin(t: Trait | null | undefined, role: VersRole): TraitDeDessin | undefined {
  if (!t || t.couleur === "aucun") return undefined;
  const tirets = TIRETS.find((x) => x === t.tirets);
  const debut = FLECHES.find((x) => x === t.debut);
  const fin = FLECHES.find((x) => x === t.fin);
  return {
    couleur: role(t.couleur),
    largeur: pt(t.largeur),
    ...(tirets ? { tirets } : {}),
    ...(debut ? { debut } : {}),
    ...(fin ? { fin } : {}),
  };
}

const aDuTexte = (c: CorpsLu | undefined) => !!c?.paragraphes.some((p) => p.fragments.some((f) => f.texte.trim()));

/** La police qui porte le plus de caractères. */
function policeDominante(c: CorpsLu): string | undefined {
  const poids = new Map<string, number>();
  for (const p of c.paragraphes) for (const f of p.fragments) poids.set(f.police, (poids.get(f.police) ?? 0) + f.texte.trim().length);
  return [...poids].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

type FragmentDeDessin = Corps["paragraphes"][number]["fragments"][number];
const memeStyle = (a: FragmentDeDessin, b: FragmentDeDessin) =>
  a.taille === b.taille && a.gras === b.gras && a.italique === b.italique && a.souligne === b.souligne && a.couleur === b.couleur;

/**
 * Des fragments sous leur forme normale : sans fragment vide (sauf le seul d'un paragraphe vide), deux voisins au même
 * style réunis (la police d'origine n'en est plus un trait) — la forme que le PPT de validation relit (PKG-C3).
 */
export function normaliserFragments(fs: readonly FragmentDeDessin[]): FragmentDeDessin[] {
  const pleins = fs.filter((f) => f.texte !== "");
  if (!pleins.length) return fs.slice(0, 1);
  const out: FragmentDeDessin[] = [];
  for (const f of pleins) {
    const prec = out[out.length - 1];
    if (prec && memeStyle(prec, f)) out[out.length - 1] = { ...prec, texte: prec.texte + f.texte };
    else out.push(f);
  }
  return out;
}

function corpsEnDessin(c: CorpsLu, fond: Role | undefined, role: VersRole): Corps {
  const echelle = c.echelle / 100000;
  const police = policeDominante(c);
  return {
    ...(police ? { police } : {}),
    ancrage: ANCRAGES[c.ancrage] ?? "haut",
    marges: [pt(c.marges[0]), pt(c.marges[1]), pt(c.marges[2]), pt(c.marges[3])],
    ...(c.retour ? {} : { retour: false as const }),
    paragraphes: c.paragraphes.map((p) => ({
      alignement: ALIGNEMENTS[p.alignement] ?? "gauche",
      fragments: normaliserFragments(p.fragments.map((f) => ({
        texte: f.texte,
        taille: Math.round(f.taille * echelle) / 100,
        ...(f.gras ? { gras: true as const } : {}),
        ...(f.italique ? { italique: true as const } : {}),
        ...(f.souligne ? { souligne: true as const } : {}),
        couleur: roleDeTexte(role(f.couleur), fond),
      }))),
    })),
  };
}

/** Les couleurs d'origine d'un ensemble de formes : fonds, traits, textes (une occurrence par emploi). */
export function couleursDe(formes: readonly FormeReleve[]): Couleur[] {
  const out: Couleur[] = [];
  const noter = (k: Fond | undefined) => { if (k && k !== "aucun") out.push(k); };
  const corps = (c: CorpsLu | undefined) => {
    for (const p of c?.paragraphes ?? []) for (const fr of p.fragments) if (fr.texte.trim()) out.push(fr.couleur);
  };
  for (const f of formes) {
    const st = f.style;
    if (!st) continue;
    noter(st.fond);
    noter(st.trait?.couleur);
    corps(st.corps);
    for (const l of st.grille?.cellules ?? []) for (const c of l) {
      noter(c.fond);
      for (const b of c.bords) noter(b?.couleur);
      corps(c.corps);
    }
  }
  return out;
}

/** Le dessin d'une diapositive schéma, sans les formes écartées (titre, espaces de service), dans l'ordre d'empilement. */
export function dessinDe(d: DiapositiveReleve, ecartees: ReadonlySet<FormeReleve>): { dessin: Dessin; projection: Projection } {
  const retenues = d.formes.filter((f) => !ecartees.has(f));
  const projection = projeter(couleursDe(retenues));
  const role: VersRole = (c) => projection.roles.get(cleDeCouleur(c)) ?? roleDe(c);
  const fondEnRole = (f: Fond | undefined): Role | undefined => (f && f !== "aucun" ? role(f) : undefined);
  const elements: ElementDeDessin[] = [];
  const fonds: { boite: Boite; role: Role }[] = [];
  for (const f of retenues) {
    if (!f.style) continue;
    const s = f.style;
    const boite = boitePt(f.boite);
    if (f.nature === "image") {
      if (!f.media) continue;
      elements.push({
        type: "image", boite, media: f.media,
        ...(f.rognage ? { rognage: [...f.rognage] as [number, number, number, number] } : {}),
        ...(f.geometrie && f.geometrie !== "rect" ? { geometrie: f.geometrie } : {}),
      });
      continue;
    }
    if (f.nature === "tableau") {
      const g = s.grille;
      if (!g) continue;
      elements.push({
        type: "tableau", boite,
        colonnes: g.colonnes.map(pt), hauteurs: g.hauteurs.map(pt),
        cellules: g.cellules.map((l) => l.map((c) => {
          const fond = fondEnRole(c.fond);
          const [h, dr, b, ga] = c.bords.map((t) => traitEnDessin(t, role));
          return { ...(fond ? { fond } : {}), bords: [h ?? null, dr ?? null, b ?? null, ga ?? null], texte: corpsEnDessin(c.corps, fond, role) };
        })),
      });
      continue;
    }
    if (f.nature === "graphique") continue;
    const fond = fondEnRole(s.fond);
    const trait = traitEnDessin(s.trait, role);
    const texte = aDuTexte(s.corps) ? s.corps : undefined;
    if (!fond && !trait && !texte) continue;
    // Un texte sans fond se lit sur la dernière forme pleine qui le porte.
    const dessous = fond ?? [...fonds].reverse().find((x) => dedans(f.boite, x.boite))?.role;
    const chemins = s.chemins?.map((c) => ({
      largeur: c.largeur, hauteur: c.hauteur, d: c.d,
      ...(c.remplir ? {} : { remplir: false as const }),
      ...(c.tracer ? {} : { tracer: false as const }),
    }));
    elements.push({
      type: "forme", boite,
      geometrie: chemins?.length ? "libre" : f.geometrie ?? "rect",
      ...(s.ajustements ? { ajustements: { ...s.ajustements } } : {}),
      ...(chemins?.length ? { chemins } : {}),
      ...(s.rotation ? { rotation: Math.round(s.rotation / 600) / 100 } : {}),
      ...(s.retournement ? { retournement: s.retournement } : {}),
      ...(fond ? { fond } : {}),
      ...(trait ? { trait } : {}),
      ...(texte ? { texte: corpsEnDessin(texte, dessous, role) } : {}),
    });
    if (fond) fonds.push({ boite: f.boite, role: fond });
  }
  const xs = elements.map((e) => e.boite);
  const x0 = Math.min(...xs.map((b) => b[0]));
  const y0 = Math.min(...xs.map((b) => b[1]));
  const x1 = Math.max(...xs.map((b) => b[0] + b[2]));
  const y1 = Math.max(...xs.map((b) => b[1] + b[3]));
  const r = (v: number) => Math.round(v * 100) / 100;
  const marques = elements.map((e) => (numeroDePastille(e) !== null && e.type === "forme" ? { ...e, marque: "pastille" as const } : e));
  const dessin: Dessin = { cadre: elements.length ? [r(x0), r(y0), r(x1 - x0), r(y1 - y0)] : [0, 0, 0, 0], elements: marques };
  return { dessin: partitionner(dessin), projection };
}
