// Le moteur tourne dans un worker de même origine. Les deux variantes WASM couvrent aussi les appareils sans SIMD.
import { build } from "esbuild";
import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const target = "public/portrait/runtime";
await mkdir(target, { recursive: true });
await cp(path.join(path.dirname(require.resolve("@mediapipe/tasks-vision")), "wasm"), target, { recursive: true });
await build({
  entryPoints: ["src/features/avatar/portrait.worker.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: target + "/worker.js",
  minify: true,
});
