import { AVATAR_ANIMAL_IDS, AVATAR_GROUP_IDS } from "@tartan/contracts";
import { ANIMAL_IDS, ANIMAL_SHAPES } from "@tartan/mascot/animals";
import { describe, expect, it } from "vitest";
import { AVATAR_MIN_SIDE, AVATAR_SIDE, fileUri, planSquare } from "./avatar-photo";

describe("la photo de profil envoyée par le téléphone", () => {
  it("garde un carré déjà recadré tel quel, et le réduit à 512 pixels au-delà", () => {
    expect(planSquare(400, 400)).toEqual({ crop: null, resizeTo: null });
    expect(planSquare(AVATAR_SIDE, AVATAR_SIDE)).toEqual({ crop: null, resizeTo: null });
    expect(planSquare(3024, 3024)).toEqual({ crop: null, resizeTo: AVATAR_SIDE });
  });

  it("garde le carré central d'une image qui n'est pas carrée", () => {
    expect(planSquare(4032, 3024)).toEqual({
      crop: { startX: 504, startY: 0, endX: 3528, endY: 3024 },
      resizeTo: AVATAR_SIDE,
    });
    expect(planSquare(300, 301)).toEqual({ crop: { startX: 0, startY: 0, endX: 300, endY: 300 }, resizeTo: null });
  });

  it("refuse une image trop petite ou illisible, que le serveur refuserait", () => {
    expect(planSquare(AVATAR_MIN_SIDE - 1, 400)).toBeNull();
    expect(planSquare(0, 0)).toBeNull();
    expect(planSquare(Number.NaN, 200)).toBeNull();
    expect(planSquare(AVATAR_MIN_SIDE, AVATAR_MIN_SIDE)).toEqual({ crop: null, resizeTo: null });
  });

  it("donne un chemin de fichier lisible par l'envoi", () => {
    expect(fileUri("/tmp/a.jpg")).toBe("file:///tmp/a.jpg");
    expect(fileUri("file:///tmp/a.jpg")).toBe("file:///tmp/a.jpg");
  });
});

describe("les avatars dessinés", () => {
  it("l'app dessine chaque animal que le contrat accepte, avec les dessins du web", () => {
    expect([...ANIMAL_IDS].sort()).toEqual([...AVATAR_ANIMAL_IDS].sort());
    for (const id of AVATAR_ANIMAL_IDS) expect(ANIMAL_SHAPES[id].length).toBeGreaterThan(0);
    expect(AVATAR_GROUP_IDS).toHaveLength(6);
  });
});
