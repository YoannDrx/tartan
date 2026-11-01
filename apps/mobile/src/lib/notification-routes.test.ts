import { describe, expect, it } from "vitest";
import { actionFromResponse, routeForNotification } from "./notification-routes";

const id = "3f2c1d7e-0000-4000-8000-000000000000";

describe("routeForNotification", () => {
  it("ouvre la vidéo", () => {
    expect(routeForNotification({ link: `/mes-sauts/${id}` })).toBe(`/video/${id}`);
    expect(routeForNotification({ link: `/videos/${id}` })).toBe(`/video/${id}`);
  });

  it("ouvre le suivi d'une séance côté coach", () => {
    expect(routeForNotification({ link: `/seances/${id}/suivi` })).toBe(`/coach-session/${id}`);
  });

  it("ouvre Aujourd'hui pour une séance athlète", () => {
    expect(routeForNotification({ link: `/seance/${id}` })).toBe("/today");
  });

  it("revient à l'accueil sur un contenu inconnu", () => {
    expect(routeForNotification({ link: "https://exemple.fr" })).toBe("/");
    expect(routeForNotification({ link: "/videos/../../x" })).toBe("/");
    expect(routeForNotification(null)).toBe("/");
    expect(routeForNotification({ link: 42 })).toBe("/");
  });
});

describe("actionFromResponse", () => {
  const data = { organizationId: "o", sessionId: "s" };

  it("traduit les boutons de présence et de validation", () => {
    expect(actionFromResponse("attendance-yes", data)).toEqual({
      kind: "attendance",
      status: "present",
      orgId: "o",
      sessionId: "s",
    });
    expect(actionFromResponse("attendance-no", data)?.kind).toBe("attendance");
    expect(actionFromResponse("validate-done", data)).toEqual({ kind: "validate", orgId: "o", sessionId: "s" });
  });

  it("ignore le toucher simple et les données incomplètes", () => {
    expect(actionFromResponse("expo.modules.notifications.actions.DEFAULT", data)).toBeNull();
    expect(actionFromResponse("validate-done", { organizationId: "o" })).toBeNull();
  });
});
