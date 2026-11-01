import { createOrganizationInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { createOrganization } from "@/server/org.service";

export const POST = authRoute.body(createOrganizationInput).handler(async (_req, { ctx, body }) => {
  const org = await createOrganization(ctx.actor.userId, body);
  return { organizationId: org.id, firstGroupId: org.firstGroupId };
});
