// Le papier dans Chromium : la page imprimable du participant, composée des mêmes données et du même rendu que la salle, à
// l'état final — page de garde, sommaire paginé, intercalaires, blocs, pages « Mes notes », annexes. La page se dit prête
// (`html[data-papier]`) une fois polices et images chargées, schémas ajustés ; `__papier.paginer` pose les numéros de page.
import type { BlocDeSalle } from "../../salle/donnees";
import type { DonneesDePapier, SequenceDePapier } from "../donnees";
import { capture, cas, composerTableau, el, liste, schema, structure, tableau, type Contexte } from "../../salle/lecteur/rendu";
import { relier } from "../../salle/lecteur/liens";
import { ajusterTextes } from "../../salle/lecteur/textes";
import { CONSIGNES_DE_PAPIER } from "../../activites/habillage";
import { LIBELLES_DE_GESTE } from "../../pivot/libelles";

/** Le nom du thème (le texte de remplacement du logo), injecté à la construction du lecteur. */
declare const NOM_DU_THEME: string;

const lire = <T>(id: string): T => JSON.parse(document.getElementById(id)?.textContent ?? "null") as T;
const d = lire<DonneesDePapier>("donnees");
const medias = lire<Record<string, string>>("medias");
const ctx: Contexte = { doc: document, medias, zoom: false, anime: "aucun" };

/** La largeur utile d'une page A4 aux marges du papier (178 mm), en pixels CSS. */
const LARGEUR = 672;
const HAUTEUR_CAPTURE = 560;

/** L'en-tête courant d'une séquence : « Séquence 3 · Titre », ou son seul titre (l'ouverture n'a pas de numéro). */
const enTete = (s: Pick<SequenceDePapier, "numero" | "titre">) => (s.numero !== null ? `Séquence ${s.numero} · ${s.titre}` : s.titre);
const page = (id: string) => `p-${id}`;
const chaine = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s+/g, " ")}"`;
const court = (s: string, n = 72) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Les règles de page : un pied commun, une page nommée par séquence (son en-tête courant), la garde sans marges. */
function pages(): string {
  const pied = `@bottom-left{content:${chaine(`${d.titre} · Support participant`)}}@bottom-right{content:"Page " counter(page) " / " counter(pages)}`;
  return [
    `@page{size:A4;margin:16mm 16mm 18mm;@top-left{content:${chaine(d.titre)}}${pied}}`,
    "@page garde{margin:0;@top-left{content:none}@bottom-left{content:none}@bottom-right{content:none}}",
    ...d.sequences.map((s) => `@page ${page(s.id)}{@top-left{content:${chaine(court(enTete(s)))}}}`),
  ].join("\n");
}

function garde(): HTMLElement {
  const g = el(document, "section", "garde");
  const c = d.couverture;
  const haut = el(document, "div", "garde-haut");
  // Le logo dans une boîte : une image en tête de la garde lui ferait perdre sa page nommée (Chromium).
  const logo = el(document, "div", "garde-logo");
  logo.append(el(document, "img", "logo", undefined, { src: medias.logo ?? "", alt: NOM_DU_THEME }));
  haut.append(logo);
  haut.append(el(document, "div", "etiquette", "Support participant"));
  // Le titre, puis les autres lignes de la couverture (sa première ligne quand elle n'a pas de titre).
  const [, ...sousTitres] = [c?.titre ?? "", ...(c?.lignes ?? [])].filter(Boolean);
  haut.append(el(document, "h1", "", d.titre));
  if (sousTitres.length) haut.append(liste(ctx, sousTitres, 0, false, "sous-titres"));
  if (d.extrait) haut.append(el(document, "p", "extrait", d.extrait));
  g.append(haut);
  const photo = c?.visuels.find((v) => !v.role && medias[v.media]);
  if (photo) {
    const p = el(document, "div", "garde-photo");
    p.append(el(document, "img", "", undefined, { src: medias[photo.media] ?? "", alt: "" }));
    g.append(p);
  }
  return g;
}

