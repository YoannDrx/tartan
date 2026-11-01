// Génère logo et icônes selon la construction du cahier des charges (§ 9.2).
// Numéros et logotype sont convertis en tracés : aucun fichier final ne dépend de la police.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const fontPath = require.resolve("@expo-google-fonts/barlow-condensed/700Bold/BarlowCondensed_700Bold.ttf");
const buffer = readFileSync(fontPath);
const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

const BRICK = "#C4442B";
const INK = "#24262C";
const WHITE = "#FFFFFF";
const LANES = [12, 46, 80, 114, 148];
const BASELINES = [38, 72, 106, 140];

const numberPaths = (fill) =>
  BASELINES.map((y, i) => {
    const text = String(i + 1);
    const width = font.getAdvanceWidth(text, 26);
    return `<path fill="${fill}" d="${font.getPath(text, 92 - width / 2, y, 26).toPathData(2)}"/>`;
  }).join("");

const marks = ({ small = false } = {}) => {
  const lane = small ? 5 : 3;
  const finish = small ? 11 : 7;
  const lines = LANES.map(
    (y) => `<rect x="-4" y="${y - lane / 2}" width="168" height="${lane}" fill="${WHITE}"/>`,
  ).join("");
  const line = `<rect x="${116 - finish / 2}" y="${12 - lane / 2}" width="${finish}" height="${136 + lane}" fill="${WHITE}"/>`;
  return `${lines}${line}${small ? "" : numberPaths(WHITE)}`;
};

const icon = ({
  fill = BRICK,
  small = false,
  rounded = true,
} = {}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="Tartan">
<defs><clipPath id="c"><rect width="160" height="160" rx="${rounded ? 36 : 0}"/></clipPath></defs>
<g clip-path="url(#c)"><rect width="160" height="160" fill="${fill}"/>${marks({ small })}</g>
</svg>`;

const lockup = ({ fill = BRICK, text = "#15161A" } = {}) => {
  const size = 160;
  const gap = 160 / 3;
  const logotype = font.getPath("Tartan", size + gap, 124, 150);
  const box = logotype.getBoundingBox();
  const width = Math.ceil(box.x2) + 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 160" role="img" aria-label="Tartan">
<defs><clipPath id="c"><rect width="160" height="160" rx="36"/></clipPath></defs>
<g clip-path="url(#c)"><rect width="160" height="160" fill="${fill}"/>${marks()}</g>
<path fill="${text}" d="${logotype.toPathData(2)}"/>
</svg>`;
};

const web = path.join(root, "apps/web/public");
const brand = path.join(web, "brand");
const mobile = path.join(root, "apps/mobile/assets/brand");
for (const dir of [brand, mobile]) mkdirSync(dir, { recursive: true });

const png = (svg, size, out) => sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(out);

writeFileSync(path.join(brand, "icon.svg"), icon());
writeFileSync(path.join(brand, "icon-small.svg"), icon({ small: true }));
writeFileSync(path.join(brand, "icon-mono.svg"), icon({ fill: INK }));
writeFileSync(path.join(brand, "logo.svg"), lockup());
writeFileSync(path.join(brand, "logo-mono.svg"), lockup({ fill: INK }));
writeFileSync(path.join(brand, "logo-on-dark.svg"), lockup({ text: WHITE }));
writeFileSync(path.join(web, "favicon.svg"), icon({ small: true }));

await png(icon(), 192, path.join(web, "icon-192.png"));
await png(icon(), 512, path.join(web, "icon-512.png"));
await png(icon({ small: true }), 32, path.join(web, "favicon-32.png"));
await png(icon({ rounded: false }), 180, path.join(web, "apple-touch-icon.png"));
await sharp(Buffer.from(lockup()), { density: 300 }).png().toFile(path.join(brand, "logo.png"));

// iOS : carré plein sans transparence (les coins sont arrondis par le système).
await sharp(Buffer.from(icon({ rounded: false })), { density: 600 })
  .resize(1024, 1024)
  .flatten({ background: BRICK })
  .png()
  .toFile(path.join(mobile, "icon-ios.png"));
// Android adaptatif : premier plan transparent dans la zone sûre, fond rouge brique.
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-44 -44 248 248"><defs><clipPath id="c"><rect width="160" height="160"/></clipPath></defs><g clip-path="url(#c)">${marks()}</g></svg>`;
await png(foreground, 1024, path.join(mobile, "adaptive-foreground.png"));
await sharp({ create: { width: 1024, height: 1024, channels: 3, background: BRICK } })
  .png()
  .toFile(path.join(mobile, "adaptive-background.png"));
await png(icon(), 512, path.join(mobile, "play-store-512.png"));
await png(icon(), 400, path.join(mobile, "splash.png"));
// Icône de notification Android : silhouette blanche sur fond transparent.
await png(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">${marks({ small: true })}</svg>`,
  96,
  path.join(mobile, "notification.png"),
);
console.log("Logo et icônes générés.");
