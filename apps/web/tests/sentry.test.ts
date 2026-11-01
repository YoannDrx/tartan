import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { scrubEvent } from "@/lib/sentry";

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
});
