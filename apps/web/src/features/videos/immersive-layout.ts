import { clampPoint, type DrawingPoint } from "@tartan/domain";

// La feuille du plein écran sur téléphone : repliée (la frise reste seule sous l'image), à moitié, en entier.
export const SHEET_HEIGHTS = ["rail", "half", "full"] as const;
export type SheetHeight = (typeof SHEET_HEIGHTS)[number];

// La part de l'écran que prend la feuille : un glissement s'arrête sur la plus proche.
const SHEET_SHARE: Record<SheetHeight, number> = { rail: 0, half: 0.5, full: 1 };

export const growSheet = (height: SheetHeight): SheetHeight =>
  SHEET_HEIGHTS[Math.min(SHEET_HEIGHTS.indexOf(height) + 1, SHEET_HEIGHTS.length - 1)]!;

export const shrinkSheet = (height: SheetHeight): SheetHeight =>
  SHEET_HEIGHTS[Math.max(SHEET_HEIGHTS.indexOf(height) - 1, 0)]!;

// Où la feuille se pose quand on la lâche : `share` est la part de l'écran qu'elle occupe à cet instant.
export const snapSheet = (share: number): SheetHeight =>
  SHEET_HEIGHTS.reduce((closest, height) =>
    Math.abs(SHEET_SHARE[height] - share) < Math.abs(SHEET_SHARE[closest] - share) ? height : closest,
  );

// Une remarque porte sur l'image affichée : la feuille ne doit pas la recouvrir pendant qu'on l'écrit.
export const sheetForRemark = (height: SheetHeight): SheetHeight =>
  height === "rail" || height === "full" ? "half" : height;

// Le repère du tracé au clavier avance d'un centième de l'image par flèche, d'un dixième avec Maj.
export const CURSOR_STEP = 0.01;
export const CURSOR_LEAP = 0.1;
const DIRECTIONS: Record<string, DrawingPoint> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

export const moveCursor = (cursor: DrawingPoint, key: string, leap: boolean): DrawingPoint | null => {
  const direction = DIRECTIONS[key];
  if (!direction) return null;
  const step = leap ? CURSOR_LEAP : CURSOR_STEP;
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return clampPoint({ x: round(cursor.x + direction.x * step), y: round(cursor.y + direction.y * step) });
};

export const samePoint = (a: DrawingPoint | undefined, b: DrawingPoint) =>
  !!a && Math.abs(a.x - b.x) < CURSOR_STEP / 2 && Math.abs(a.y - b.y) < CURSOR_STEP / 2;

export const percent = (value: number) => Math.round(value * 100);

// Les raccourcis de l'analyse. Une touche tenue ne répète que le pas image par image.
export type VideoShortcut = "toggle" | "previous" | "next" | "fullscreen" | "remark" | "exit";

type Pressed = {
  key: string;
  repeat: boolean;
  modified: boolean;
  // Ce qui a le focus : un champ où l'on écrit, un contrôle que la barre d'espace actionne déjà, un dialogue ouvert.
  typing: boolean;
  control: boolean;
  dialog: boolean;
};

export const shortcutFor = ({ key, repeat, modified, typing, control, dialog }: Pressed): VideoShortcut | null => {
  if (modified || dialog) return null;
  if (key === "Escape") return repeat ? null : "exit";
  if (typing) return null;
  if (key === "ArrowLeft") return "previous";
  if (key === "ArrowRight") return "next";
  if (repeat) return null;
  if (key === " ") return control ? null : "toggle";
  const letter = key.toLowerCase();
  if (letter === "f") return "fullscreen";
  if (letter === "m") return "remark";
  return null;
};
