import { createHash, timingSafeEqual } from "node:crypto";

// Empreintes de longueur fixe : la comparaison ne révèle ni le contenu ni la longueur du secret.
const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

export const safeEqual = (a: string, b: string): boolean => timingSafeEqual(digest(a), digest(b));

export const hasBearer = (header: string | null, secret: string | undefined): boolean =>
  Boolean(secret) && safeEqual(header ?? "", `Bearer ${secret}`);
