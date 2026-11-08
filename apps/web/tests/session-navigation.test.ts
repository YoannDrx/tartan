import { describe, expect, it } from "vitest";
import { newSessionHref, sessionReturnTo, withSessionReturn } from "@/lib/session-navigation";

const group = "11111111-1111-4111-8111-111111111111";
describe("contexte de navigation des séances", () => {
  it("conserve semaine, groupe et mois sans accepter une destination libre", () => {
    expect(sessionReturnTo(`/calendrier?vue=mois&mois=2026-12&groupe=${group}`)).toBe(
      `/calendrier?groupe=${group}&vue=mois&mois=2026-12`,
    );
    expect(sessionReturnTo(`/suivi?semaine=2026-11-09&groupe=${group}`)).toBe(
      `/suivi?semaine=2026-11-09&groupe=${group}`,
    );
    for (const value of [
      "//example.org",
      "https://example.org",
      "javascript:alert(1)",
      "/calendrier/../../reglages",
      "/calendrier#secret",
      ["/suivi"],
    ]) {
      expect(sessionReturnTo(value)).toBeUndefined();
    }
    expect(sessionReturnTo("/calendrier?semaine=2026-02-30&vue=mois&mois=2026-13&groupe=inconnu&token=secret")).toBe(
      "/calendrier?vue=mois",
    );
  });
  it("transmet le contexte sans perdre l'ancre de l'athlète", () => {
    const target = new URL(
      withSessionReturn("/seances/exemple/suivi#athlete", "/suivi?semaine=2026-11-09"),
      "https://tartan.invalid",
    );
    expect(target.hash).toBe("#athlete");
    expect(target.searchParams.get("retour")).toBe("/suivi?semaine=2026-11-09");
    expect(withSessionReturn("/seances/exemple", "//example.org")).toBe("/seances/exemple");
  });
  it("prépare la date et le groupe de la nouvelle séance sans inventer de destinataire", () => {
    const url = new URL(
      newSessionHref({ date: "2026-11-10", groupId: group, returnTo: "/calendrier?semaine=2026-11-09" }),
      "https://tartan.invalid",
    );
    expect(url.searchParams.get("date")).toBe("2026-11-10");
    expect(url.searchParams.get("groupe")).toBe(group);
    expect(url.searchParams.get("retour")).toBe("/calendrier?semaine=2026-11-09");
    expect(newSessionHref({ date: "2026-02-30", groupId: "inconnu" })).toBe("/seances/nouvelle");
  });
});
