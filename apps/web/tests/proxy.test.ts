import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { RETURN_PATH_HEADER } from "@/lib/return-path";
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

describe("page demandée, pour y revenir après la connexion", () => {
  // Les en-têtes transmis à la page voyagent dans la réponse du proxy sous ce préfixe.
  const forwarded = (url: string, headers: Record<string, string> = {}) =>
    proxy(new NextRequest(url, { headers: { host: "app.tartan.coach", ...headers } })).headers.get(
      `x-middleware-request-${RETURN_PATH_HEADER}`,
    );
  it("la page et sa requête sont transmises à la page", () => {
    expect(forwarded("https://app.tartan.coach/calendrier?vue=mois")).toBe("/calendrier?vue=mois");
    expect(forwarded("https://app.tartan.coach/suivi")).toBe("/suivi");
  });
  it("le paramètre interne des navigations côté client n'en fait pas partie", () => {
    expect(forwarded("https://app.tartan.coach/calendrier?vue=mois&_rsc=abc12")).toBe("/calendrier?vue=mois");
    expect(forwarded("https://app.tartan.coach/suivi?_rsc=abc12")).toBe("/suivi");
  });
  it("une valeur envoyée par le client est écrasée", () => {
    expect(forwarded("https://app.tartan.coach/suivi", { [RETURN_PATH_HEADER]: "//evil.invalid" })).toBe("/suivi");
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
