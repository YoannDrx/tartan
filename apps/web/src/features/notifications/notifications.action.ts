"use server";

import { markNotificationsInput, preferencesInput, releaseSeenInput } from "@tartan/contracts";
import { revalidatePath } from "next/cache";
import { authAction } from "@/lib/safe-action";
import { updatePreferences } from "@/server/me.service";
import { markNotificationsRead } from "@/server/notify.service";
import { markReleaseSeen } from "@/server/releases.service";

export const markNotificationsReadAction = authAction
  .inputSchema(markNotificationsInput)
  .action(async ({ parsedInput, ctx }) => {
    await markNotificationsRead(ctx.actor.userId, parsedInput);
    revalidatePath("/notifications");
  });

export const saveNotificationPreferencesAction = authAction
  .inputSchema(preferencesInput)
  .action(async ({ parsedInput, ctx }) => {
    await updatePreferences(ctx.actor.userId, parsedInput);
    revalidatePath("/reglages");
  });

export const markReleaseSeenAction = authAction.inputSchema(releaseSeenInput).action(async ({ parsedInput, ctx }) => {
  await markReleaseSeen(ctx.actor.userId, parsedInput.releaseId);
});
