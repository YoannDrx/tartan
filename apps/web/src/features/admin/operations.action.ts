"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminSpaceFeaturesInput, correctBirthDateInput, uuid } from "@tartan/contracts";
import { authAction } from "@/lib/safe-action";
import {
  adminCorrectBirthDate,
  adminDisableAiEverywhere,
  adminRetryEmail,
  adminSetSpaceFeatures,
} from "@/server/admin.service";

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

export const setSpaceFeaturesAction = authAction
  .inputSchema(adminSpaceFeaturesInput)
  .action(async ({ ctx, parsedInput }) => {
    await adminSetSpaceFeatures(ctx.actor, parsedInput);
    revalidatePath("/admin");
  });

export const disableAiEverywhereAction = authAction.action(async ({ ctx }) => {
  await adminDisableAiEverywhere(ctx.actor);
  revalidatePath("/admin");
});
