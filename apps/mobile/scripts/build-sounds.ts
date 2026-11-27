// Produit les sons de l'app native à partir de `@tartan/design-tokens` (feedback.ts) : WAV mono, 16 bits.
// Les mêmes échantillons sont joués en direct par le web ; un test vérifie que les fichiers sont à jour.
//   corepack pnpm --filter @tartan/mobile exec tsx scripts/build-sounds.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { feedbackCues, renderFeedback } from "@tartan/design-tokens";
import { encodeWav, SOUND_RATE } from "../src/lib/wav";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "sounds");
mkdirSync(out, { recursive: true });
for (const cue of feedbackCues) {
  writeFileSync(join(out, `${cue}.wav`), encodeWav(renderFeedback(cue, SOUND_RATE), SOUND_RATE));
  console.log(`${cue}.wav`);
}
