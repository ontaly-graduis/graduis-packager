// La recette du papier (filiation : la route papier du wizard) : la couche texte du PDF, lue par pdf.js dans le seul
// contenu balisé (en-têtes et pieds, des artefacts, écartés : un texte coupé par un saut de page se recoud), doit porter
// chaque ligne attendue. Normalisation : NFKC, minuscules, lettres et chiffres seuls (espaces, césures, ligatures, casse
// imposée par la feuille neutralisés). Le compte des lignes cherchées est un témoin : 0 trouvée sur 0 n'est pas un vert.

export const normaliser = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

interface ElementDeTexte { readonly str?: string; readonly type?: string; readonly tag?: string }
interface PagePdf { getTextContent(o: { includeMarkedContent: boolean }): Promise<{ items: ElementDeTexte[] }> }
interface DocumentPdf {
  readonly numPages: number;
  getPage(n: number): Promise<PagePdf>;
  getDestinations(): Promise<Record<string, unknown[] | null>>;
  getPageIndex(ref: unknown): Promise<number>;
  destroy(): Promise<void>;
}

export interface PdfLu {
  /** Le texte balisé de chaque page. */
  readonly pages: readonly string[];
  /** Les destinations nommées (les ancres du document) et leur page, comptée de 1. */
  readonly destinations: Readonly<Record<string, number>>;
}

export async function lirePdf(octets: Uint8Array): Promise<PdfLu> {
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as {
    getDocument(src: { data: Uint8Array; verbosity?: number; isEvalSupported?: boolean }): { promise: Promise<DocumentPdf> };
  };
  // pdf.js prend possession du tampon : on lui en donne une copie.
  const doc = await pdfjs.getDocument({ data: new Uint8Array(octets), verbosity: 0, isEvalSupported: false }).promise;
  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const { items } = await (await doc.getPage(n)).getTextContent({ includeMarkedContent: true });
      const balise = items.some((i) => i.type === "beginMarkedContentProps" || i.type === "beginMarkedContent");
      const pile: string[] = [];
      let texte = "";
      for (const i of items) {
        if (i.type === "beginMarkedContent" || i.type === "beginMarkedContentProps") pile.push(i.tag ?? "");
        else if (i.type === "endMarkedContent") pile.pop();
        else if (i.str !== undefined && (!balise || (pile.length > 0 && !pile.includes("Artifact")))) texte += i.str;
      }
      pages.push(texte);
    }
    const destinations: Record<string, number> = {};
    for (const [nom, dest] of Object.entries(await doc.getDestinations())) {
      if (dest?.[0] !== undefined) destinations[nom] = (await doc.getPageIndex(dest[0])) + 1;
    }
    return { pages, destinations };
  } finally {
    await doc.destroy();
  }
}

export interface Recette {
  readonly cherches: number;
  readonly trouves: number;
  readonly manquants: readonly string[];
}

/** Chaque ligne attendue se retrouve-t-elle dans le texte du PDF (pages mises bout à bout) ? */
export function recetter(attendus: readonly string[], pages: readonly string[]): Recette {
  const texte = normaliser(pages.join(""));
  const manquants: string[] = [];
  let cherches = 0;
  for (const a of attendus) {
    const n = normaliser(a);
    if (!n) continue;
    cherches += 1;
    if (!texte.includes(n)) manquants.push(a);
  }
  return { cherches, trouves: cherches - manquants.length, manquants };
}
