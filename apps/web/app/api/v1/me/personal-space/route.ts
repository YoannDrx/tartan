import { createPersonalSpaceInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { createPersonalSpace } from "@/server/personal-space.service";

// L'athlète qui s'entraîne seul ouvre son espace personnel : un seul par compte, le redemander y ramène.
export const POST = authRoute
  .body(createPersonalSpaceInput)
  .handler(async (_req, { ctx, body }) => createPersonalSpace(ctx.actor.userId, body));
