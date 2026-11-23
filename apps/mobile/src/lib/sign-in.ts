import { m } from "@tartan/i18n";
import { z } from "zod";

// La connexion de l'app native, en règles pures : les mêmes que le formulaire du web (`sign-in-form.tsx`).

export type AuthFailure = { status?: number; code?: string } | null | undefined;
export type LinkOutcome = "sent" | "limited" | "unreachable" | "failed";

// Entre deux envois : assez long pour laisser l'e-mail arriver, bien en dessous des limites du serveur.
export const RESEND_COOLDOWN_SECONDS = 30;
// Après un refus du serveur, on attend la fenêtre entière.
export const LIMITED_COOLDOWN_SECONDS = 60;

const email = z.email();

// L'adresse saisie, nettoyée, ou rien si elle n'en est pas une.
export const normalizedEmail = (value: string): string | null => {
  const address = value.trim().toLowerCase();
  return email.safeParse(address).success ? address : null;
};

// Ce qu'un refus veut dire pour la personne. Jamais le message brut : il pourrait dire qu'un compte existe.
export const failureMessage = (error: AuthFailure, fallback: string): string =>
  error?.status === 429
    ? m.account.signIn.rateLimited
    : error?.code === "EMAIL_UNREACHABLE"
      ? m.auth.emailUnreachable
      : fallback;

// Le résultat d'une demande de lien, pour l'écran d'attente.
export const linkRequestOutcome = (result: { error?: AuthFailure } | null | undefined): LinkOutcome =>
  !result
    ? "failed"
    : !result.error
      ? "sent"
      : result.error.status === 429
        ? "limited"
        : result.error.code === "EMAIL_UNREACHABLE"
          ? "unreachable"
          : "failed";

// La connexion par mot de passe : `verify` quand l'adresse n'est pas confirmée (le lien vient de repartir),
// sinon le message à montrer. Un mauvais mot de passe et une adresse inconnue donnent le même.
export const passwordSignInOutcome = (
  error: AuthFailure,
): { kind: "signed-in" } | { kind: "verify" } | { kind: "error"; message: string } => {
  if (!error) return { kind: "signed-in" };
  if (error.status === 403) return { kind: "verify" };
  return { kind: "error", message: failureMessage(error, m.account.signIn.invalidCredentials) };
};

// Le renvoi s'ouvre à une heure donnée : relue chaque seconde, une mise en veille ne fausse pas l'attente.
export const secondsLeft = (until: number, now: number): number => Math.max(0, Math.ceil((until - now) / 1000));

export const cooldownAfter = (outcome: LinkOutcome): number =>
  (outcome === "limited" ? LIMITED_COOLDOWN_SECONDS : RESEND_COOLDOWN_SECONDS) * 1000;
