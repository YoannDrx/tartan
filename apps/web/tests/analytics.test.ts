import { describe, expect, it } from "vitest";
import { scrubAnalyticsEvent } from "@/lib/analytics";

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
});
