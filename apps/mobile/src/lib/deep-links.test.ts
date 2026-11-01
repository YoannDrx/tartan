import { describe, expect, it } from "vitest";
import { jumpRoute, parseReferralCode, parseSpaceParam, sessionRoute } from "./deep-links";

const id = "3f2c1d7e-0000-4000-8000-000000000000";

describe("liens du site vers l'app", () => {
  it("ouvre la séance, y compris son mode séance", () => {
    expect(sessionRoute(id)).toBe(`/session/${id}`);
    expect(sessionRoute([id, "mode"])).toBe(`/session/${id}`);
  });

  it("ouvre le saut, ou la liste sans identifiant", () => {
    expect(jumpRoute(id)).toBe(`/video/${id}`);
    expect(jumpRoute(undefined)).toBe("/jumps");
  });

  it("n'utilise jamais un contenu inconnu comme route", () => {
    expect(sessionRoute("../../settings")).toBe("/today");
    expect(sessionRoute(undefined)).toBe("/today");
    expect(jumpRoute("a/b")).toBe("/jumps");
    expect(parseSpaceParam("x")).toBeNull();
  });

  it("garde le code de parrainage comme le site", () => {
    expect(parseReferralCode("yoann-4f2a")).toBe("YOANN-4F2A");
    expect(parseReferralCode("abc")).toBeNull();
    expect(parseReferralCode("a b c d")).toBeNull();
  });
});
