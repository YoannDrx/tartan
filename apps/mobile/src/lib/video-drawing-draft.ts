import type { VideoDrawing } from "@tartan/contracts";
import { clampPoint, drawingPoints, type DrawingKind, type DrawingPoint } from "@tartan/domain";

// Un tracé posé au doigt sur l'analyse vidéo : module pur, testé sans téléphone. Les points sont relatifs à l'image
// (de 0 à 1), comme sur le web : un tracé se replace juste sur tout écran, quelle que soit la forme de la vidéo.

export const DRAWING_KINDS: DrawingKind[] = ["line", "arrow", "angle", "circle"];

// Les proportions par défaut d'une image, quand la vidéo ne les donne pas.
export const FALLBACK_ASPECT = 16 / 9;

export type Frame = { x: number; y: number; width: number; height: number };

/** Où l'image s'affiche dans la scène : contenu ajusté sans déformation (`contain`), centré. */
export const videoFrame = (stage: { width: number; height: number }, aspect: number): Frame => {
  if (stage.width <= 0 || stage.height <= 0 || !(aspect > 0)) return { x: 0, y: 0, width: 0, height: 0 };
  if (stage.width / stage.height > aspect) {
    const width = stage.height * aspect;
    return { x: (stage.width - width) / 2, y: 0, width, height: stage.height };
  }
  const height = stage.width / aspect;
  return { x: 0, y: (stage.height - height) / 2, width: stage.width, height };
};

/** Le point de l'image sous le doigt ; un toucher dans les bandes noires se rabat sur le bord de l'image. */
export const pointOnImage = (touch: { x: number; y: number }, frame: Frame): DrawingPoint | null => {
  if (frame.width <= 0 || frame.height <= 0) return null;
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return clampPoint({ x: round((touch.x - frame.x) / frame.width), y: round((touch.y - frame.y) / frame.height) });
};

export const isComplete = (kind: DrawingKind, draft: readonly DrawingPoint[]) => draft.length >= drawingPoints(kind);

export const pointsLeft = (kind: DrawingKind, draft: readonly DrawingPoint[]) =>
  Math.max(0, drawingPoints(kind) - draft.length);

/** Un toucher de plus : il ajoute un point ; un tracé déjà complet repart de ce point, comme sur le web. */
export const addPoint = (kind: DrawingKind, draft: readonly DrawingPoint[], point: DrawingPoint): DrawingPoint[] =>
  isComplete(kind, draft) ? [point] : [...draft, point];

/** Le tracé prêt à partir avec la remarque, ou null tant qu'il manque un point. */
export const drawingFrom = (
  kind: DrawingKind | null,
  draft: readonly DrawingPoint[],
  aspect: number,
): VideoDrawing | null =>
  kind && isComplete(kind, draft)
    ? { kind, points: draft.slice(0, drawingPoints(kind)), aspect: Math.round(aspect * 1000) / 1000 }
    : null;

/** Les proportions de la vidéo d'après sa piste ; à défaut, celles d'un tracé déjà posé, sinon le 16/9. */
export const videoAspect = (
  size: { width: number; height: number } | null | undefined,
  drawings: readonly { aspect?: number }[] = [],
): number => {
  if (size && size.width > 0 && size.height > 0) return size.width / size.height;
  return drawings.find((drawing) => drawing.aspect)?.aspect ?? FALLBACK_ASPECT;
};