function sommaire(): HTMLElement {
  const s = el(document, "section", "sommaire");
  s.append(el(document, "h2", "", "Sommaire", { "data-signet": "" }));
  const ol = el(document, "ol", "");
  const entree = (cible: string, numero: string, titre: string) => {
    const a = el(document, "a", "renvoi", undefined, { href: `#${cible}` });
    a.append(el(document, "span", "num", numero), el(document, "span", "titre", titre), el(document, "span", "p", "000", { "data-cible": cible }));
    const li = el(document, "li");
    li.append(a);
    ol.append(li);
  };
  for (const q of d.sequences) entree(q.id, q.numero !== null ? String(q.numero) : "", q.titre);
  for (const b of d.annexes) entree(b.id, "", b.titre ?? (b.figure === "glossaire" ? "Glossaire" : "Synthèse"));
  s.append(ol);
  return s;
}

/** L'intercalaire d'une séquence ouverte par une transition : une page, son numéro, son titre, son sommaire. */
function intercalaire(q: SequenceDePapier, t: BlocDeSalle): HTMLElement {
  const i = el(document, "header", "intercalaire");
  i.append(el(document, "div", "etiquette", q.numero !== null ? `Séquence ${q.numero}` : ""), el(document, "h2", "", t.titre ?? q.titre, { "data-signet": "" }), el(document, "div", "filet"));
  if (t.lignes.length) i.append(liste(ctx, t.lignes, 0, false, "sommaire-sequence"));
  return i;
}

/** Une capture du papier, toutes ses zones numérotées (l'état final d'un pas-à-pas). */
function capturePapier(b: BlocDeSalle, media: string): HTMLElement | null {
  const v = b.visuels.find((x) => x.media === media);
  if (!v) return null;
  const c = capture(ctx, v, LARGEUR, HAUTEUR_CAPTURE);
  for (const z of b.regionMap?.captures[media] ?? []) {
    const [x, y, w, h] = z.rect;
    const zone = el(document, "div", "zone toutes");
    Object.assign(zone.style, { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });
    zone.append(el(document, "span", "num", z.step.slice(1)));
    c.plan.append(zone);
  }
  return c.boite;
}

function consignes(b: BlocDeSalle): HTMLElement | null {
  const pas = b.regionMap?.pas ?? [];
  if (!pas.length) return null;
  const ol = el(document, "ol", "consignes-papier");
  for (const p of pas) {
    const li = el(document, "li");
    li.append(el(document, "span", "num", p.id.slice(1)), el(document, "span", "", p.libelle || "—"));
    ol.append(li);
  }
  return ol;
}

const libres = (b: BlocDeSalle) => {
  const illustrations = new Set(b.structure?.rangees.flatMap((r) => r.colonnes.flatMap((c) => (c.visuel ? [c.visuel] : []))) ?? []);
  return b.visuels.filter((v) => !v.role && !illustrations.has(v.media));
};

function texte(b: BlocDeSalle, classe = "liste"): HTMLElement {
  return b.structure ? structure(ctx, b.structure, 0, false) : liste(ctx, b.lignes, 0, false, classe);
}

/** Un encadré, son étiquette (tue quand le titre du bloc la dit déjà). */
function encadre(classe: string, etiquette: string | null, ...contenu: (HTMLElement | null)[]): HTMLElement {
  const e = el(document, "div", `encadre ${classe}`);
  if (etiquette) e.append(el(document, "div", "etiquette", etiquette));
  e.append(...contenu.filter((x): x is HTMLElement => x !== null));
  return e;
}

