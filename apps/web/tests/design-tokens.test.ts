import { readFileSync } from "node:fs";
import path from "node:path";
import { tokens } from "@tartan/design-tokens";
import { describe, expect, it } from "vitest";

// globals.css reprend les jetons : ils ne doivent pas diverger de la source unique.
describe("jetons de design", () => {
  const css = readFileSync(path.resolve(import.meta.dirname, "../app/globals.css"), "utf8");
  const expected: Record<string, string> = {
    brand: tokens.color.brand,
    "brand-strong": tokens.color.brandStrong,
    "brand-tint": tokens.color.brandTint,
    ink: tokens.color.ink,
    "ink-2": tokens.color.ink2,
    muted: tokens.color.muted,
    bg: tokens.color.bg,
    surface: tokens.color.surface,
    border: tokens.color.border,
    "status-done": tokens.color.status.done,
    "status-partial": tokens.color.status.partial,
    "status-missed": tokens.color.status.missed,
    "status-upcoming": tokens.color.status.upcoming,
  };

  it.each(Object.entries(expected))("--color-%s", (name, value) => {
    expect(css).toContain(`--color-${name}: ${value.toLowerCase()};`);
  });
});
