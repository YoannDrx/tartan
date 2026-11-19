// En-têtes d'images minimaux, aux dimensions voulues : ce que le serveur lit pour revérifier un envoi.
// Le contenu des pixels n'est jamais décodé côté serveur, l'en-tête suffit.
const bytes = (...parts: (number[] | Uint8Array)[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0) + 64);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const be16 = (n: number) => [(n >>> 8) & 255, n & 255];
const le24 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

export const pngOf = (width: number, height: number) =>
  bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    be32(13),
    ascii("IHDR"),
    be32(width),
    be32(height),
    [8, 6, 0, 0, 0],
  );

// Un JPEG avec un segment APP0 avant le début d'image, comme un vrai fichier.
export const jpegOf = (width: number, height: number) =>
  bytes(
    [0xff, 0xd8],
    [0xff, 0xe0],
    be16(16),
    ascii("JFIF"),
    [0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
    [0xff, 0xc0],
    be16(17),
    [8],
    be16(height),
    be16(width),
    [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
  );

// Un WebP étendu (VP8X), la forme qu'écrit un navigateur pour une image avec transparence.
export const webpOf = (width: number, height: number) =>
  bytes(
    ascii("RIFF"),
    [0, 0, 0, 0],
    ascii("WEBPVP8X"),
    [10, 0, 0, 0],
    [0x10, 0, 0, 0],
    le24(width - 1),
    le24(height - 1),
  );

// Un WebP sans perte (VP8L) : largeur et hauteur sur 14 bits chacune, moins un.
export const webpLosslessOf = (width: number, height: number) => {
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  return bytes(
    ascii("RIFF"),
    [0, 0, 0, 0],
    ascii("WEBPVP8L"),
    [0, 0, 0, 0],
    [0x2f],
    [bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255],
  );
};

// Un WebP avec perte simple (VP8) : la signature de l'image clé, puis les dimensions sur 14 bits.
export const webpLossyOf = (width: number, height: number) =>
  bytes(
    ascii("RIFF"),
    [0, 0, 0, 0],
    ascii("WEBPVP8 "),
    [0, 0, 0, 0],
    [0, 0, 0],
    [0x9d, 0x01, 0x2a],
    [width & 255, (width >>> 8) & 0x3f],
    [height & 255, (height >>> 8) & 0x3f],
  );
