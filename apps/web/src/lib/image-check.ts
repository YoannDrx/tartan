import { w } from "@tartan/i18n/web";
import { invalid } from "@/lib/errors";

// Ce que le serveur revérifie avant de stocker une image recadrée dans le navigateur : le type déclaré, le type
// réel lu dans les premiers octets, le poids, et les dimensions. Un fichier renommé ne passe pas.
export type ImageType = "image/jpeg" | "image/png" | "image/webp";
export type ImageInfo = { type: ImageType; width: number; height: number };

const u16be = (b: Uint8Array, at: number) => (b[at]! << 8) | b[at + 1]!;
const u32be = (b: Uint8Array, at: number) =>
  ((b[at]! << 24) >>> 0) + (b[at + 1]! << 16) + (b[at + 2]! << 8) + b[at + 3]!;
const u16le = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8);
const u24le = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16);
const ascii = (b: Uint8Array, at: number, length: number) => String.fromCharCode(...b.subarray(at, at + length));

const png = (b: Uint8Array): ImageInfo | null =>
  b.length >= 24 && u32be(b, 0) === 0x89504e47 && ascii(b, 12, 4) === "IHDR"
    ? { type: "image/png", width: u32be(b, 16), height: u32be(b, 20) }
    : null;

// Les marqueurs de début d'image (SOF0 à SOF15, sauf DHT, JPG et DAC) portent la hauteur puis la largeur.
const jpeg = (b: Uint8Array): ImageInfo | null => {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let at = 2;
  while (at + 9 < b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1]!;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    const length = u16be(b, at + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { type: "image/jpeg", height: u16be(b, at + 5), width: u16be(b, at + 7) };
    }
    at += 2 + length;
  }
  return null;
};

const webp = (b: Uint8Array): ImageInfo | null => {
  if (b.length < 30 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8X") return { type: "image/webp", width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  if (chunk === "VP8L" && b[20] === 0x2f) {
    const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
    return { type: "image/webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8 " && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
    return { type: "image/webp", width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  return null;
};

export const readImageInfo = (bytes: Uint8Array): ImageInfo | null => png(bytes) ?? jpeg(bytes) ?? webp(bytes);

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
// Le recadrage exporte un carré de 512 pixels ; la marge couvre un autre client qui exporterait plus grand.
export const MIN_SIDE = 128;
export const MAX_SIDE = 1024;

export const checkedSquareImage = async (file: File): Promise<{ bytes: Uint8Array; info: ImageInfo }> => {
  const t = w.profile.errors;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw invalid(t.serverType);
  if (file.size > MAX_UPLOAD_BYTES) throw invalid(t.serverSize);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = readImageInfo(bytes);
  if (!info || info.type !== file.type) throw invalid(t.serverType);
  const square = info.width === info.height;
  if (!square || info.width < MIN_SIDE || info.width > MAX_SIDE) throw invalid(t.serverDimensions);
  return { bytes, info };
};

export const extensionOf = (type: ImageType) =>
  ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[type];
