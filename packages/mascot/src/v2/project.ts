// La projection orthographique : le même corps, vu de profil, de face ou de dessus.
// À l'écran, x va vers la droite et y vers le bas ; le sol est à y = 0 de profil et de face.
import type { Vec3 } from "./vec";

// De profil, l'athlète regarde vers la droite et montre son côté droit. De face, il regarde le spectateur :
// son côté droit est à gauche de l'image. De dessus, il regarde vers la droite.
export const GESTURE_VIEWS = ["side", "front", "top"] as const;
export type GestureView = (typeof GESTURE_VIEWS)[number];

// `depth` : plus il est grand, plus le point est près du spectateur.
export type Projected = { x: number; y: number; depth: number };

export const project = (p: Vec3, view: GestureView): Projected =>
  view === "side"
    ? { x: p.x, y: -p.y, depth: p.z }
    : view === "front"
      ? { x: -p.z, y: -p.y, depth: p.x }
      : { x: p.x, y: p.z, depth: p.y };
