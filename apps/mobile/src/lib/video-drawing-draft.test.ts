import { videoDrawing } from "@tartan/contracts";
import { describe, expect, it } from "vitest";
import {
  addPoint,
  drawingFrom,
  FALLBACK_ASPECT,
  isComplete,
  pointOnImage,
  pointsLeft,
  videoAspect,
  videoFrame,
} from "./video-drawing-draft";

describe("cadrage de l'image dans la scène", () => {
  it("place une vidéo portrait au centre d'une scène large, entre deux bandes", () => {
    expect(videoFrame({ width: 800, height: 400 }, 9 / 16)).toEqual({ x: 287.5, y: 0, width: 225, height: 400 });
  });

  it("place une vidéo paysage au centre d'une scène haute", () => {
    expect(videoFrame({ width: 390, height: 600 }, 16 / 9)).toEqual({
      x: 0,
      y: (600 - 390 / (16 / 9)) / 2,
      width: 390,
      height: 390 / (16 / 9),
    });
  });

  it("ne cadre rien tant que la scène n'a pas de taille", () => {
    expect(videoFrame({ width: 0, height: 300 }, 1)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(pointOnImage({ x: 10, y: 10 }, videoFrame({ width: 0, height: 0 }, 1))).toBeNull();
  });
});

describe("tracé au doigt", () => {
  const frame = videoFrame({ width: 800, height: 400 }, 9 / 16);

  it("donne le point relatif à l'image, pas à la scène", () => {
    expect(pointOnImage({ x: 400, y: 200 }, frame)).toEqual({ x: 0.5, y: 0.5 });
    expect(pointOnImage({ x: 287.5, y: 0 }, frame)).toEqual({ x: 0, y: 0 });
  });

  it("rabat un toucher dans une bande noire sur le bord de l'image", () => {
    expect(pointOnImage({ x: 10, y: 450 }, frame)).toEqual({ x: 0, y: 1 });
  });

  it("pose deux points pour une ligne, trois pour un angle, puis repart d'un toucher", () => {
    const a = { x: 0.1, y: 0.1 };
    const b = { x: 0.5, y: 0.5 };
    const c = { x: 0.9, y: 0.1 };
    let draft = addPoint("angle", [], a);
    expect(pointsLeft("angle", draft)).toBe(2);
    draft = addPoint("angle", draft, b);
    expect(isComplete("angle", draft)).toBe(false);
    draft = addPoint("angle", draft, c);
    expect(isComplete("angle", draft)).toBe(true);
    expect(addPoint("angle", draft, a)).toEqual([a]);
    expect(isComplete("line", [a, b])).toBe(true);
  });

  it("rend un tracé valide pour le contrat, avec les proportions de l'image", () => {
    const drawing = drawingFrom("arrow", [{ x: 0.2, y: 0.8 }, { x: 0.6, y: 0.3 }], 9 / 16);
    expect(drawing).toEqual({ kind: "arrow", points: [{ x: 0.2, y: 0.8 }, { x: 0.6, y: 0.3 }], aspect: 0.563 });
    expect(videoDrawing.safeParse(drawing).success).toBe(true);
    expect(drawingFrom("angle", [{ x: 0.2, y: 0.8 }], 1)).toBeNull();
    expect(drawingFrom(null, [], 1)).toBeNull();
  });

  it("lit les proportions de la piste vidéo, sinon d'un tracé déjà posé, sinon le 16/9", () => {
    expect(videoAspect({ width: 1080, height: 1920 })).toBe(1080 / 1920);
    expect(videoAspect(null, [{}, { aspect: 0.75 }])).toBe(0.75);
    expect(videoAspect({ width: 0, height: 0 })).toBe(FALLBACK_ASPECT);
  });
});
