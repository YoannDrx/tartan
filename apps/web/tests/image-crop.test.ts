import { describe, expect, it } from "vitest";
import {
  START,
  centerOn,
  clampCrop,
  drawTransform,
  moveBy,
  rotate,
  zoomTo,
  type CropState,
} from "@/features/avatar/crop-geometry";
import { readImageInfo } from "@/lib/image-check";
import { jpegOf, pngOf, webpLosslessOf, webpLossyOf, webpOf } from "./image-fixtures";

// La géométrie du recadrage : une photo de 900 × 600 dans un cadre de 300 pixels.
const photo = { width: 900, height: 600 };
const FRAME = 300;
const at = (state: Partial<CropState>) => ({ ...START, ...state });

describe("le recadrage d'une photo", () => {
  it("couvre le cadre au départ : le petit côté de la photo touche les bords", () => {
    const tr = drawTransform(photo, START, FRAME, FRAME, "cover");
    expect(tr.scale).toBeCloseTo(0.5);
    expect([tr.translateX, tr.translateY, tr.rotation]).toEqual([150, 150, 0]);
  });

  it("se déplace sans jamais laisser de vide dans le cadre", () => {
    // 450 × 300 à l'écran : 75 pixels de marge de chaque côté en largeur, aucune en hauteur.
    expect(moveBy(photo, START, -500, 40, FRAME, "cover")).toEqual(at({ x: -75, y: 0 }));
    expect(moveBy(photo, START, 30, 0, FRAME, "cover")).toEqual(at({ x: 30 }));
  });

  it("zoome autour du centre, dans les bornes, et regagne la marge", () => {
    const moved = at({ x: 60 });
    expect(zoomTo(photo, moved, 2, FRAME, "cover")).toEqual(at({ zoom: 2, x: 120 }));
    expect(zoomTo(photo, moved, 9, FRAME, "cover").zoom).toBe(4);
    // Dézoomer réduit la marge : le décalage se resserre avec elle.
    expect(zoomTo(photo, at({ zoom: 2, x: 200 }), 1, FRAME, "cover")).toEqual(at({ x: 75 }));
  });

  it("pivote d'un quart de tour en gardant le même point au centre", () => {
    const state = at({ zoom: 2, x: 40, y: -30 });
    const right = rotate(photo, state, 1, FRAME, "cover");
    expect(right).toEqual(at({ zoom: 2, turns: 1, x: 30, y: 40 }));
    expect(rotate(photo, right, -1, FRAME, "cover")).toEqual(state);
    // Quatre quarts de tour reviennent au départ.
    let turned = state;
    for (let i = 0; i < 4; i += 1) turned = rotate(photo, turned, 1, FRAME, "cover");
    expect(turned).toEqual(state);
    expect(drawTransform(photo, right, FRAME, 512, "cover").rotation).toBeCloseTo(Math.PI / 2);
  });

  it("amène au centre le point touché, l'alternative au glisser", () => {
    expect(centerOn(photo, START, { x: 200, y: 150 }, FRAME, "cover")).toEqual(at({ x: -50 }));
  });

  it("exporte le même cadrage à 512 pixels qu'à l'écran", () => {
    const state = at({ zoom: 1.5, x: -20, y: 10 });
    const screen = drawTransform(photo, state, FRAME, FRAME, "cover");
    const file = drawTransform(photo, state, FRAME, 512, "cover");
    const k = 512 / FRAME;
    expect(file.scale).toBeCloseTo(screen.scale * k);
    expect(file.translateX).toBeCloseTo(screen.translateX * k);
    expect(file.translateY).toBeCloseTo(screen.translateY * k);
  });
});

describe("le recadrage d'un logo", () => {
  it("tient tout entier dans le carré, et peut s'y déplacer sans en sortir", () => {
    const logo = { width: 900, height: 300 };
    expect(drawTransform(logo, START, FRAME, FRAME, "contain").scale).toBeCloseTo(1 / 3);
    // 300 × 100 à l'écran : 100 pixels de jeu vers le haut et le bas, aucun de côté.
    expect(clampCrop(logo, at({ x: 40, y: 400 }), FRAME, "contain")).toEqual(at({ x: 0, y: 100 }));
  });
});

describe("la lecture d'un en-tête d'image", () => {
  it("lit le type réel et les dimensions du PNG, du JPEG et des trois formes de WebP", () => {
    expect(readImageInfo(pngOf(512, 300))).toEqual({ type: "image/png", width: 512, height: 300 });
    expect(readImageInfo(jpegOf(640, 480))).toEqual({ type: "image/jpeg", width: 640, height: 480 });
    expect(readImageInfo(webpOf(512, 512))).toEqual({ type: "image/webp", width: 512, height: 512 });
    expect(readImageInfo(webpLosslessOf(512, 256))).toEqual({ type: "image/webp", width: 512, height: 256 });
    expect(readImageInfo(webpLossyOf(300, 200))).toEqual({ type: "image/webp", width: 300, height: 200 });
  });

  it("ne reconnaît ni un fichier vide ni un autre format", () => {
    expect(readImageInfo(new Uint8Array(0))).toBeNull();
    expect(readImageInfo(new TextEncoder().encode("GIF89a, rien d'autre ici"))).toBeNull();
  });
});
