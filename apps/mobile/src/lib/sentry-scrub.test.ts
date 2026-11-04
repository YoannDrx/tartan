import { describe, expect, it } from "vitest";
import { scrubSentryEvent, scrubUrl, sentryOptions } from "./sentry-scrub";

describe("Sentry sur mobile", () => {
  it("masque les jetons des adresses", () => {
    expect(scrubUrl("https://tartan.coach/i/jeton-secret?x=1")).toBe("https://tartan.coach/i/[masqué]");
    expect(scrubUrl("tartan://r/CODE")).toBe("tartan://r/[masqué]");
  });
  it("retire l'utilisateur, le fil d'Ariane et le contenu des requêtes", () => {
    const event = scrubSentryEvent({
      user: { email: "lea@test" },
      breadcrumbs: [{ message: "douleur" }],
      request: { url: "https://tartan.coach/i/jeton", data: { pain: 5 }, headers: { cookie: "x" }, cookies: "x" },
    });
    expect(JSON.stringify(event)).not.toMatch(/lea@test|douleur|jeton|pain|cookie/);
  });
  it("aucune mesure, aucune capture, désactivé sans DSN", () => {
    const options = sentryOptions(undefined, "production");
    expect(options.enabled).toBe(false);
    expect(options.tracesSampleRate).toBe(0);
    expect(options.sendDefaultPii).toBe(false);
    expect(options.attachScreenshot).toBe(false);
    expect(options.beforeBreadcrumb()).toBeNull();
  });
});
