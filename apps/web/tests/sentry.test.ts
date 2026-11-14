import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { ignoredErrors, scrubEvent } from "@/lib/sentry";

describe("suivi d'erreurs", () => {
  it("n'envoie ni utilisateur, ni corps, ni jeton d'URL", () => {
    const event = scrubEvent({
      type: undefined,
      user: { email: "lea@exemple.fr" },
      breadcrumbs: [{ message: "douleur au genou" }],
      request: {
        url: "https://app.tartan.coach/i/jeton-secret?email=lea@exemple.fr",
        data: { pain: "genou" },
        cookies: { session: "secret" },
        headers: { authorization: "secret" },
        query_string: "email=lea@exemple.fr",
      },
    } as ErrorEvent);
    expect(JSON.stringify(event)).not.toMatch(/lea@|genou|secret/);
    expect(event.request?.url).toBe("https://app.tartan.coach/i/[masqué]");
  });

  it("ignore une transition de page interrompue, pas les autres erreurs", () => {
    const ignored = (message: string) => ignoredErrors.some((pattern) => pattern.test(message));
    expect(ignored("InvalidStateError: Transition was aborted because of invalid state. Document hidden")).toBe(true);
    expect(ignored("InvalidStateError: autre chose")).toBe(false);
  });
});
