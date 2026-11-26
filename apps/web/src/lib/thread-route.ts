import { uuid } from "@tartan/contracts";
import { z } from "zod";
import { invalid } from "./errors";
import { optionalVoiceTarget } from "./voice-route";

export const threadMessageParams = z.object({
  orgId: uuid,
  sessionId: uuid,
  messageId: z.union([z.literal("root"), uuid]),
});
export function threadTarget(request: Request) {
  const query = new URL(request.url).searchParams;
  const itemRef = query.get("itemRef") ?? undefined;
  if (
    (itemRef !== undefined && (!itemRef.length || itemRef.length > 256)) ||
    query.getAll("itemRef").length > 1 ||
    query.getAll("athleteId").length > 1
  )
    throw invalid();
  return { itemRef, athleteId: optionalVoiceTarget(request, "athleteId") };
}
