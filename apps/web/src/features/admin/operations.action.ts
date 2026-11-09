"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminSpaceFeaturesInput, correctBirthDateInput, uuid } from "@tartan/contracts";
import { adminAction } from "@/lib/safe-action";
import {
  adminCorrectBirthDate,
  adminDisableAiEverywhere,
  adminRetryEmail,
  adminSetSpaceFeatures,
} from "@/server/admin.service";

export const retryEmailAction = adminAction.inputSchema(z.object({ id: uuid })).action(async ({ ctx, parsedInput }) => {
  await adminRetryEmail(ctx.actor, parsedInput.id);
  revalidatePath("/admin");
});

export const correctBirthDateAction = adminAction
  .inputSchema(correctBirthDateInput)
  .action(async ({ ctx, parsedInput }) => {
    await adminCorrectBirthDate(ctx.actor, parsedInput);
    revalidatePath("/admin");
  });

export const setSpaceFeaturesAction = adminAction
  .inputSchema(adminSpaceFeaturesInput)
  .action(async ({ ctx, parsedInput }) => {
    await adminSetSpaceFeatures(ctx.actor, parsedInput);
    revalidatePath("/admin");
  });

export const disableAiEverywhereAction = adminAction.action(async ({ ctx }) => {
  await adminDisableAiEverywhere(ctx.actor);
  revalidatePath("/admin");
});
