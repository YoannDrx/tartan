"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { consentInput, groupInput, profileInput, uuid } from "@tartan/contracts";
import { z } from "zod";
import { authAction } from "@/lib/safe-action";
import { invalid } from "@/lib/errors";
import { m } from "@tartan/i18n";
import { spaceAction } from "@/features/shell/space-action";
import { SPACE_COOKIE } from "@/features/shell/space";
import { deleteAccount } from "@/server/account.service";
import { setConsent } from "@/server/consent.service";
import { saveAvatar, updateProfile } from "@/server/me.service";
import { deleteGroup, saveGroup, updateOrganization } from "@/server/org.service";

export const updateProfileAction = authAction.inputSchema(profileInput).action(async ({ parsedInput, ctx }) => {
  await updateProfile(ctx.actor.userId, parsedInput);
  revalidatePath("/reglages");
});

export const uploadAvatarAction = authAction
  .inputSchema(z.object({ file: z.instanceof(File) }))
  .action(async ({ parsedInput, ctx }) => {
    await saveAvatar(ctx.actor.userId, parsedInput.file);
    revalidatePath("/reglages");
  });

export const setConsentAction = authAction.inputSchema(consentInput).action(async ({ parsedInput, ctx }) => {
  await setConsent(ctx.actor.userId, parsedInput.kind, parsedInput.granted);
  revalidatePath("/", "layout");
});

export const saveGroupAction = spaceAction.inputSchema(groupInput).action(async ({ parsedInput, ctx }) => {
  const saved = await saveGroup(ctx.userId, ctx.organizationId, parsedInput);
  revalidatePath("/reglages");
  return { id: saved.id };
});

export const updateOrganizationAction = spaceAction
  .inputSchema(
    z.object({ name: z.string().trim().min(1, "Donne un nom à ton espace").max(120), overdueReminders: z.boolean() }),
  )
  .action(async ({ parsedInput, ctx }) => {
    await updateOrganization(ctx.userId, ctx.organizationId, parsedInput);
    revalidatePath("/", "layout");
  });

export const deleteGroupAction = spaceAction
  .inputSchema(z.object({ id: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteGroup(ctx.userId, ctx.organizationId, parsedInput.id);
    revalidatePath("/reglages");
  });

export const deleteAccountAction = authAction
  .inputSchema(z.object({ confirmation: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    if (parsedInput.confirmation !== m.settings.deleteConfirmWord) throw invalid("Écris SUPPRIMER pour confirmer.");
    await deleteAccount(ctx.actor.userId);
    const jar = await cookies();
    jar.delete(SPACE_COOKIE);
  });
