import { m } from "@tartan/i18n";
import { describe, expect, it } from "vitest";
import {
  cooldownAfter,
  failureMessage,
  LIMITED_COOLDOWN_SECONDS,
  linkRequestOutcome,
  normalizedEmail,
  passwordSignInOutcome,
  RESEND_COOLDOWN_SECONDS,
  secondsLeft,
} from "./sign-in";

describe("la connexion de l'app native", () => {
  it("nettoie l'adresse et refuse ce qui n'en est pas une", () => {
    expect(normalizedEmail("  Lea@Exemple.FR ")).toBe("lea@exemple.fr");
    expect(normalizedEmail("pas-un-email")).toBeNull();
    expect(normalizedEmail("")).toBeNull();
  });

  it("un mauvais mot de passe et une adresse inconnue donnent le même message, qui propose le lien", () => {
    expect(passwordSignInOutcome({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" })).toEqual({
      kind: "error",
      message: m.account.signIn.invalidCredentials,
    });
    expect(passwordSignInOutcome({ status: 400 })).toEqual({
      kind: "error",
      message: m.account.signIn.invalidCredentials,
    });
    expect(m.account.signIn.invalidCredentials).toContain("lien");
  });

  it("une adresse pas encore confirmée mène à l'écran d'attente, le lien venant de repartir", () => {
    expect(passwordSignInOutcome({ status: 403 })).toEqual({ kind: "verify" });
    expect(passwordSignInOutcome(null)).toEqual({ kind: "signed-in" });
  });

  it("dit d'attendre après trop d'essais, et nomme une adresse qui ne reçoit plus nos e-mails", () => {
    expect(failureMessage({ status: 429 }, "x")).toBe(m.account.signIn.rateLimited);
    expect(failureMessage({ code: "EMAIL_UNREACHABLE" }, "x")).toBe(m.auth.emailUnreachable);
    expect(failureMessage({ status: 500 }, "repli")).toBe("repli");
  });

  it("lit le résultat d'une demande de lien", () => {
    expect(linkRequestOutcome({})).toBe("sent");
    expect(linkRequestOutcome({ error: null })).toBe("sent");
    expect(linkRequestOutcome({ error: { status: 429 } })).toBe("limited");
    expect(linkRequestOutcome({ error: { code: "EMAIL_UNREACHABLE" } })).toBe("unreachable");
    expect(linkRequestOutcome({ error: { status: 500 } })).toBe("failed");
    expect(linkRequestOutcome(null)).toBe("failed");
  });

  it("ouvre le renvoi après 30 secondes, une minute après un refus du serveur", () => {
    expect(cooldownAfter("sent")).toBe(RESEND_COOLDOWN_SECONDS * 1000);
    expect(cooldownAfter("limited")).toBe(LIMITED_COOLDOWN_SECONDS * 1000);
    expect(secondsLeft(30_000, 0)).toBe(30);
    expect(secondsLeft(30_000, 29_001)).toBe(1);
    expect(secondsLeft(30_000, 31_000)).toBe(0);
  });
});
