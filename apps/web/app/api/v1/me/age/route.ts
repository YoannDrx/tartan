import { confirmAgeInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { confirmBirthDate } from "@/server/age.service";
import { getMe } from "@/server/me.service";

// Compte sans date : première écriture seulement. 403 age_restricted pour une date mineure, 409 ensuite.
export const POST = authRoute.body(confirmAgeInput).handler(async (_req, { ctx, body }) => {
  await confirmBirthDate(ctx.actor.userId, body.birthDate);
  return getMe(ctx.actor.userId);
});
