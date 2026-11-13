import { describe, expect, it } from "vitest";
import { backupName, expiredBackups, PREFIX } from "../scripts/sauvegarde-blob.mjs";

const now = new Date("2026-11-13T02:30:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const copy = (name: string, days: number) => ({ pathname: `${PREFIX}${name}`, url: `https://x/${name}`, uploadedAt: daysAgo(days) });

describe("sauvegardes dans Vercel Blob", () => {
  it("nomme la copie par sa date, sans suffixe aléatoire", () => {
    expect(backupName(now)).toBe("sauvegardes/tartan-2026-11-13T02-30.dump.age");
  });

  it("supprime les copies de plus de 30 jours, pas les autres", () => {
    const blobs = [copy("a", 45), copy("b", 31), copy("c", 29), copy("d", 0)];
    expect(expiredBackups(blobs, now, 30).map((b: { pathname: string }) => b.pathname)).toEqual([
      "sauvegardes/a",
      "sauvegardes/b",
    ]);
  });

  it("garde toujours la copie la plus récente, même trop vieille", () => {
    const blobs = [copy("a", 60), copy("b", 40)];
    expect(expiredBackups(blobs, now, 30).map((b: { pathname: string }) => b.pathname)).toEqual(["sauvegardes/a"]);
  });

  it("ne touche à rien hors du dossier des sauvegardes", () => {
    expect(expiredBackups([{ pathname: "autre/x", url: "u", uploadedAt: daysAgo(90) }], now, 30)).toEqual([]);
  });
});
