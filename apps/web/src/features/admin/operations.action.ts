"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { correctBirthDateInput, uuid } from "@tartan/contracts";
import { authAction } from "@/lib/safe-action";
import { adminCorrectBirthDate, adminRetryEmail } from "@/server/admin.service";

export const retryEmailAction = authAction.inputSchema(z.object({ id: uuid })).action(async ({ ctx, parsedInput }) => {
  await adminRetryEmail(ctx.actor, parsedInput.id);
  revalidatePath("/admin");
});

export const correctBirthDateAction = authAction
  .inputSchema(correctBirthDateInput)
  .action(async ({ ctx, parsedInput }) => {
    await adminCorrectBirthDate(ctx.actor, parsedInput);
    revalidatePath("/admin");
  });
