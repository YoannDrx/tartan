import { execFileSync } from "node:child_process";
import { closeSync, copyFileSync, mkdtempSync, openSync, readFileSync, readSync, rmSync, statSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stretchInPlace, type StretchedFile } from "./stretch";

const hasFfmpeg = (() => {
  try {
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

// Les mêmes opérations que le FileHandle d'expo-file-system : lecture et écriture à une position, sans tout charger.
const openFile = (path: string, stats: { largestRead: number }): StretchedFile & { close: () => void } => {
  const fd = openSync(path, "r+");
  return {
    size: statSync(path).size,
    read: async (offset, length) => {
      stats.largestRead = Math.max(stats.largestRead, length);
      const buffer = Buffer.alloc(length);
      const count = readSync(fd, buffer, 0, length, offset);
      return new Uint8Array(buffer.subarray(0, count));
    },
    write: (offset, bytes) => {
      writeSync(fd, bytes, 0, bytes.byteLength, offset);
    },
    close: () => closeSync(fd),
  };
};

const probe = (path: string) => {
  const out = execFileSync("ffprobe", [
    "-v",
    "error",
    "-count_frames",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=nb_read_frames,avg_frame_rate",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    path,
  ]).toString();
  const json = JSON.parse(out) as {
    streams: { nb_read_frames: string; avg_frame_rate: string }[];
    format: { duration: string };
  };
  const stream = json.streams[0]!;
  const [num, den] = stream.avg_frame_rate.split("/").map(Number);
  return { frames: Number(stream.nb_read_frames), fps: num! / den!, seconds: Number(json.format.duration) };
};

// Le fichier d'origine reste intact : on travaille sur une copie, comme la file d'envoi.
const stretchedCopy = async (source: string, name: string) => {
  const target = join(dirname, name);
  copyFileSync(source, target);
  const stats = { largestRead: 0 };
  const file = openFile(target, stats);
  try {
    return { target, stats, outcome: await stretchInPlace(file) };
  } finally {
    file.close();
  }
};

let dirname = "";

const generate = (name: string, rate: number, seconds: number, extra: string[] = []) => {
  const path = join(dirname, name);
  execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `testsrc=size=320x180:rate=${rate}:duration=${seconds}`,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      ...extra,
      path,
    ],
    { stdio: "ignore" },
  );
  return path;
};

describe.skipIf(!hasFfmpeg)("étirement sur un vrai fichier", () => {
  beforeAll(() => {
    dirname = mkdtempSync(join(tmpdir(), "tartan-stretch-"));
  });
  afterAll(() => {
    rmSync(dirname, { recursive: true, force: true });
  });

  it("garde les 720 images d'un clip de 3 s à 240 i/s, étiré à 30 i/s sur 24 s", async () => {
    const source = generate("clip-240.mp4", 240, 3);
    const before = readFileSync(source);
    const { target, stats, outcome } = await stretchedCopy(source, "clip-240-copie.mp4");

    expect(outcome).toEqual({ kind: "ready", fps: 240, timeScale: 8 });
    const after = probe(target);
    expect(after.frames).toBe(720);
    expect(after.fps).toBeCloseTo(30, 1);
    expect(after.seconds).toBeCloseTo(24, 0);
    // Même taille, et seul l'en-tête a changé : les images ne sont pas touchées.
    expect(statSync(target).size).toBe(before.length);
    expect(readFileSync(source).equals(before)).toBe(true);
    // Le fichier n'est jamais lu en entier : seuls les en-têtes de boîtes et l'en-tête `moov` passent en mémoire.
    expect(stats.largestRead).toBeLessThan(before.length);
  });

  it("place le temps réel d'une image au bon endroit du fichier étiré", async () => {
    const source = generate("seek-240.mp4", 240, 3);
    const { target } = await stretchedCopy(source, "seek-240-copie.mp4");
    // Image 480 : 2 s réelles, soit 16 s dans le fichier.
    const frame = (path: string, at: string) =>
      execFileSync("ffmpeg", ["-v", "error", "-ss", at, "-i", path, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], {
        maxBuffer: 1024 * 1024,
      });
    expect(frame(target, "16").equals(frame(source, "2"))).toBe(true);
  });

  it("laisse un clip à 30 i/s sans le réécrire", async () => {
    const source = generate("clip-30.mp4", 30, 2);
    const before = readFileSync(source);
    const { target, outcome } = await stretchedCopy(source, "clip-30-copie.mp4");
    expect(outcome).toEqual({ kind: "ready", fps: 30, timeScale: 1 });
    expect(readFileSync(target).equals(before)).toBe(true);
  });

  it("refuse un clip dont la durée étirée dépasse 8 minutes", async () => {
    const source = generate("long-240.mp4", 240, 61);
    const before = readFileSync(source);
    const { target, outcome } = await stretchedCopy(source, "long-240-copie.mp4");
    expect(outcome).toEqual({ kind: "too-long", maxSeconds: 60 });
    expect(readFileSync(target).equals(before)).toBe(true);
  }, 60_000);

  it("envoie tel quel un MP4 fragmenté", async () => {
    const source = generate("frag-240.mp4", 240, 1, ["-movflags", "frag_keyframe+empty_moov"]);
    const before = readFileSync(source);
    const { target, outcome } = await stretchedCopy(source, "frag-240-copie.mp4");
    expect(outcome).toEqual({ kind: "ready", fps: null, timeScale: 1 });
    expect(readFileSync(target).equals(before)).toBe(true);
  });
});

describe("fichier illisible", () => {
  it("part tel quel, sans écriture", async () => {
    let written = false;
    const bytes = new TextEncoder().encode("ceci n'est pas une vidéo, juste du texte assez long");
    const outcome = await stretchInPlace({
      size: bytes.length,
      read: async (offset, length) => bytes.slice(offset, offset + length),
      write: () => {
        written = true;
      },
    });
    expect(outcome).toEqual({ kind: "ready", fps: null, timeScale: 1 });
    expect(written).toBe(false);
  });
});
