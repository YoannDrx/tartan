// Les tracés posés sur une image de vidéo : une ligne, une flèche, un cercle ou un angle.
// Les points sont en coordonnées relatives (0 à 1) sur l'image, indépendantes de la taille d'affichage.
export type DrawingKind = "line" | "arrow" | "circle" | "angle";
export type DrawingPoint = { x: number; y: number };

// Deux points pour un segment, un cercle (centre puis bord) ; trois pour un angle (un bras, le sommet, l'autre bras).
export const drawingPoints = (kind: DrawingKind) => (kind === "angle" ? 3 : 2);

// L'angle au sommet, en degrés entiers, mesuré dans les proportions réelles de l'image (largeur / hauteur).
// Sans cette correction, un angle droit sur une vidéo en portrait paraîtrait faux.
export const drawingAngle = (points: readonly DrawingPoint[], aspect: number): number | null => {
  const [a, vertex, b] = points;
  if (!a || !vertex || !b || !(aspect > 0)) return null;
  const u = { x: (a.x - vertex.x) * aspect, y: a.y - vertex.y };
  const v = { x: (b.x - vertex.x) * aspect, y: b.y - vertex.y };
  const lengths = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
  if (lengths === 0) return null;
  const cos = Math.min(1, Math.max(-1, (u.x * v.x + u.y * v.y) / lengths));
  return Math.round((Math.acos(cos) * 180) / Math.PI);
};

// Un point posé hors de l'image revient sur son bord.
export const clampPoint = ({ x, y }: DrawingPoint): DrawingPoint => ({
  x: Math.min(1, Math.max(0, x)),
  y: Math.min(1, Math.max(0, y)),
});
