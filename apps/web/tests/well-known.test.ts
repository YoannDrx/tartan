import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as appleRoute } from "../app/.well-known/apple-app-site-association/route";
import { GET as androidRoute } from "../app/.well-known/assetlinks.json/route";

afterEach(() => vi.unstubAllEnvs());

describe("liens universels", () => {
  it("Apple : 404 sans identifiant d'équipe, jamais de valeur fictive", async () => {
    vi.stubEnv("APPLE_TEAM_ID", "");
    expect(appleRoute().status).toBe(404);
  });
  it("Apple : publie les chemins avec l'équipe", async () => {
    vi.stubEnv("APPLE_TEAM_ID", "G9WFV7HNV6");
    const response = appleRoute();
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).toContain("G9WFV7HNV6.coach.tartan.app");
  });
  it("Android : 404 sans empreinte, sinon les publie toutes", async () => {
    vi.stubEnv("ANDROID_SHA256_FINGERPRINTS", "");
    expect(androidRoute().status).toBe(404);
    vi.stubEnv("ANDROID_SHA256_FINGERPRINTS", "AA:BB, CC:DD");
    const body = await androidRoute().json();
    expect(body[0].target.sha256_cert_fingerprints).toEqual(["AA:BB", "CC:DD"]);
  });
});
