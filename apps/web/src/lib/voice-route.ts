import { uuid } from "@tartan/contracts";
import type { z } from "zod";
import { invalid, unauthorized } from "./errors";
import { getActorFrom } from "./session";
import { handleRouteError } from "./zod-route";

export function voiceRoute<P>(
  paramsSchema: z.ZodType<P>,
  run: (request: Request, userId: string, params: P) => Promise<Response>,
) {
  return async (request: Request, context: { params: Promise<P> }) => {
    try {
      const actor = await getActorFrom(request.headers);
      if (!actor) throw unauthorized();
      const params = paramsSchema.safeParse(await context.params);
      if (!params.success) throw invalid();
      return await run(request, actor.userId, params.data);
    } catch (error) {
      return handleRouteError(error);
    }
  };
}

export function optionalVoiceTarget(request: Request, key: string) {
  const raw = new URL(request.url).searchParams.get(key);
  if (raw === null) return undefined;
  const parsed = uuid.safeParse(raw);
  if (!parsed.success) throw invalid();
  return parsed.data;
}
