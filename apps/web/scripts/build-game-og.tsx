/* eslint-disable @next/next/no-img-element -- Satori dessine l'image : next/image n'y existe pas. */
// Tire l'image de partage de /jeu (1200 × 630), une fois pour toutes : public/brand/og-jeu.png.
// Lancer après un changement du groupe ou des textes : pnpm --filter @tartan/web og:jeu
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tokens } from "@tartan/design-tokens";
import { athletePaint } from "@tartan/design-tokens/athletes";
import { m } from "@tartan/i18n";
import { athleteRig } from "@tartan/mascot/athletes";
import { hurdlerPose } from "@tartan/mascot/hurdles";
import { svgAthlete } from "@tartan/mascot/svg";
import { ImageResponse } from "next/og";
import { dataUri, figureSvg } from "../src/lib/figure-svg";

const root = path.resolve(import.meta.dirname, "..");
const [condensed, barlow, logo] = await Promise.all([
  readFile(path.join(root, "assets", "fonts", "BarlowCondensed_700Bold.ttf")),
  readFile(path.join(root, "assets", "fonts", "Barlow_600SemiBold.ttf")),
  readFile(path.join(root, "public", "brand", "logo-on-dark.svg")),
]);
// Inès au-dessus d'une haie, au sommet de son saut.
const athlete = figureSvg(
  svgAthlete(athleteRig("hurdles", "effort"), hurdlerPose(500, 0.5), athletePaint("hurdles", "piste")),
  "-200 -280 400 460",
);
const { band } = tokens;
const lane = { display: "flex", width: "100%", height: 8, backgroundColor: band.lane };
const image = new ImageResponse(
  (
    <div style={{ display: "flex", width: "100%", height: "100%", backgroundColor: band.background, color: band.text }}>
      <div style={{ display: "flex", flexDirection: "column", padding: "64px 72px", gap: 20, width: 700 }}>
        <img src={dataUri(logo.toString())} height={56} width={200} alt="" />
        <div style={{ display: "flex", fontFamily: "Barlow Condensed", fontSize: 112, lineHeight: 1, marginTop: 40 }}>
          {m.game.title}
        </div>
        <div style={{ display: "flex", fontFamily: "Barlow", fontSize: 36 }}>{m.game.event}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "flex-end" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <img src={dataUri(athlete)} width={360} height={414} alt="" />
        </div>
        <div style={{ ...lane }} />
        <div style={{ display: "flex", height: 22 }} />
        <div style={{ ...lane }} />
        <div style={{ display: "flex", height: 60 }} />
      </div>
    </div>
  ),
  {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Barlow Condensed", data: condensed, weight: 700, style: "normal" },
      { name: "Barlow", data: barlow, weight: 600, style: "normal" },
    ],
  },
);
await writeFile(path.join(root, "public", "brand", "og-jeu.png"), Buffer.from(await image.arrayBuffer()));
