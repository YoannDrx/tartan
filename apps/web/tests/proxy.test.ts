import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { hasBearer, safeEqual } from "@/lib/secure-compare";
import { proxy } from "../proxy";

const run = (url: string, host: string) => proxy(new NextRequest(url, { headers: { host } }));

describe("redirections entre hôtes", () => {
  it("//evil.com reste sur l'hôte Tartan depuis le site", () => {
    const location = run("https://tartan.coach//evil.com/piege", "tartan.coach").headers.get("location")!;
    expect(new URL(location).hostname).toBe("app.tartan.coach");
    expect(new URL(location).pathname).toBe("//evil.com/piege");
  });
  it("//evil.com reste sur l'hôte Tartan depuis www", () => {
    const location = run("https://www.tartan.coach//evil.com", "www.tartan.coach").headers.get("location")!;
    expect(new URL(location).hostname).toBe("tartan.coach");
  });
  it("conserve la page et la requête", () => {
    const location = run("https://tartan.coach/accueil?semaine=2", "tartan.coach").headers.get("location");
    expect(location).toBe("https://app.tartan.coach/accueil?semaine=2");
  });
});

describe("comparaison de secrets", () => {
  it("n'accepte que le bon secret", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
  it("refuse tout quand aucun secret n'est configuré", () => {
    expect(hasBearer("Bearer undefined", undefined)).toBe(false);
    expect(hasBearer(null, "secret")).toBe(false);
    expect(hasBearer("Bearer secret", "secret")).toBe(true);
  });
});
