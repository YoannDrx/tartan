import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { motion, tokens } from "@tartan/design-tokens";
import { describe, expect, it } from "vitest";

// globals.css est un miroir des jetons : couleurs et mouvement n'ont qu'une source, packages/design-tokens.
const ROOT = path.resolve(import.meta.dirname, "..");
const css = readFileSync(path.join(ROOT, "app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

type Declaration = { scope: string[]; property: string; value: string };

// Lecture minimale du CSS : la pile des blocs ouverts, et chaque déclaration avec son contexte.
const read = (source: string) => {
  const declarations: Declaration[] = [];
  const selectors: string[] = [];
  const scope: string[] = [];
  let buffer = "";
  for (const character of source) {
    if (character === "{") {
      const selector = buffer.replace(/\s+/g, " ").trim();
      selectors.push(selector);
      scope.push(selector);
      buffer = "";
    } else if (character === "}" || character === ";") {
      const text = buffer.replace(/\s+/g, " ").trim();
      const colon = text.indexOf(":");
      if (text && colon > 0) {
        declarations.push({
          scope: [...scope],
          property: text.slice(0, colon).trim(),
          value: text.slice(colon + 1).trim(),
        });
      }
      if (character === "}") scope.pop();
      buffer = "";
    } else {
      buffer += character;
    }
  }
  return { declarations, selectors };
};

const { declarations, selectors } = read(css);
const kebab = (key: string) => key.replace(/[A-Z0-9]+/g, (part) => `-${part.toLowerCase()}`);
const HEX = /#[0-9a-fA-F]{3,8}\b/;
// Le contexte d'une déclaration, sans la couche Tailwind qui l'enveloppe.
const where = (declaration: Declaration) =>
  declaration.scope.filter((selector) => !selector.startsWith("@layer")).join(" > ");

const roles = (prefix: string, palette: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(palette)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [`${prefix}${kebab(key)}`, value as string]),
  );
const statuses = (prefix: string, status: Record<string, string>) =>
  Object.fromEntries(Object.entries(status).map(([key, value]) => [`${prefix}${key}`, value]));
const activities = (palette: Record<string, { background: string; text: string }>) =>
  Object.fromEntries(
    Object.entries(palette).flatMap(([key, value]) => [
      [`--activity-${key}-bg`, value.background],
      [`--activity-${key}-text`, value.text],
    ]),
  );
const work = (palette: typeof tokens.work | typeof tokens.workDark | typeof tokens.workTartan) => ({
  ...roles("--color-work-", palette),
  ...statuses("--color-work-st-", palette.status),
});

const { color, scene, band } = tokens;
const sceneCard = {
  "--color-card": scene.card,
  "--color-card-raised": scene.cardRaised,
  "--color-card-line": scene.cardLine,
  "--color-control-line": scene.controlLine,
  "--color-fg": scene.text,
  "--color-fg-muted": scene.textMuted,
  "--color-link": scene.link,
  ...statuses("--color-st-", scene.status),
  "--color-on-status": scene.onStatus,
};
const dark = { ...activities(tokens.activityDark), ...work(tokens.workDark) };

// Chaque endroit de globals.css où une couleur s'écrit, et le jeton qu'elle reproduit.
const EXPECTED: Record<string, Record<string, string>> = {
  "@theme": {
    "--color-brand": color.brand,
    "--color-brand-strong": color.brandStrong,
    "--color-brand-tint": color.brandTint,
    "--color-ink": color.ink,
    "--color-ink-2": color.ink2,
    "--color-ink-3": color.ink3,
    "--color-muted": color.muted,
    "--color-muted-on-ink": color.mutedOnInk,
    "--color-brand-on-ink": color.brandOnInk,
    "--color-bg": color.bg,
    "--color-surface": color.surface,
    "--color-surface-sunk": color.surfaceSunk,
    "--color-border": color.border,
    "--color-warning-tint": color.warningTint,
    "--color-warning-strong": color.warningStrong,
    ...statuses("--color-status-", color.status),
    ...roles("--color-film-", color.film),
    "--color-page": scene.page,
    "--color-on-page": scene.onPage,
    "--color-lane": scene.lane,
    "--color-on-ink": color.white,
    ...sceneCard,
    "--color-hero": scene.hero,
    "--color-on-hero": scene.onHero,
    "--color-on-hero-accent": scene.onHeroAccent,
    "--color-action-page": scene.actionOnPage,
    "--color-on-action-page": scene.onActionOnPage,
    "--color-action-card": scene.actionOnCard,
    "--color-on-action-card": scene.onActionOnCard,
    "--color-accent": scene.actionOnPage,
    "--color-on-accent": scene.onActionOnPage,
    "--color-accent-hover": color.film.limeDeep,
    "--color-page-deep": color.brandStrong,
    ...work(tokens.work),
    "--color-band": band.background,
    "--color-band-deep": band.deep,
    "--color-band-text": band.text,
    "--color-band-lane": band.lane,
    "--color-band-action": band.action,
    "--color-on-band-action": band.onAction,
    "--color-band-action-hover": band.actionHover,
  },
  ":root": activities(tokens.activity),
  'html:has([data-theme="dark"])': dark,
  '@media (prefers-color-scheme: dark) > html:has([data-theme="system"])': dark,
  'html:has([data-theme="tartan"])': { ...activities(tokens.activityDark), ...work(tokens.workTartan) },
  "html:has(.world-work) .scene-dark": sceneCard,
};

describe("miroir des couleurs", () => {
  const found: Record<string, Record<string, string>> = {};
  for (const declaration of declarations.filter((entry) => HEX.test(entry.value))) {
    (found[where(declaration)] ??= {})[declaration.property] = declaration.value;
  }

  it("aucune couleur ne s'écrit hors des endroits prévus", () => {
    expect(Object.keys(found).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.entries(EXPECTED))("%s reproduit ses jetons, sans couleur en plus ni en moins", (scope, expected) => {
    const lower = Object.fromEntries(Object.entries(expected).map(([name, value]) => [name, value.toLowerCase()]));
    expect(found[scope]).toEqual(lower);
  });

  it("une couleur en dur ne s'écrit que dans une variable", () => {
    const loose = declarations.filter((entry) => HEX.test(entry.value) && !entry.property.startsWith("--"));
    expect(loose.map((entry) => `${where(entry)} { ${entry.property} }`)).toEqual([]);
  });

  it("les ombres sont de l'encre, et aucune autre fonction de couleur n'est utilisée", () => {
    const ink = [1, 3, 5].map((index) => Number.parseInt(color.ink.slice(index, index + 2), 16)).join(" ");
    const functions = declarations.filter((entry) =>
      /(?<![a-z-])(rgba?|hsla?|oklch|oklab|color-mix)\(/.test(entry.value),
    );
    expect(functions.map((entry) => entry.property).sort()).toEqual(["--shadow-float", "--shadow-float-strong"]);
    for (const entry of functions) expect(entry.value).toMatch(new RegExp(`rgb\\(${ink} / 0\\.\\d+\\)$`));
  });
});

describe("miroir du mouvement", () => {
  const theme = Object.fromEntries(
    declarations.filter((entry) => where(entry) === "@theme static").map((entry) => [entry.property, entry.value]),
  );

  it.each(Object.entries(motion.duration))("--duration-%s", (name, milliseconds) => {
    expect(theme[`--duration-${name}`]).toBe(`${milliseconds}ms`);
  });

  it.each(Object.entries(motion.easing))("--ease-%s", (name, curve) => {
    expect(theme[`--ease-${name}`]).toBe(curve);
  });

  it("le pas de la cascade, et les valeurs par défaut des transitions, viennent des jetons", () => {
    expect(theme["--stagger-step"]).toBe(`${motion.stagger.step}ms`);
    expect(theme["--default-transition-duration"]).toBe("var(--duration-quick)");
    expect(theme["--default-transition-timing-function"]).toBe("var(--ease-reception)");
  });

  it("la feuille de styles ne définit aucune durée ni courbe hors des jetons", () => {
    const defined = declarations
      .filter((entry) => /^--(duration|ease|stagger)-/.test(entry.property))
      .map((entry) => `${where(entry)} ${entry.property}`)
      .map((name) => name.replace("@theme static ", ""));
    expect(defined.sort()).toEqual(
      [
        ...Object.keys(motion.duration).map((name) => `--duration-${name}`),
        ...Object.keys(motion.easing).map((name) => `--ease-${name}`),
        "--stagger-step",
      ].sort(),
    );
  });

  it("les durées restent dans les bornes de DESIGN.md", () => {
    const { duration, stagger } = motion;
    // Rien de plus de 200 ms sur le chemin de validation, 260 ms pour une entrée d'écran de travail.
    expect(duration.base).toBeLessThanOrEqual(200);
    expect(duration.enter).toBeLessThanOrEqual(260);
    expect(stagger.max).toBeLessThanOrEqual(6);
    const ordered = [
      duration.instant,
      duration.quick,
      duration.base,
      duration.enter,
      duration.trace,
      duration.expressive,
    ];
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
    expect(duration.celebration).toBeGreaterThan(duration.expressive);
  });

  const moving = declarations.filter(
    (entry) => /^(animation|transition)/.test(entry.property) && !where(entry).startsWith("@theme"),
  );
  const net = (entry: Declaration) =>
    entry.scope.some((selector) => selector.includes("prefers-reduced-motion: reduce"));

  it("aucune animation de la feuille de styles n'écrit sa durée ou sa courbe en dur", () => {
    const raw = moving
      .filter((entry) => !net(entry))
      // Les jetons lus par var() sont l'écriture attendue : on regarde ce qui reste une fois qu'ils sont retirés.
      .filter((entry) =>
        /(?<![\w-])\d*\.?\d+m?s\b|cubic-bezier\(|steps\(|\bease(-in|-out|-in-out)?\b/.test(
          entry.value.replace(/var\(--[\w-]+\)/g, ""),
        ),
      );
    expect(raw.map((entry) => `${where(entry)} { ${entry.property}: ${entry.value} }`)).toEqual([]);
  });

  it("toute animation est déclarée sous « prefers-reduced-motion: no-preference »", () => {
    const outside = moving
      .filter((entry) => !net(entry) && entry.value !== "none")
      .filter((entry) => !entry.scope.some((selector) => selector.includes("prefers-reduced-motion: no-preference")));
    expect(outside.map((entry) => `${where(entry)} { ${entry.property} }`)).toEqual([]);
  });

  it("le filet de mouvement réduit coupe animations, transitions et transitions de page", () => {
    const reduced = declarations.filter(
      (entry) => entry.scope.length === 2 && entry.scope[0] === "@media (prefers-reduced-motion: reduce)",
    );
    const everything = Object.fromEntries(
      reduced
        .filter((entry) => entry.scope[1] === "*, *::before, *::after")
        .map((entry) => [entry.property, entry.value]),
    );
    expect(everything).toEqual({
      "animation-duration": "0.01ms !important",
      "animation-delay": "0s !important",
      "animation-iteration-count": "1 !important",
      "transition-duration": "0.01ms !important",
      "transition-delay": "0s !important",
      "scroll-behavior": "auto !important",
    });
    const pages = reduced.filter((entry) => entry.scope[1]!.includes("::view-transition-group(*)"));
    expect(pages.map((entry) => `${entry.property}: ${entry.value}`)).toEqual(["animation: none !important"]);
  });
});

describe("pas de CSS mort", () => {
  const sources = ["app", "src", "emails", "../../packages/mascot/src", "../../packages/game/src"]
    .flatMap((directory) =>
      readdirSync(path.join(ROOT, directory), { recursive: true, encoding: "utf8" })
        .filter((file) => /\.tsx?$/.test(file))
        .map((file) => readFileSync(path.join(ROOT, directory, file), "utf8")),
    )
    .join("\n");
  const used = (name: string) =>
    new RegExp(`(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(sources);
  // Une classe composée dans le code, comme `world-${monde}` : son préfixe y figure suivi d'une interpolation.
  const composed = (name: string) =>
    name
      .split("-")
      .slice(0, -1)
      .some((_, index, parts) => sources.includes(`${parts.slice(0, index + 1).join("-")}-\${`));

  it("chaque classe de globals.css sert dans le code", () => {
    const classes = new Set(
      selectors
        .filter((selector) => !selector.startsWith("@"))
        .flatMap((selector) => [...selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((match) => match[1]!)),
    );
    expect(classes.size).toBeGreaterThan(40);
    expect([...classes].filter((name) => !used(name) && !composed(name)).sort()).toEqual([]);
  });

  it("chaque animation nommée est jouée quelque part", () => {
    const keyframes = selectors
      .filter((selector) => selector.startsWith("@keyframes "))
      .map((selector) => selector.slice("@keyframes ".length));
    expect(keyframes.length).toBeGreaterThan(5);
    const played = declarations
      .filter((entry) => /^animation(-name)?$/.test(entry.property))
      .map((entry) => entry.value);
    expect(keyframes.filter((name) => !played.some((value) => value.split(" ").includes(name)))).toEqual([]);
  });
});
