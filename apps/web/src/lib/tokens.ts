import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

// Jeton dérivé par HMAC : la base ne garde que son empreinte, et le serveur peut
// réafficher un lien de groupe ou un QR code sans jamais stocker le jeton en clair.
export const deriveToken = (purpose: string, id: string): string => {
  const mac = createHmac("sha256", env().BETTER_AUTH_SECRET).update(`${purpose}:${id}`).digest("base64url");
  return `${id.replaceAll("-", "")}.${mac}`;
};

export const idFromToken = (token: string): string | null => {
  const [compact] = token.split(".");
  if (!compact || !/^[0-9a-f]{32}$/.test(compact)) return null;
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
};

export const tokenMatches = (purpose: string, token: string): boolean => {
  const id = idFromToken(token);
  if (!id) return false;
  const a = Buffer.from(deriveToken(purpose, id));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
};

export const randomId = (bytes = 4): Uint8Array => new Uint8Array(randomBytes(bytes));
