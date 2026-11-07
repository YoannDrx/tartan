"use server";

import { confirmAgeInput } from "@tartan/contracts";
import { authAction } from "@/lib/safe-action";
import { confirmBirthDate } from "@/server/age.service";

export const confirmAgeAction = authAction.inputSchema(confirmAgeInput).action(async ({ parsedInput, ctx }) => {
  await confirmBirthDate(ctx.actor.userId, parsedInput.birthDate);
});
