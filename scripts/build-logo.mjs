// Génère le logo et toutes ses déclinaisons : `node scripts/build-logo.mjs`.
// La marque est le « T des couloirs » (DESIGN.md, section Logo) : l'initiale tracée par deux couloirs qui tournent,
// posée sur une ligne d'arrivée citron. Le logotype est converti en tracés : aucun fichier ne dépend de la police.
// La liste des fichiers produits est contrôlée par `apps/web/tests/brand-assets.test.ts`.
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
const INK = "#15161A";
const WHITE = "#FFFFFF";
const LEMON = "#C6F432";
const BLACK = "#000000";

// La marque, dans un carré de 160. Couloirs de 18,4 d'épaisseur, séparés par une ligne de 8.
const rect = (x, y, width, height, fill) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
const glyph = ({ fill = WHITE, accent = LEMON, small = false } = {}) =>
  small
    ? // Sous 32 px, la ligne entre les couloirs se bouche : la lettre est pleine.
      [rect(25.6, 32, 108.8, 44.8, fill), rect(57.6, 32, 44.8, 102.4, fill), rect(57.6, 121.6, 44.8, 12.8, accent)].join("")
    : [
        rect(25.6, 32, 108.8, 18.4, fill),
        rect(25.6, 58.4, 50.4, 18.4, fill),
        rect(84, 58.4, 50.4, 18.4, fill),
        rect(57.6, 58.4, 18.4, 76, fill),
        rect(84, 58.4, 18.4, 76, fill),
        rect(57.6, 121.6, 44.8, 12.8, accent),
      ].join("");

