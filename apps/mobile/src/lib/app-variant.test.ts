import { describe, expect, it } from "vitest";
import { parseVariant, resolveApiUrl, universalHostsFor } from "./app-variant";

describe("variantes de l'app", () => {
  it("une valeur inconnue reste en développement", () => {
    expect(parseVariant(undefined)).toBe("development");
    expect(parseVariant("autre")).toBe("development");
    expect(parseVariant("preview")).toBe("preview");
  });
  it("le build preview échoue s'il vise la production", () => {
    expect(() => resolveApiUrl("preview", "https://app.tartan.coach")).toThrow(/production/);
    expect(() => resolveApiUrl("development", "https://app.tartan.coach")).toThrow(/production/);
    expect(resolveApiUrl("preview", "https://preview.tartan.coach")).toBe("https://preview.tartan.coach");
  });
  it("la production vise son API, en HTTPS et de façon explicite", () => {
    expect(resolveApiUrl("production", "https://app.tartan.coach")).toBe("https://app.tartan.coach");
    expect(() => resolveApiUrl("production", undefined)).toThrow(/obligatoire/);
    expect(() => resolveApiUrl("preview", "http://preview.tartan.coach")).toThrow(/HTTPS/);
  });
  it("le développement garde son adresse locale par défaut", () => {
    expect(resolveApiUrl("development", undefined)).toBe("http://localhost:3000");
    expect(resolveApiUrl("development", " ")).toBe("http://localhost:3000");
  });
  it("seule la production déclare les liens universels", () => {
    const hosts = ["tartan.coach", "app.tartan.coach"];
    expect(universalHostsFor("production", hosts)).toEqual(hosts);
    expect(universalHostsFor("preview", hosts)).toEqual([]);
    expect(universalHostsFor("development", hosts)).toEqual([]);
  });
});