/** Un bloc sur papier, figure par figure (spec § 4.2, colonne « Papier »). */
function bloc(b: BlocDeSalle): HTMLElement {
  const a = el(document, "article", `bloc f-${b.figure}`, undefined, { id: b.id });
  if (b.titre && b.figure !== "renvoi") a.append(el(document, "h3", "titre-bloc", b.titre));
  switch (b.figure) {
    case "objectifs":
      a.append(encadre("objectifs", b.titre ? null : "Objectifs", texte(b)));
      break;
    case "pas-a-pas":
      // Le texte d'un pas-à-pas (ce que montre l'écran, une précaution) : la salle le tait, le papier le porte (P4).
      if (b.lignes.length) a.append(liste(ctx, b.lignes, 0, false, "liste commentaire"));
      for (const v of b.visuels.filter((x) => x.capture)) { const c = capturePapier(b, v.media); if (c) a.append(c); }
      { const c = consignes(b); if (c) a.append(c); }
      break;
    case "capture":
      for (const v of libres(b)) a.append(capture(ctx, v, LARGEUR, HAUTEUR_CAPTURE).boite);
      if (b.lignes.length) a.append(liste(ctx, b.lignes, 0, false, "liste legende"));
      break;
    case "schema": {
      const compo = el(document, "div", "schema-papier");
      if (b.composition?.gabarit === "cas") compo.append(cas(ctx, b.composition, 0, false));
      else if (b.composition?.gabarit === "tableau") compo.append(composerTableau(ctx, b.composition, 0, false, b.id));
      else if (b.dessin) {
        const s = schema(ctx, b, 0);
        const [, , w, h] = b.dessin.cadre;
        if (w > 0 && h > 0) s.style.aspectRatio = `${w} / ${h}`;
        compo.append(s);
      }
      a.append(compo);
      break;
    }
    case "processus":
      for (const t of b.tableaux) a.append(tableau(ctx, t));
      if (b.lignes.length) a.append(liste(ctx, b.lignes, 0, false, "liste legende"));
      break;
    case "demonstration": {
      // Comme en salle : ce qui va être montré, d'un tenant (le mot « Démonstration » est l'étiquette).
      const ce = b.lignes.filter((l) => !/^\s*démonstration\s*$/i.test(l)).join(" ");
      a.append(encadre("demonstration", "Démonstration dans l'outil", ce ? el(document, "p", "ce-qui-est-montre", ce) : null));
      break;
    }
    case "mise-en-pratique":
      a.append(encadre("pratique", "À vous de jouer", liste(ctx, b.lignes, 0, false),
        b.aide ? el(document, "p", "aide", "Vous pouvez vous aider du pas-à-pas.") : null,
        b.duree ? el(document, "p", "duree", `${b.duree} minutes`) : null));
      break;
    case "etapes-cles":
      a.append(encadre("recap", b.titre ? null : "Les étapes clés", texte(b, "liste numerotee")));
      break;
    case "renvoi":
      a.append(encadre("renvoi", "Support associé", ...(b.titre ? [el(document, "p", "titre-renvoi", b.titre)] : []), liste(ctx, b.lignes, 0, false)));
      break;
    case "glossaire":
      a.append(texte(b, "liste glossaire"));
      break;
    case "activite":
      a.append(fiche(b));
      break;
    default: {
      a.append(texte(b));
      for (const t of b.tableaux) a.append(tableau(ctx, t));
      for (const v of libres(b)) a.append(capture(ctx, v, LARGEUR, v.capture ? HAUTEUR_CAPTURE : 300).boite);
    }
  }
  return a;
}

/** Une case à cocher ou à numéroter, à remplir au stylo. */
const caseVide = () => el(document, "span", "case-fiche");

/**
 * Le repli papier d'une activité (spec v1 § 5.2) : sa consigne, d'où elle dérive, et de quoi répondre — une zone d'écriture
 * (Rappel), une liste à numéroter (Classement), un tableau à cocher (Catégorisation), la capture où entourer chaque zone
 * (Sélection sur image). Les éléments gardent les numéros de la salle ; le corrigé se donne au tableau, pas sur la fiche.
 */
function fiche(b: BlocDeSalle): HTMLElement {
  const act = b.activite!;
  const c = act.contenu;
  const reponse = el(document, "div", `reponse-fiche r-${c.geste}`);
  switch (c.geste) {
    case "rappel": {
      const lignes = el(document, "div", "lignes-fiche");
      lignes.style.setProperty("--n", String(Math.max(5, c.items.length + 1)));
      reponse.append(lignes);
      break;
    }
    case "classement": {
      const ol = el(document, "ol", "a-numeroter");
      c.presentation.forEach((i, k) => {
        const li = el(document, "li");
        li.append(el(document, "span", "num", String(k + 1)), el(document, "span", "", c.items[i]!), caseVide());
        ol.append(li);
      });
      reponse.append(ol);
      break;
    }
    case "categorisation": {
      const t = el(document, "table", "a-cocher");
      const tete = el(document, "tr");
      tete.append(el(document, "th", "", c.intitule), ...c.categories.map((k) => el(document, "th", "", k)));
      t.append(tete);
      c.presentation.forEach((i, k) => {
        const tr = el(document, "tr");
        const libelle = el(document, "td");
        libelle.append(el(document, "span", "num", String(k + 1)), el(document, "span", "", c.cartes[i]!.texte));
        tr.append(libelle, ...c.categories.map(() => { const td = el(document, "td", "coche"); td.append(caseVide()); return td; }));
        t.append(tr);
      });
      reponse.append(t);
      break;
    }
    case "selection-sur-image":
      for (const v of b.visuels) reponse.append(capture(ctx, v, LARGEUR, HAUTEUR_CAPTURE).boite);
      { const k = consignes(b); if (k) reponse.append(k); }
      break;
  }
  return encadre("activite", `Activité · ${LIBELLES_DE_GESTE[act.geste]}`,
    el(document, "p", "consigne-fiche", CONSIGNES_DE_PAPIER[act.geste]), el(document, "p", "source-fiche", act.source), reponse,
    b.duree ? el(document, "p", "duree", `${b.duree} minutes`) : null);
}

