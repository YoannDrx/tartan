export const ATTRIBUTION_WINDOW_DAYS = 30;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const slug = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 10);

export const referralCodeFor = (firstName: string | null, randomBytes: Uint8Array): string => {
  const suffix = Array.from(randomBytes.slice(0, 4), (b) => ALPHABET[b % ALPHABET.length]).join("");
  const base = slug(firstName ?? "") || "COACH";
  return `TARTAN-${base}-${suffix}`;
};

export const isAttributionFresh = (clickedAt: Date, signedUpAt: Date): boolean =>
  signedUpAt.getTime() - clickedAt.getTime() <= ATTRIBUTION_WINDOW_DAYS * 86400 * 1000 && signedUpAt >= clickedAt;

export const isSelfReferral = (input: {
  codeOwnerUserId: string | null;
  codeOwnerOrgId: string | null;
  referredUserId: string;
  referredOrgIds: string[];
}): boolean =>
  input.codeOwnerUserId === input.referredUserId ||
  (input.codeOwnerOrgId !== null && input.referredOrgIds.includes(input.codeOwnerOrgId));
