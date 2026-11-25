import "server-only";
import { PLANNER_MAX_AUDIO_BYTES } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { AppError } from "./errors";
import { inspectRecordedAudio } from "./recorded-audio";

const invalidVoice = () => new AppError(400, "voice_invalid", m.errors.voiceInvalid);
const audioTypes = ["audio/webm", "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/wav", "audio/x-wav"];

export async function readVoiceUpload(request: Request) {
  const type = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (
    !request.body ||
    !audioTypes.includes(type) ||
    Number(request.headers.get("content-length")) > PLANNER_MAX_AUDIO_BYTES
  )
    throw invalidVoice();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > PLANNER_MAX_AUDIO_BYTES) {
        await reader.cancel();
        throw invalidVoice();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return inspectRecordedAudio(bytes, invalidVoice);
}

// Safari et les lecteurs natifs demandent parfois les deux premiers octets
// pour découvrir la taille, puis une plage à partir de la position de lecture.
export function voiceResponse(request: Request, clip: { mimeType: string; bytes: Uint8Array }) {
  const { bytes } = clip;
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Type": clip.mimeType,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const range = request.headers.get("range");
  let start = 0;
  let end = bytes.byteLength - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match?.[1]) {
      start = Number(match[1]);
      if (match[2]) end = Math.min(end, Number(match[2]));
    } else if (match?.[2]) {
      start = Math.max(0, bytes.byteLength - Number(match[2]));
    }
    if (!match || (!match[1] && !match[2]) || start > end) {
      headers.set("Content-Range", `bytes */${bytes.byteLength}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${bytes.byteLength}`);
  }
  headers.set("Content-Length", String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), { status: range ? 206 : 200, headers });
}
