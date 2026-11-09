import { describe, expect, it } from "vitest";
import {
  canRestart,
  compareVersions,
  notificationCategory,
  playReleaseVersion,
  publishedPlayVersions,
  servedPlayVersion,
  updateStateOf,
  versionCode,
} from "./app-versions";

describe("versions de l'application", () => {
  it("compare les numéros sans les lire comme du texte", () => {
    expect(compareVersions("1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(versionCode("1.2.3")).toBe(1002003);
    expect(versionCode("dev")).toBeNull();
  });

  it("lit la version dans le nom d'une sortie Google Play, sans deviner", () => {
    expect(playReleaseVersion("1.2.0")).toBe("1.2.0");
    expect(playReleaseVersion("42 (1.2.0)")).toBe("1.2.0");
    expect(playReleaseVersion("Hiver 1.2.0")).toBeNull();
    expect(playReleaseVersion("2026-11-09")).toBeNull();
    expect(playReleaseVersion(undefined)).toBeNull();
  });

  it("ne retient que les sorties Google Play publiées", () => {
    const published = "RELEASE_LIFECYCLE_STATE_PUBLISHED";
    expect(
      publishedPlayVersions([
        { releaseName: "12 (1.2.0)", releaseLifecycleState: published },
        { releaseName: "13 (1.3.0)", releaseLifecycleState: "RELEASE_LIFECYCLE_STATE_IN_REVIEW" },
        { releaseName: "14 (1.4.0)", releaseLifecycleState: "RELEASE_LIFECYCLE_STATE_APPROVED_NOT_PUBLISHED" },
      ]),
    ).toEqual(["1.2.0"]);
    expect(publishedPlayVersions([{ releaseName: "13 (1.3.0)", releaseLifecycleState: "other" }])).toEqual([]);
    expect(publishedPlayVersions([{ releaseName: "Hiver", releaseLifecycleState: published }])).toBeNull();
  });

  it("exige une sortie à la fois publiée et servie à tous", () => {
    const track = [
      { name: "12 (1.2.0)", status: "completed" },
      { name: "13 (1.3.0)", status: "inProgress" },
      { name: "11 (1.1.0)", status: "completed" },
      { name: "14 (1.4.0)", status: "completed" },
    ];
    expect(servedPlayVersion(["1.1.0", "1.2.0", "1.3.0"], track)).toBe("1.2.0");
    expect(servedPlayVersion(["1.3.0"], track)).toBeNull();
    expect(servedPlayVersion([], track)).toBeNull();
    expect(servedPlayVersion(["1.2.0"], [{ name: "12 (1.2.0)", status: "halted" }])).toBeNull();
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
