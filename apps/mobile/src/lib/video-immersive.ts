// Le plein écran de l'analyse vidéo, comme sur le web (DESIGN.md) : en portrait, l'éditeur dans une feuille en bas à
// trois hauteurs (repliée, moitié, entière) ; en paysage, un panneau à droite de l'image, repliable en rail.
// Écrire une remarque ramène la feuille à moitié : l'image commentée n'est jamais masquée.

export const SHEET_HEIGHTS = ["rail", "half", "full"] as const;
export type SheetHeight = (typeof SHEET_HEIGHTS)[number];

// La part de la hauteur disponible que prend la feuille, sous l'image et ses contrôles.
export const SHEET_SHARE: Record<SheetHeight, number> = { rail: 0, half: 0.5, full: 1 };

export const growSheet = (height: SheetHeight): SheetHeight =>
  SHEET_HEIGHTS[Math.min(SHEET_HEIGHTS.indexOf(height) + 1, SHEET_HEIGHTS.length - 1)]!;

export const shrinkSheet = (height: SheetHeight): SheetHeight =>
  SHEET_HEIGHTS[Math.max(SHEET_HEIGHTS.indexOf(height) - 1, 0)]!;

// Où la feuille se pose quand on lâche la poignée : `share` est la part qu'elle occupe à cet instant.
export const snapSheet = (share: number): SheetHeight =>
  SHEET_HEIGHTS.reduce((closest, height) =>
    Math.abs(SHEET_SHARE[height] - share) < Math.abs(SHEET_SHARE[closest] - share) ? height : closest,
  );

// Un glissement de la poignée : vers le haut (dy négatif), la feuille grandit.
export const dragSheet = (height: SheetHeight, dy: number, available: number): SheetHeight =>
  available > 0 ? snapSheet(Math.max(0, Math.min(1, SHEET_SHARE[height] - dy / available))) : height;

// Une remarque porte sur l'image affichée : la feuille ne doit pas la recouvrir pendant qu'on l'écrit.
export const sheetForRemark = (height: SheetHeight): SheetHeight =>
  height === "rail" || height === "full" ? "half" : height;

// Paysage, ou écran large : le panneau à droite ; sinon la feuille en bas.
export const immersiveLayout = (size: { width: number; height: number }): "side" | "sheet" =>
  size.width > size.height || size.width >= 1024 ? "side" : "sheet";

// Le panneau à droite : un tiers de l'écran, entre 300 et 420 points ; replié, un rail de 56 points.
export const PANEL_RAIL = 56;
export const panelWidth = (width: number, collapsed: boolean) =>
  collapsed ? PANEL_RAIL : Math.round(Math.min(420, Math.max(300, width / 3)));
