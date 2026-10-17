// Témoins du défilement : pages d'un contenu statique, pile qui suit l'item courant.
import { describe, expect, it } from "vitest";
import { debutsDePages, decalageCourant, decalagePage } from "../src/salle/lecteur/defilement";

// Dix items de 100 px séparés de 20 px : 0–100, 120–220, … 1080–1180 ; fenêtre de 500 px.
const items = Array.from({ length: 10 }, (_, i) => ({ haut: i * 120, bas: i * 120 + 100 }));
const total = 1180;

describe("défilement", () => {
  it("découpe un contenu statique en pages d'items entiers", () => {
    expect(debutsDePages(items, 500)).toEqual([0, 480, 960]);
    expect(debutsDePages(items.slice(0, 4), 500)).toEqual([0]);
  });

  it("aligne la dernière page sur le bas du contenu", () => {
    const debuts = debutsDePages(items, 500);
    expect([0, 1, 2].map((p) => decalagePage(debuts, p, total, 500))).toEqual([0, 480, 680]);
  });

  it("garde l'item courant entier en montrant le plus de prédécesseurs possible", () => {
    expect(decalageCourant(items[2]!, total, 500)).toBe(0);
    expect(decalageCourant(items[5]!, total, 500)).toBe(200);
    expect(decalageCourant(items[9]!, total, 500)).toBe(680);
    expect(decalageCourant({ haut: 300, bas: 1000 }, 1400, 500)).toBe(300);
  });
});
