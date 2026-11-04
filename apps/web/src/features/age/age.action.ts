"use server";

import { z } from "zod";
import { isoDate } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { authAction } from "@/lib/safe-action";
import { confirmBirthDate } from "@/server/age.service";

const input = z.object({ birthDate: isoDate.or(z.literal("")).refine(Boolean, m.invite.birthRequired) });

export const confirmAgeAction = authAction.inputSchema(input).action(async ({ parsedInput, ctx }) => {
  await confirmBirthDate(ctx.actor.userId, parsedInput.birthDate);
});
