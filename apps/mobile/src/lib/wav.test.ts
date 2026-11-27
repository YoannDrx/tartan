import { readFileSync } from "node:fs";
import { join } from "node:path";
import { feedbackCues, renderFeedback } from "@tartan/design-tokens";
import { describe, expect, it } from "vitest";
import { encodeWav, SOUND_RATE } from "./wav";

describe("sons de retour embarqués", () => {
  it.each(feedbackCues)("%s.wav correspond à la définition partagée (relancer scripts/build-sounds.ts sinon)", (cue) => {
    const file = readFileSync(join(__dirname, "..", "..", "assets", "sounds", `${cue}.wav`));
    expect(Buffer.from(encodeWav(renderFeedback(cue, SOUND_RATE), SOUND_RATE)).equals(file)).toBe(true);
  });

  it("chaque son reste court et sans saturation", () => {
    for (const cue of feedbackCues) {
      const samples = renderFeedback(cue, SOUND_RATE);
      expect(samples.length / SOUND_RATE).toBeLessThan(0.6);
      expect(Math.max(...Array.from(samples, Math.abs))).toBeLessThanOrEqual(0.5);
    }
  });
});
