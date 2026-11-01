import { describe, expect, it } from "vitest";
import { parseInviteToken } from "./invite-link";

const token = "abcDEF0123456789_-xy";

describe("parseInviteToken", () => {
  it("reconnaît le lien web, le schéma de l'app et le jeton seul", () => {
    expect(parseInviteToken(`https://tartan.coach/i/${token}`)).toBe(token);
    expect(parseInviteToken(`https://app.tartan.coach/i/${token}?utm=x`)).toBe(token);
    expect(parseInviteToken(`tartan://i/${token}`)).toBe(token);
    expect(parseInviteToken(`  ${token}  `)).toBe(token);
  });

  it("retrouve le lien dans le message copié", () => {
    expect(parseInviteToken(`Rejoins le groupe : https://tartan.coach/i/${token} à bientôt`)).toBe(token);
  });

  it("refuse le reste", () => {
    expect(parseInviteToken("")).toBeNull();
    expect(parseInviteToken("bonjour coach")).toBeNull();
    expect(parseInviteToken("https://exemple.fr/page")).toBeNull();
    expect(parseInviteToken("https://tartan.coach/i/court")).toBeNull();
  });
});
