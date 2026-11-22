import { describe, expect, it } from "vitest";
import { MY_VIDEOS_ROUTE, parseReferralCode, parseSpaceParam, sessionRoute, videoRoute } from "./deep-links";

const id = "3f2c1d7e-0000-4000-8000-000000000000";

describe("liens du site vers l'app", () => {
  it("ouvre la séance, y compris son mode séance", () => {
    expect(sessionRoute(id)).toBe(`/session/${id}`);
    expect(sessionRoute([id, "mode"])).toBe(`/session/${id}`);
    expect(sessionRoute([id, "series"])).toBe(`/session-sets/${id}`);
  });

  it("ouvre la vidéo, ou la liste « Mes vidéos » sans identifiant", () => {
    expect(videoRoute(id)).toBe(`/video/${id}`);
    expect(videoRoute(undefined)).toBe("/mes-videos");
    expect(MY_VIDEOS_ROUTE).toBe("/mes-videos");
  });

  it("n'utilise jamais un contenu inconnu comme route", () => {
    expect(sessionRoute("../../settings")).toBe("/today");
    expect(sessionRoute(undefined)).toBe("/today");
    expect(videoRoute("a/b")).toBe("/mes-videos");
    expect(parseSpaceParam("x")).toBeNull();
  });

  it("garde le code de parrainage comme le site", () => {
    expect(parseReferralCode("yoann-4f2a")).toBe("YOANN-4F2A");
    expect(parseReferralCode("abc")).toBeNull();
    expect(parseReferralCode("a b c d")).toBeNull();
  });
});