function notes(q: SequenceDePapier): HTMLElement {
  const n = el(document, "section", "notes-papier");
  n.style.setProperty("page", page(q.id));
  n.append(el(document, "h3", "", "Mes notes"), el(document, "div", "lignes"));
  return n;
}

function composer(): void {
  const style = el(document, "style", "", pages(), { id: "pages" });
  document.head.append(style);
  const feuille = document.getElementById("feuille")!;
  feuille.append(garde(), sommaire());
  for (const q of d.sequences) {
    const s = el(document, "section", "sequence", undefined, { id: q.id });
    s.style.setProperty("page", page(q.id));
    if (q.intercalaire) s.append(intercalaire(q, q.intercalaire));
    else s.append(el(document, "h2", "titre-sequence", q.titre, { "data-signet": "" }));
    s.append(...q.blocs.map(bloc));
    feuille.append(s);
    if (q.blocs.length) feuille.append(notes(q));
  }
  if (d.annexes.length) {
    const a = el(document, "section", "annexes");
    a.append(el(document, "h2", "", "Annexes", { "data-signet": "" }));
    for (const b of d.annexes) a.append(bloc(b));
    feuille.append(a);
  }
}

/** La résolution d'impression visée : une image plus fine que nécessaire est réduite (le poids du PDF), jamais agrandie. */
const PPP_CIBLE = 200;

/**
 * Allège chaque image matricielle (filiation : le papier du wizard) : réduite à 200 ppp de sa taille imprimée, jamais
 * agrandie ; une image opaque (une capture, une photo) passe en JPEG, que Chromium embarque tel quel — une capture en PNG
 * s'y décompresse et pèse trois fois plus ; une image à transparence reste en PNG.
 */
async function reduire(): Promise<void> {
  for (const img of Array.from(document.querySelectorAll<HTMLImageElement>("#feuille img"))) {
    if (!img.naturalWidth || img.src.startsWith("data:image/svg")) continue;
    const cible = Math.min(img.naturalWidth, Math.round((img.getBoundingClientRect().width * PPP_CIBLE) / 96));
    if (!cible) continue;
    const plus = img.naturalWidth > cible * 1.1;
    const c = document.createElement("canvas");
    c.width = plus ? cible : img.naturalWidth;
    c.height = Math.max(1, Math.round((img.naturalHeight * c.width) / img.naturalWidth));
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) continue;
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, c.width, c.height);
    const pixels = g.getImageData(0, 0, c.width, c.height).data;
    let opaque = true;
    for (let i = 3; i < pixels.length && opaque; i += 4) opaque = pixels[i] === 255;
    if (!plus && (!opaque || img.src.startsWith("data:image/jpeg"))) continue;
    img.src = opaque ? c.toDataURL("image/jpeg", 0.85) : c.toDataURL("image/png");
    await img.decode().catch(() => undefined);
  }
}

/** Les numéros de page, lus dans le PDF de la première passe, posés au sommaire. */
function paginer(numeros: Readonly<Record<string, number>>): void {
  document.querySelectorAll<HTMLElement>(".sommaire .p[data-cible]").forEach((p) => {
    const n = numeros[p.dataset["cible"] ?? ""];
    p.textContent = n !== undefined ? String(n) : "—";
  });
}

async function pret(): Promise<void> {
  try {
    composer();
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((i) => i.decode().catch(() => undefined)));
    await reduire();
    ajusterTextes(document.body);
    document.querySelectorAll<HTMLElement>(".tab-grille").forEach(relier);
    document.documentElement.dataset["papier"] = "pret";
  } catch (e) {
    document.documentElement.dataset["papier"] = "refus";
    document.documentElement.dataset["erreur"] = String(e);
  }
}

(window as unknown as { __papier: unknown }).__papier = { paginer };
void pret();
