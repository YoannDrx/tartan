import { describe, expect, it } from "vitest";
import { legalLinks } from "./legal-links";

describe("liens légaux de l'app", () => {
  it("restent dans les pages sans tarif", () => {
    const links = legalLinks("https://tartan.coach");
    for (const link of Object.values(links)) {
      expect(link.startsWith("https://tartan.coach/mobile/")).toBe(true);
    }
  });
});