const svg = (viewBox, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="Tartan">\n${body}\n</svg>`;

// L'icône : la marque sur son carré. `rounded` arrondit les coins, pour le web ; les systèmes arrondissent les leurs.
const icon = ({ background = BRICK, fill = WHITE, accent = LEMON, small = false, rounded = true } = {}) =>
  svg(
    "0 0 160 160",
    `<defs><clipPath id="c"><rect width="160" height="160" rx="${rounded ? 36 : 0}"/></clipPath></defs>\n<g clip-path="url(#c)">${rect(0, 0, 160, 160, background)}${glyph({ fill, accent, small })}</g>`,
  );

// La marque seule, sans fond, dans un cadre plus large : `margin` laisse la zone sûre des icônes masquées.
const bare = ({ fill = WHITE, accent = LEMON, small = false, margin = 0, background } = {}) =>
  svg(
    `${-margin} ${-margin} ${160 + 2 * margin} ${160 + 2 * margin}`,
    `${background ? rect(-margin, -margin, 160 + 2 * margin, 160 + 2 * margin, background) : ""}${glyph({ fill, accent, small })}`,
  );

// Le mot « Tartan » dont le T est la marque (en-tête du site, décision du fondateur du 23 novembre 2026). La marque
// prend la hauteur des capitales de Barlow Condensed Bold, pied de la ligne d'arrivée sur la ligne de base, et
// « artan » la suit à la même distance que ses lettres entre elles : les bras carrés de la marque ne laissent pas le
// « a » se glisser dessous comme derrière le T de la police. Deux masques d'un même cadre, que le site peint en CSS
// dans la couleur du texte : la lettre et « artan », puis la ligne d'arrivée.
const wordmark = () => {
  const size = 150;
  const [t, a, r] = font.stringToGlyphs("Tar");
  const scale = size / font.unitsPerEm;
  const tBox = t.getPath(0, 0, size).getBoundingBox();
  const cap = -tBox.y1;
  const g = cap / 102.4;
  const glyphRight = tBox.x1 + 108.8 * g;
  const aBox = a.getBoundingBox();
  // L'écart visible entre « a » et « r » dans le mot, repris entre la marque et « a ».
  const gap = (a.advanceWidth + font.getKerningValue(a, r) + r.getBoundingBox().x1 - aBox.x2) * scale;
  const after = glyphRight + gap - aBox.x1 * scale;
  const rest = font.getPath("artan", after, 0, size);
  const restBox = rest.getBoundingBox();
  const x = Math.floor(tBox.x1);
  const width = Math.ceil(restBox.x2) - x;
  const bottom = Math.max(0, Math.ceil(restBox.y2));
  const height = Math.ceil(cap) + bottom;
  const at = `translate(${(tBox.x1 - 25.6 * g).toFixed(3)} ${(-cap - 32 * g).toFixed(3)}) scale(${g.toFixed(5)})`;
  const viewBox = `${x} ${-Math.ceil(cap)} ${width} ${height}`;
  const letters = svg(
    viewBox,
    `<g transform="${at}">${glyph({ accent: "none" })}</g>\n<path fill="${WHITE}" d="${rest.toPathData(2)}"/>`,
  );
  const line = svg(viewBox, `<g transform="${at}">${rect(57.6, 121.6, 44.8, 12.8, LEMON)}</g>`);
  const artwork = (fill, accent) =>
    `<g transform="${at}">${glyph({ fill, accent })}</g><path fill="${fill}" d="${rest.toPathData(2)}"/>`;
  return { letters, line, width, height, artwork, viewBox };
};

const word = wordmark();
const lockup = ({ text = INK, accent = text === WHITE ? LEMON : INK } = {}) =>
  svg(word.viewBox, word.artwork(text, accent));

// L'image de partage : le logotype et la promesse sur la piste, entre deux lignes de couloir.
const share = () => {
  const line = font.getPath("La préparation physique du coach et de son groupe", 96, 462, 50);
  const lane = (y) => rect(0, y, 1200, 6, WHITE);
  return svg(
    "0 0 1200 630",
    `${rect(0, 0, 1200, 630, BRICK)}${lane(60)}${lane(78)}${lane(552)}${lane(570)}\n<svg x="96" y="150" width="720" height="189" viewBox="${word.viewBox}">${word.artwork(WHITE, LEMON)}</svg>\n<path fill="${WHITE}" d="${line.toPathData(2)}"/>`,
  );
};

const web = path.join(root, "apps/web/public");
const brand = path.join(web, "brand");
const mobile = path.join(root, "apps/mobile/assets/brand");
for (const dir of [brand, mobile]) mkdirSync(dir, { recursive: true });

const png = (source, size, out) => sharp(Buffer.from(source), { density: 600 }).resize(size, size).png().toFile(out);
// Sans transparence : iOS et l'icône d'écran d'accueil refusent un fond vide.
const opaque = (source, size, background, out) =>
  sharp(Buffer.from(source), { density: 600 }).resize(size, size).flatten({ background }).png().toFile(out);

// Web : fichiers vectoriels.
writeFileSync(path.join(brand, "icon.svg"), icon());
writeFileSync(path.join(brand, "icon-small.svg"), icon({ small: true }));
writeFileSync(path.join(brand, "icon-mono.svg"), icon({ background: INK }));
writeFileSync(path.join(brand, "logo.svg"), lockup());
writeFileSync(path.join(brand, "logo-mono.svg"), lockup({ text: INK, accent: INK }));
writeFileSync(path.join(brand, "logo-on-dark.svg"), lockup({ text: WHITE }));
writeFileSync(path.join(web, "favicon.svg"), icon({ small: true }));
writeFileSync(path.join(brand, "wordmark-letters.svg"), word.letters);
writeFileSync(path.join(brand, "wordmark-line.svg"), word.line);
console.log(`Mot « Tartan » : ${word.width} × ${word.height}.`);

// Web : onglet, écran d'accueil, PWA.
await png(icon({ small: true }), 32, path.join(web, "favicon-32.png"));
await opaque(icon({ rounded: false }), 180, BRICK, path.join(web, "apple-touch-icon.png"));
await png(icon(), 192, path.join(web, "icon-192.png"));
await png(icon(), 512, path.join(web, "icon-512.png"));
// Icône masquable : le fond va jusqu'aux bords, la marque tient dans le cercle central (80 %).
await opaque(bare({ margin: 20, background: BRICK }), 512, BRICK, path.join(web, "icon-maskable-512.png"));

// Web : logotype en image, pour les e-mails (sur la piste, texte blanc) et les documents.
await sharp(Buffer.from(lockup()), { density: 300 }).png().toFile(path.join(brand, "logo.png"));
await sharp(Buffer.from(lockup({ text: WHITE })), { density: 300 })
  .resize({ height: 72 })
  .png()
  .toFile(path.join(brand, "logo-email.png"));
await sharp(Buffer.from(share()), { density: 150 }).resize(1200, 630).flatten({ background: BRICK }).png().toFile(path.join(brand, "og.png"));

await sharp(Buffer.from(lockup({ text: WHITE })), { density: 300 })
  .resize({ width: 512 })
  .png()
  .toFile(path.join(brand, "logo-stripe.png"));
await sharp(Buffer.from(lockup({ text: WHITE })), { density: 300 })
  .resize({ width: 816 })
  .png()
  .toFile(path.join(mobile, "wordmark-light.png"));
await sharp(Buffer.from(lockup()), { density: 300 })
  .resize({ width: 816 })
  .png()
  .toFile(path.join(mobile, "wordmark-dark.png"));

// iOS : carré plein (le système arrondit), plus les variantes sombre et teintée d'iOS 18.
await opaque(icon({ rounded: false }), 1024, BRICK, path.join(mobile, "icon-ios.png"));
await png(bare(), 1024, path.join(mobile, "icon-ios-dark.png"));
await opaque(bare({ accent: WHITE, background: BLACK }), 1024, BLACK, path.join(mobile, "icon-ios-tinted.png"));

// Android adaptatif : la marque dans la zone sûre (66 %), un fond piste, et la silhouette des icônes à thème.
await png(bare({ margin: 44 }), 1024, path.join(mobile, "adaptive-foreground.png"));
await png(bare({ margin: 44, accent: WHITE }), 1024, path.join(mobile, "adaptive-monochrome.png"));
await sharp({ create: { width: 1024, height: 1024, channels: 3, background: BRICK } })
  .png()
  .toFile(path.join(mobile, "adaptive-background.png"));
// Google Play applique son propre masque au PNG carré.
await png(icon({ rounded: false }), 512, path.join(mobile, "play-store-512.png"));

// Écran de lancement : la marque seule, posée sur la piste par la configuration de l'app.
await png(bare({ margin: 16 }), 1024, path.join(mobile, "splash.png"));
// Notification Android : silhouette blanche sur fond transparent.
await png(bare({ accent: WHITE, small: true }), 96, path.join(mobile, "notification.png"));

console.log("Logo et icônes générés.");
