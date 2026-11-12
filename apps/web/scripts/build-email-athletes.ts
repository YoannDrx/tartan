// Tire les athlètes des e-mails en PNG, au double de leur taille affichée, sur fond transparent.
// Lancer après un changement du groupe : pnpm --filter @tartan/web email:athletes
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { Athlete } from "../src/components/athlete";
import { EMAIL_ATHLETE_HEIGHT, EMAIL_ATHLETES, emailAthletePath } from "../emails/athletes";

const root = path.resolve(import.meta.dirname, "..", "public");
for (const [name, { id, pose, face }] of Object.entries(EMAIL_ATHLETES)) {
  const svg = renderToStaticMarkup(
    createElement(Athlete, { id, pose, face, on: "piste", view: "raised", xmlns: "http://www.w3.org/2000/svg" }),
  );
  const out = path.join(root, emailAthletePath(name as keyof typeof EMAIL_ATHLETES));
  await sharp(Buffer.from(svg), { density: 300 })
    .resize({ height: EMAIL_ATHLETE_HEIGHT * 2 })
    .png({ compressionLevel: 9, palette: true })
    .toFile(out);
  console.info(out);
}
