// La photo de profil sur le téléphone : ce qui part au serveur est un carré de 512 pixels au plus, en JPEG.
// Le serveur revérifie tout (`saveAvatar`) : un carré de 128 à 1 024 pixels, 4 Mo au plus.

export const AVATAR_SIDE = 512;
export const AVATAR_MIN_SIDE = 128;
// Qualité JPEG : un visage net sous les 150 Ko.
export const AVATAR_QUALITY = 85;

export type SquarePlan = {
  // Le carré gardé, en pixels de l'image d'origine.
  crop: { startX: number; startY: number; endX: number; endY: number } | null;
  // Le côté final, ou null quand l'image recadrée est déjà à la bonne taille.
  resizeTo: number | null;
};

// Le recadrage du téléphone (déplacer, zoomer) rend en principe un carré ; à un pixel près, ou sur un appareil qui
// l'ignore, on garde le carré central. Une image trop petite n'est pas envoyée : le serveur la refuserait.
export const planSquare = (width: number, height: number): SquarePlan | null => {
  const w = Math.floor(width);
  const h = Math.floor(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const side = Math.min(w, h);
  if (side < AVATAR_MIN_SIDE) return null;
  const startX = Math.floor((w - side) / 2);
  const startY = Math.floor((h - side) / 2);
  const crop = w === h ? null : { startX, startY, endX: startX + side, endY: startY + side };
  return { crop, resizeTo: side > AVATAR_SIDE ? AVATAR_SIDE : null };
};

// Le chemin d'un fichier tel que `fetch` le veut dans un envoi multipart.
export const fileUri = (path: string): string => (path.startsWith("file://") ? path : `file://${path}`);
