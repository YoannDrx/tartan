import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { inspectPlannerAudio } from "@/server/ai/audio";
import { PLANNER_MAX_AUDIO_BYTES } from "@tartan/domain";
// PCM silencieux généré en mémoire ; ni voix, ni donnée personnelle.
const wave = (seconds: number) => {
  const samples = Math.round(seconds * 8000),
    bytes = Buffer.alloc(44 + samples * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.byteLength - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples * 2, 40);
  return new Uint8Array(bytes);
};
it.each([0.5, 2, 179.5, 180])("mesure un WAV de %s secondes sans durée fournie par le client", async (seconds) => {
  const audio = await inspectPlannerAudio(wave(seconds));
  expect(audio.durationSeconds).toBeCloseTo(seconds, 4);
  expect(audio.audioSeconds).toBe(Math.ceil(seconds));
  expect(audio.mimeType).toBe("audio/wav");
});
it("refuse une durée supérieure à trois minutes même sous la limite d'octets", async () => {
  const bytes = wave(180.125);
  expect(bytes.byteLength).toBeLessThan(PLANNER_MAX_AUDIO_BYTES);
  await expect(inspectPlannerAudio(bytes)).rejects.toMatchObject({ code: "planner_audio_invalid" });
});
it.each(["silence.m4a", "silence-live.webm"])(
  "lit les paquets de %s, y compris sans durée de conteneur",
  async (name) => {
    const bytes = new Uint8Array(await readFile(new URL(`./fixtures/planner-audio/${name}`, import.meta.url)));
    const audio = await inspectPlannerAudio(bytes);
    expect(audio.durationSeconds).toBeGreaterThanOrEqual(1.99);
    expect(audio.durationSeconds).toBeLessThan(2.1);
    expect(audio.mimeType).toBe(name.endsWith("webm") ? "audio/webm" : "audio/mp4");
  },
);
it.each([
  new Uint8Array(),
  new Uint8Array(PLANNER_MAX_AUDIO_BYTES + 1),
  new TextEncoder().encode("un fichier prétendument audio"),
  wave(2).slice(0, 20),
])("refuse vide, trop gros, non audio ou tronqué", async (bytes) => {
  await expect(inspectPlannerAudio(bytes)).rejects.toMatchObject({ status: 400, code: "planner_audio_invalid" });
});

it.each(["too-long.m4a", "too-long-live.webm", "two-tracks.m4a", "video-only.mp4"])(
  "refuse %s avant toute transcription",
  async (name) => {
    const bytes = new Uint8Array(await readFile(new URL(`./fixtures/planner-audio/${name}`, import.meta.url)));
    expect(bytes.byteLength).toBeLessThan(PLANNER_MAX_AUDIO_BYTES);
    await expect(inspectPlannerAudio(bytes)).rejects.toMatchObject({ code: "planner_audio_invalid" });
  },
);
