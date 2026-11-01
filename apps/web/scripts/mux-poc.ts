// Preuve de concept Mux (§ 11.5) : envoie un clip, attend l'encodage, vérifie la lecture signée, puis supprime l'essai.
// Usage : pnpm --filter @tartan/web exec tsx --env-file=.env scripts/mux-poc.ts <fichier vidéo>
import { readFileSync, writeFileSync } from "node:fs";
import { planStretch } from "@tartan/domain";
import Mux from "@mux/mux-node";
import { createDirectUpload, signedPlayback } from "@/lib/mux";

const file = process.argv[2];
if (!file) throw new Error("Indique un fichier vidéo.");
const mux = new Mux({ tokenId: process.env.MUX_TOKEN_ID, tokenSecret: process.env.MUX_TOKEN_SECRET });
const { uploadId, url } = await createDirectUpload("poc:essai");
const source = readFileSync(file);
const plan = await planStretch(async (offset, length) => new Uint8Array(source.subarray(offset, offset + length)), source.length);
console.log("source", plan?.fps, "i/s, étirement ×", plan?.timeScale);
if (plan?.patch) source.set(plan.patch.bytes, plan.patch.offset);
const put = await fetch(url, { method: "PUT", body: source });
console.log("envoi", put.status);
let assetId: string | undefined;
for (let i = 0; i < 60 && !assetId; i += 1) {
  assetId = (await mux.video.uploads.retrieve(uploadId)).asset_id ?? undefined;
  if (!assetId) await new Promise((r) => setTimeout(r, 2000));
}
if (!assetId) throw new Error("Pas d'asset créé.");
let asset = await mux.video.assets.retrieve(assetId);
for (let i = 0; i < 90 && asset.status === "preparing"; i += 1) {
  await new Promise((r) => setTimeout(r, 2000));
  asset = await mux.video.assets.retrieve(assetId);
}
const track = asset.tracks?.find((t) => t.type === "video");
console.log("statut", asset.status, "| durée", asset.duration, "| i/s", track?.max_frame_rate, "|", track?.max_width, "x", track?.max_height);
console.log("renditions", JSON.stringify(asset.static_renditions?.files?.map((f) => [f.name, f.status]) ?? null));
const playbackId = asset.playback_ids?.[0]?.id;
if (playbackId) {
  for (let i = 0; i < 60; i += 1) {
    asset = await mux.video.assets.retrieve(assetId);
    if (asset.static_renditions?.files?.every((f) => f.status !== "preparing" && f.status !== "skipped")) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log("renditions finales", JSON.stringify(asset.static_renditions?.files?.map((f) => [f.name, f.status, f.height]) ?? null));
  const links = await signedPlayback(playbackId);
  for (const [name, link] of Object.entries(links)) {
    const res = await fetch(link, { method: "GET", headers: { Range: "bytes=0-1023" } });
    console.log(name, res.status, res.headers.get("content-type"));
  }
  // Le pas image par image dépend de la cadence réelle du MP4 servi, pas de celle annoncée.
  const mp4 = await fetch(links.mp4Url);
  writeFileSync(process.env.POC_OUT ?? "/tmp/tartan-poc.mp4", Buffer.from(await mp4.arrayBuffer()));
  const unsigned = await fetch(`https://stream.mux.com/${playbackId}.m3u8`);
  console.log("sans jeton", unsigned.status);
}
await mux.video.assets.delete(assetId);
console.log("essai supprimé");
