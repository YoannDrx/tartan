import { w } from "@tartan/i18n/web";
import { NextResponse } from "next/server";
import { invalid, unauthorized } from "@/lib/errors";
import { MAX_UPLOAD_BYTES } from "@/lib/image-check";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getActorFrom } from "@/lib/session";
import { handleRouteError } from "@/lib/zod-route";
import { getMe, saveAvatar } from "@/server/me.service";

// La photo de profil envoyée par l'app native : un carré déjà recadré sur le téléphone, dans le champ `file`.
// Même contrôle que l'action du web (`saveAvatar` : type déclaré et réel, poids, carré de 128 à 1 024 px).
// Le corps est borné avant toute analyse, et rien de l'image n'est journalisé.

// Le multipart ajoute ses délimiteurs et ses en-têtes autour du fichier.
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 16 * 1024;
// Un envoi par geste : assez pour essayer plusieurs photos, trop peu pour remplir le stockage.
const UPLOADS_PER_HOUR = 20;

const readBoundedForm = async (request: Request): Promise<FormData> => {
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data;") || !request.body) throw invalid(w.profile.errors.serverType);
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw invalid(w.profile.errors.serverSize);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      // La limite tient sur le flux réel, même si `Content-Length` manque ou ment.
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw invalid(w.profile.errors.serverSize);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Response(buffer, { headers: { "Content-Type": type } }).formData().catch(() => {
    throw invalid(w.profile.errors.serverType);
  });
};

export async function POST(request: Request) {
  try {
    const actor = await getActorFrom(request.headers);
    if (!actor) throw unauthorized();
    await enforceRateLimit(`avatar:${actor.userId}`, UPLOADS_PER_HOUR, 3600);
    const form = await readBoundedForm(request);
    const file = form.get("file");
    if (!(file instanceof File) || form.getAll("file").length !== 1) throw invalid(w.profile.errors.serverType);
    await saveAvatar(actor.userId, file);
    return NextResponse.json(await getMe(actor.userId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return handleRouteError(error);
  }
}
