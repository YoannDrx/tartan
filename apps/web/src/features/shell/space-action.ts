import { authAction } from "@/lib/safe-action";
import { currentOrganizationId } from "./space";

export const spaceAction = authAction.use(async ({ ctx, next }) =>
  next({ ctx: { ...ctx, userId: ctx.actor.userId, organizationId: await currentOrganizationId(ctx.actor) } }),
);
