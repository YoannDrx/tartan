import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

// Tout fichier de logo vient de `scripts/build-logo.mjs` : ce test refuse un fichier manquant ou à la mauvaise
// taille, et un fichier que l'app ou le manifeste citent sans que le script le produise.
const root = path.join(import.meta.dirname, "../../..");
const web = "apps/web/public";
const mobile = "apps/mobile/assets/brand";

// Largeur et hauteur d'un PNG, lues dans son en-tête, et présence d'un canal de transparence.
const png = (file: string) => {
  const data = readFileSync(path.join(root, file));
  expect(data.subarray(1, 4).toString("latin1"), file).toBe("PNG");
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), alpha: [4, 6].includes(data[25]!) };
};

const PNGS: [file: string, width: number, height: number, alpha: boolean][] = [
  [`${web}/favicon-32.png`, 32, 32, true],
  [`${web}/apple-touch-icon.png`, 180, 180, false],
  [`${web}/icon-192.png`, 192, 192, true],
  [`${web}/icon-512.png`, 512, 512, true],
  [`${web}/icon-maskable-512.png`, 512, 512, false],
  [`${web}/brand/logo-email.png`, 258, 72, true],
  [`${web}/brand/og.png`, 1200, 630, false],
  [`${mobile}/icon-ios.png`, 1024, 1024, false],
  [`${mobile}/icon-ios-dark.png`, 1024, 1024, true],
  [`${mobile}/icon-ios-tinted.png`, 1024, 1024, false],
  [`${mobile}/adaptive-foreground.png`, 1024, 1024, true],
  [`${mobile}/adaptive-monochrome.png`, 1024, 1024, true],
  [`${mobile}/adaptive-background.png`, 1024, 1024, false],
  [`${mobile}/play-store-512.png`, 512, 512, true],
  [`${mobile}/splash.png`, 1024, 1024, true],
  [`${mobile}/notification.png`, 96, 96, true],
];

const SVGS: [file: string, viewBox: string][] = [
  [`${web}/favicon.svg`, "0 0 160 160"],
  [`${web}/brand/icon.svg`, "0 0 160 160"],
  [`${web}/brand/icon-small.svg`, "0 0 160 160"],
  [`${web}/brand/icon-mono.svg`, "0 0 160 160"],
  [`${web}/brand/logo.svg`, "0 0 573 160"],
  [`${web}/brand/logo-mono.svg`, "0 0 573 160"],
  [`${web}/brand/logo-on-dark.svg`, "0 0 573 160"],
  // Le mot « Tartan » de l'en-tête du site : `.wordmark` (globals.css) reprend ce rapport, 408 sur 107.
  [`${web}/brand/wordmark-letters.svg`, "3 -105 408 107"],
  [`${web}/brand/wordmark-line.svg`, "3 -105 408 107"],
];

describe("fichiers du logo", () => {
  it.each(PNGS)("%s : %i × %i", (file, width, height, alpha) => {
    expect(png(file)).toEqual({ width, height, alpha });
  });

  it("laisse Google Play appliquer son masque sur un fond entièrement opaque", async () => {
    const file = path.join(root, mobile, "play-store-512.png");
    const { channels } = await sharp(file).stats();
    expect(channels[3]?.min).toBe(255);
    expect(readFileSync(file).length).toBeLessThanOrEqual(1024 * 1024);
  });

  it.each(SVGS)("%s garde son cadre", (file, viewBox) => {
    expect(readFileSync(path.join(root, file), "utf8")).toContain(`viewBox="${viewBox}"`);
  });

  it("le script produit chaque fichier contrôlé ici", () => {
    const script = readFileSync(path.join(root, "scripts/build-logo.mjs"), "utf8");
    for (const [file] of [...PNGS, ...SVGS]) expect(script, file).toContain(`"${path.basename(file)}"`);
  });

  it("l'app, le manifeste et les e-mails ne citent que des fichiers produits", () => {
    const produced = new Set([...PNGS, ...SVGS].map(([file]) => file));
    const cited = (source: string, pattern: RegExp, prefix: string) =>
      [...readFileSync(path.join(root, source), "utf8").matchAll(pattern)].map((match) => `${prefix}${match[1]}`);
    const files = [
      ...cited("apps/mobile/app.config.ts", /"\.\/assets\/brand\/([^"]+)"/g, `${mobile}/`),
      ...cited("apps/web/app/manifest.ts", /src: "\/([^"]+\.png)"/g, `${web}/`),
      ...cited("apps/web/app/layout.tsx", /"\/((?:favicon|apple-touch-icon)[^"]*)"/g, `${web}/`),
      ...cited("apps/web/src/components/logo.tsx", /"\/(brand\/[^"]+\.svg)"/g, `${web}/`),
      ...cited("apps/web/emails/layout.tsx", /\/(brand\/logo-email\.png)/g, `${web}/`),
    ];
    expect(files.length).toBeGreaterThan(12);
    for (const file of files) {
      expect(existsSync(path.join(root, file)), file).toBe(true);
      expect(produced.has(file), file).toBe(true);
    }
  });

  // Le composant du logotype calcule sa largeur d'après ce rapport.
  it("le logotype garde le rapport que le composant attend", () => {
    expect(readFileSync(path.join(root, "apps/web/src/components/logo.tsx"), "utf8")).toContain("573) / 160");
  });
});
