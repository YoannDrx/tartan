"use server";

import { platformSettingsInput } from "@tartan/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/lib/safe-action";
import { updatePlatformSettings } from "@/server/platform-settings.service";
import {
  addPlatformAdmin,
  adminReconcileVideos,
  removePlatformAdmin,
  sendTestEmails,
} from "@/server/production-status.service";

const PAGE = "/admin/configuration";
const email = z.object({ email: z.string() });

export const updatePlatformSettingsAction = adminAction
  .inputSchema(platformSettingsInput)
  .action(async ({ ctx, parsedInput }) => {
    await updatePlatformSettings(ctx.actor, parsedInput);
    revalidatePath(PAGE);
    revalidatePath("/");
    revalidatePath("/tarifs");
  });

export const addPlatformAdminAction = adminAction.inputSchema(email).action(async ({ ctx, parsedInput }) => {
  await addPlatformAdmin(ctx.actor, parsedInput.email);
  revalidatePath(PAGE);
});

export const removePlatformAdminAction = adminAction.inputSchema(email).action(async ({ ctx, parsedInput }) => {
  await removePlatformAdmin(ctx.actor, parsedInput.email);
  revalidatePath(PAGE);
});

export const sendTestEmailsAction = adminAction
  .inputSchema(z.object({ to: z.email(), key: z.string().min(1).max(40) }))
  .action(async ({ ctx, parsedInput }) => sendTestEmails(ctx.actor, parsedInput));

export const reconcileVideosAction = adminAction.action(async ({ ctx }) => {
  const result = await adminReconcileVideos(ctx.actor);
  revalidatePath(PAGE);
  return result;
});
