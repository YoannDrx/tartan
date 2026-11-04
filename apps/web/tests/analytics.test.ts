import { describe, expect, it } from "vitest";
import { scrubAnalyticsEvent } from "@/lib/analytics";
import nextConfig from "../next.config";

const urlSent = (url: string) => scrubAnalyticsEvent({ type: "pageview", url })?.url;

describe("mesure d'audience", () => {
  it("laisse les pages publiques lisibles", () => {
    expect(urlSent("https://tartan.coach/tarifs")).toBe("https://tartan.coach/tarifs");
  });

  it("n'envoie ni jeton d'URL ni paramètre", () => {
    expect(urlSent("https://app.tartan.coach/i/jeton-secret")).toBe("https://app.tartan.coach/i/[masqué]");
    expect(urlSent("https://app.tartan.coach/accord-parental/jeton-secret")).toBe(
      "https://app.tartan.coach/accord-parental/[masqué]",
    );
    expect(urlSent("https://app.tartan.coach/nouveau-mot-de-passe?token=secret")).toBe(
      "https://app.tartan.coach/nouveau-mot-de-passe",
    );
  });

  it("n'envoie aucun identifiant d'athlète ou de séance", () => {
    expect(urlSent("https://app.tartan.coach/athletes/8f14e45f-ceea-467f-a8d1-5f6a3b1c2d3e/progres")).toBe(
      "https://app.tartan.coach/athletes/[id]/progres",
    );
  });

  it("ne laisse pas l'adresse complète partir dans l'en-tête Referer", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const headers = rules.flatMap((rule) => rule.headers);
    expect(headers.find((header) => header.key === "Referrer-Policy")?.value).toBe("strict-origin");
  });
});
