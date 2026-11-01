import { describe, expect, it } from "vitest";
import { paramFromUrl } from "./auth-callback";

describe("paramFromUrl", () => {
  it("garde intacte la signature encodée du cookie", () => {
    const cookie = "better-auth.session_token=abc.si%2Fg%2Bx%3D; Max-Age=7776000; Path=/; HttpOnly; SameSite=Lax";
    const url = `tartan-dev:///callback?cookie=${new URLSearchParams({ cookie }).toString().slice("cookie=".length)}`;
    expect(paramFromUrl(url, "cookie")).toBe(cookie);
  });

  it("lit l'erreur et ignore le reste", () => {
    expect(paramFromUrl("tartan-dev:///callback?error=INVALID_TOKEN", "error")).toBe("INVALID_TOKEN");
    expect(paramFromUrl("tartan-dev:///callback", "cookie")).toBeNull();
    expect(paramFromUrl(null, "cookie")).toBeNull();
    expect(paramFromUrl("tartan-dev:///callback?cookie=%E0%A4%A", "cookie")).toBeNull();
  });
});
