export const PARENTAL_CONSENT_AGE = 15;
export const MINIMUM_AGE = 18;

export type AgeStatus = "adult" | "minor" | "unknown";

export const ageAt = (birthDate: string, now: Date, timeZone?: string): number => {
  if (timeZone) now = new Date(`${new Intl.DateTimeFormat("sv-SE", { timeZone }).format(now)}T12:00:00Z`);
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
};

export const ageStatus = (birthDate: string | null, now: Date): AgeStatus => {
  if (!birthDate) return "unknown";
  return ageAt(birthDate, now) >= MINIMUM_AGE ? "adult" : "minor";
};

export const requiresParentalConsent = (birthDate: string | null, now: Date): boolean =>
  birthDate !== null && ageAt(birthDate, now) < PARENTAL_CONSENT_AGE;

export type ConsentState = {
  health: boolean;
  video: boolean;
  guardian: "none" | "pending" | "granted" | "refused";
  guardianScope?: { health: boolean; video: boolean } | null;
};

// Sous 15 ans, l'accord de l'enfant ET celui du parent sont requis (art. 45 LIL).
export const effectiveConsent = (state: ConsentState): { health: boolean; video: boolean } => {
  if (state.guardian === "none") return { health: state.health, video: state.video };
  if (state.guardian !== "granted") return { health: false, video: false };
  return {
    health: state.health && Boolean(state.guardianScope?.health),
    video: state.video && Boolean(state.guardianScope?.video),
  };
};
