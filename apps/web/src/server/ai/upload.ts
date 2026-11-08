import "server-only";
import { createPlannerTranscriptionInput } from "@tartan/contracts";
import { PLANNER_MAX_AUDIO_BYTES } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { AppError } from "@/lib/errors";

const invalid = () => new AppError(400, "planner_audio_invalid", m.aiPlanner.audioInvalid);
// À appeler après contrôle de l’acteur, de l’espace et du drapeau. La limite
// s’applique au flux réel, même si Content-Length manque ou est mensonger.
export async function readPlannerUpload(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  const max = PLANNER_MAX_AUDIO_BYTES + 4096;
  if (!type.startsWith("multipart/form-data;") || !request.body || Number(request.headers.get("content-length")) > max)
    throw invalid();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw invalid();
      }
      chunks.push(next.value);
    }
    const buffer = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const form = await new Response(buffer, { headers: { "Content-Type": type } }).formData();
    if (
      [...form.keys()].some((key) => key !== "metadata" && key !== "audio") ||
      form.getAll("metadata").length !== 1 ||
      form.getAll("audio").length !== 1
    )
      throw invalid();
    const metadata = form.get("metadata"),
      audio = form.get("audio");
    if (
      typeof metadata !== "string" ||
      metadata.length > 1000 ||
      !audio ||
      typeof audio === "string" ||
      !audio.size ||
      audio.size > PLANNER_MAX_AUDIO_BYTES
    )
      throw invalid();
    return {
      metadata: createPlannerTranscriptionInput.parse(JSON.parse(metadata)),
      bytes: new Uint8Array(await audio.arrayBuffer()),
    };
  } catch {
    throw invalid();
  } finally {
    reader.releaseLock();
  }
}
