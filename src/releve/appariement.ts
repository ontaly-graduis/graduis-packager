// Le pas-à-pas d'une diapositive : repère sur capture ↔ zone ↔ pastille de légende ↔ consigne, apparié par numéro.
import type { Boite, Forme } from "../ooxml/formes";
import { POUCE, SEUILS, centre, dedans, distanceCentres, ecartBord, estCapture, estPastille, estTexte, estZone, texteDe } from "./geometrie";

/** Un pas de la procédure : la pastille posée sur la capture (repère), sa zone, sa pastille de légende et sa consigne. */
export interface Pas {
  readonly numero: number;
  /** Hash du média de la capture qui porte le pas. */
  readonly capture: string | null;
  readonly repere: Boite | null;
  readonly zone: Boite | null;
  readonly legende: Boite | null;
  readonly consigne: string | null;
}

export interface PasAPas {
  readonly pas: readonly Pas[];
}

const TOLERANCE = 0.15 * POUCE;

/** Le texte qu'une pastille commente : à sa droite et à sa hauteur d'abord, le plus proche sinon. */
function texteVoisin(p: Boite, textes: readonly Forme[]): Forme | undefined {
  const [, cy] = centre(p);
  let meilleur: Forme | undefined;
  let ecart = Infinity;
  for (const t of textes) {
    const [tx, ty, tw, th] = t.boite;
    const aDroite = tx + tw > p[0] + p[2] && tx >= p[0] - TOLERANCE;
    const aHauteur = ty - TOLERANCE <= cy && cy <= ty + th + TOLERANCE;
    if (!aDroite || !aHauteur) continue;
    const g = Math.max(0, tx - (p[0] + p[2]));
    if (g < ecart) [meilleur, ecart] = [t, g];
  }
  if (meilleur) return meilleur;
  let d = SEUILS.consigneDist;
  for (const t of textes) {
    const dt = distanceCentres(p, t.boite);
    if (dt < d) [meilleur, d] = [t, dt];
  }
  return meilleur;
}

/** Les consignes de plusieurs pastilles qui commentent un même texte : un paragraphe chacune, par rang vertical. */
function consignes(pastilles: readonly Boite[], textes: readonly Forme[]): (string | null)[] {
  const voisins = pastilles.map((p) => texteVoisin(p, textes));
  const out: (string | null)[] = voisins.map((t) => (t ? texteDe(t) : null));
  const parTexte = new Map<Forme, number[]>();
  voisins.forEach((t, i) => t && parTexte.set(t, [...(parTexte.get(t) ?? []), i]));
  for (const [t, indices] of parTexte) {
    if (indices.length < 2) continue;
    const tries = [...indices].sort((a, b) => centre(pastilles[a]!)[1] - centre(pastilles[b]!)[1]);
    const paras = (t.texte ?? []).map((s) => s.trim());
    const pleins = paras.filter(Boolean);
    const blocs = paras.join("\n").split(/\n\s*\n/).map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean).join(" ")).filter(Boolean);
    if (blocs.length === tries.length) tries.forEach((i, rang) => (out[i] = blocs[rang] ?? null));
    else if (pleins.length === tries.length) tries.forEach((i, rang) => (out[i] = pleins[rang] ?? null));
    else if (pleins.length > 1) {
      for (const i of tries) {
        const k = Math.floor(((centre(pastilles[i]!)[1] - t.boite[1]) / t.boite[3]) * pleins.length);
        out[i] = pleins[Math.min(pleins.length - 1, Math.max(0, k))] ?? null;
      }
    }
  }
  return out;
}

function lecture(a: Boite, b: Boite): number {
  return a[1] - b[1] || a[0] - b[0];
}

/**
 * Apparie le pas-à-pas d'une diapositive ; `undefined` si elle n'a ni capture ni pastille.
 * Par numéro : la pastille posée sur une capture est le repère, les autres sont des légendes. Un numéro sans
 * pastille sur la capture prend pour repère, s'il en a plusieurs, celle qui touche une zone de la capture.
 */
export function apparier(formes: readonly Forme[], largeurDiapo: number, hashMedia: (f: Forme) => string | null): PasAPas | undefined {
  const captures = formes.filter((f) => estCapture(f, largeurDiapo));
  const pastilles = formes.filter(estPastille);
  if (!captures.length || !pastilles.length) return undefined;
  const zones = formes.filter(estZone).map((f) => f.boite);
  const zonesSurCapture = zones.filter((z) => captures.some((c) => dedans(z, c.boite)));
  const textes = formes.filter((f) => estTexte(f) && !estPastille(f));
  const ecartZone = (b: Boite) => Math.min(Infinity, ...zonesSurCapture.map((z) => ecartBord(b, z)));
  const zoneProche = (b: Boite | null): Boite | null => {
    if (!b) return null;
    let zone: Boite | null = null;
    let gap: number = SEUILS.zoneGap;
    for (const z of zones) {
      const g = ecartBord(b, z);
      if (g < gap) [zone, gap] = [z, g];
    }
    return zone;
  };
  const captureDe = (b: Boite) => captures.find((c) => dedans(b, c.boite))
    ?? captures.reduce((a, c) => (ecartBord(b, c.boite) < ecartBord(b, a.boite) ? c : a));

  const parNumero = new Map<number, Forme[]>();
  for (const p of [...pastilles].sort((a, b) => lecture(a.boite, b.boite))) {
    const n = Number.parseInt(texteDe(p), 10);
    parNumero.set(n, [...(parNumero.get(n) ?? []), p]);
  }
  const brut: { numero: number; repere: Boite | null; legende: Boite | null }[] = [];
  for (const [numero, groupe] of [...parNumero].sort((a, b) => a[0] - b[0])) {
    let reperes = groupe.filter((p) => captures.some((c) => dedans(p.boite, c.boite)));
    let legendes = groupe.filter((p) => !reperes.includes(p));
    if (!reperes.length && legendes.length >= 2) {
      const proche = legendes.reduce((a, p) => (ecartZone(p.boite) < ecartZone(a.boite) ? p : a));
      if (ecartZone(proche.boite) < SEUILS.zoneGap) [reperes, legendes] = [[proche], legendes.filter((p) => p !== proche)];
    }
    const n = Math.max(reperes.length, legendes.length);
    for (let i = 0; i < n; i++) brut.push({ numero, repere: reperes[i]?.boite ?? null, legende: legendes[i]?.boite ?? null });
  }

  const avecLegende = brut.filter((b) => b.legende);
  const deLegende = consignes(avecLegende.map((b) => b.legende!), textes);
  const sansLegende = brut.filter((b) => !b.legende);
  const deRepere = consignes(sansLegende.map((b) => b.repere!), textes);
  const pas: Pas[] = brut.map((b) => {
    const ancre = b.repere ?? b.legende!;
    return {
      numero: b.numero,
      capture: hashMedia(captureDe(ancre)),
      repere: b.repere,
      zone: zoneProche(b.repere) ?? (b.repere ? null : zoneProche(b.legende)),
      legende: b.legende,
      consigne: b.legende ? deLegende[avecLegende.indexOf(b)] ?? null : deRepere[sansLegende.indexOf(b)] ?? null,
    };
  });
  return { pas };
}
