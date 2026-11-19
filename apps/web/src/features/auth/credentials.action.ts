"use server";

import { changePasswordInput, setPasswordInput } from "@tartan/contracts";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { authAction } from "@/lib/safe-action";
import {
  changePassword,
  definePassword,
  dismissPasswordPrompt,
  requestPasswordSetupConfirmation,
} from "@/server/credentials.service";

// Les mêmes services que l'API `/api/v1/me/password` du mobile : l'écran et l'application ne divergent pas.

export const definePasswordAction = authAction.inputSchema(setPasswordInput).action(async ({ parsedInput, ctx }) => {
  const result = await definePassword(ctx.actor, parsedInput, await headers());
  revalidatePath("/", "layout");
  return result;
});

export const requestPasswordSetupAction = authAction.action(async ({ ctx }) => {
  await requestPasswordSetupConfirmation(ctx.actor, await headers());
});

export const changePasswordAction = authAction.inputSchema(changePasswordInput).action(async ({ parsedInput, ctx }) => {
  await changePassword(ctx.actor, parsedInput, await headers());
  return { revoked: Boolean(parsedInput.revokeOtherSessions) };
});

export const dismissPasswordPromptAction = authAction.action(async ({ ctx }) => {
  await dismissPasswordPrompt(ctx.actor.userId);
  revalidatePath("/", "layout");
});
