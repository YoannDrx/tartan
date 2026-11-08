import { describe, expect, it } from "vitest";
import { canRestart, compareVersions, notificationCategory, updateStateOf, versionCode } from "./app-versions";

describe("versions de l'application", () => {
  it("compare les numéros sans les lire comme du texte", () => {
    expect(compareVersions("1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(versionCode("1.2.3")).toBe(1002003);
    expect(versionCode("dev")).toBeNull();
  });

  it("distingue à jour, proposé et obligatoire", () => {
    expect(updateStateOf({ current: "1.2.0", latest: "1.2.0" })).toBe("current");
    expect(updateStateOf({ current: "1.1.0", latest: "1.2.0" })).toBe("optional");
    expect(updateStateOf({ current: "1.1.0", latest: "1.2.0", minimum: "1.2.0" })).toBe("required");
  });

  it("ne bloque jamais une version illisible", () => {
    expect(updateStateOf({ current: null, latest: "1.2.0", minimum: "1.2.0" })).toBe("current");
  });

  it("refuse de redémarrer pendant une séance, une capture ou un envoi", () => {
    const idle = { uploading: false, capturing: false, inSession: false, syncing: false };
    expect(canRestart(idle)).toBe(true);
    expect(canRestart({ ...idle, inSession: true })).toBe(false);
    expect(canRestart({ ...idle, capturing: true })).toBe(false);
    expect(canRestart({ ...idle, uploading: true })).toBe(false);
    expect(canRestart({ ...idle, syncing: true })).toBe(false);
  });

  it("range chaque notification dans une catégorie", () => {
    expect(notificationCategory("session_eve")).toBe("sessions");
    expect(notificationCategory("comment")).toBe("feedback");
    expect(notificationCategory("announcement")).toBe("group");
    expect(notificationCategory("app_update")).toBe("product");
    expect(notificationCategory("pain_alert")).toBe("alerts");
  });
});
