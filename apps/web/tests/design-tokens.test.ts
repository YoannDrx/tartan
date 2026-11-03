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
    "film-electric": tokens.color.film.electric,
    "film-lime": tokens.color.film.lime,
    "film-lime-deep": tokens.color.film.limeDeep,
    "film-electric-deep": tokens.color.film.electricDeep,
    "film-sun-deep": tokens.color.film.sunDeep,
    "film-sun": tokens.color.film.sun,
    "film-sun-light": tokens.color.film.sunLight,
    "film-skin": tokens.color.film.skin,
    page: tokens.scene.page,
    "on-page": tokens.scene.onPage,
    lane: tokens.scene.lane,
    card: tokens.scene.card,
    "card-raised": tokens.scene.cardRaised,
    "card-line": tokens.scene.cardLine,
    "control-line": tokens.scene.controlLine,
    fg: tokens.scene.text,
    "fg-muted": tokens.scene.textMuted,
    link: tokens.scene.link,
    hero: tokens.scene.hero,
    "on-hero": tokens.scene.onHero,
    "on-hero-accent": tokens.scene.onHeroAccent,
    "action-page": tokens.scene.actionOnPage,
    "on-action-page": tokens.scene.onActionOnPage,
    "action-card": tokens.scene.actionOnCard,
    "on-action-card": tokens.scene.onActionOnCard,
    "st-done": tokens.scene.status.done,
    "st-partial": tokens.scene.status.partial,
    "st-missed": tokens.scene.status.missed,
    "st-upcoming": tokens.scene.status.upcoming,
    "on-status": tokens.scene.onStatus,
  };

  it.each(Object.entries(expected))("--color-%s", (name, value) => {
    expect(css).toContain(`--color-${name}: ${value.toLowerCase()};`);
  });
});
