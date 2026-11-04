"use server";

import { cookies } from "next/headers";
import { acceptInvitationInput, createInvitationInput, parentalConsentInput, uuid } from "@tartan/contracts";
import { z } from "zod";
import { action, authAction } from "@/lib/safe-action";
import { spaceAction } from "@/features/shell/space-action";
import { SPACE_COOKIE } from "@/features/shell/space";
import { answerParentalConsent } from "@/server/consent.service";
import {
  acceptInvitation,
  createInvitation,
  groupInvitationLink,
  resendInvitation,
  regenerateInvitationLink,
  revokeInvitation,
} from "@/server/invitation.service";

export const acceptInvitationAction = authAction
  .inputSchema(acceptInvitationInput.extend({ token: z.string().min(16) }))
  .action(async ({ parsedInput: { token, ...input }, ctx }) => {
    const jar = await cookies();
    const res = await acceptInvitation(ctx.actor, token, {
      ...input,
      referralCode: input.referralCode ?? jar.get("tartan_ref")?.value,
    });
    jar.set(SPACE_COOKIE, res.organizationId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    return res;
  });

export const answerParentalAction = action.inputSchema(parentalConsentInput).action(async ({ parsedInput }) => {
  await answerParentalConsent(parsedInput);
});

export const createInvitationAction = spaceAction
  .inputSchema(createInvitationInput)
  .action(({ parsedInput, ctx }) => createInvitation(ctx.userId, ctx.organizationId, parsedInput));

export const groupLinkAction = spaceAction
  .inputSchema(z.object({ groupId: uuid }))
  .action(({ parsedInput, ctx }) => groupInvitationLink(ctx.userId, ctx.organizationId, parsedInput.groupId));

export const regenerateInvitationLinkAction = spaceAction
  .inputSchema(z.object({ id: uuid }))
  .action(({ parsedInput, ctx }) => regenerateInvitationLink(ctx.userId, ctx.organizationId, parsedInput.id));

export const revokeInvitationAction = spaceAction
  .inputSchema(z.object({ id: uuid }))
  .action(({ parsedInput, ctx }) => revokeInvitation(ctx.userId, ctx.organizationId, parsedInput.id));

export const resendInvitationAction = spaceAction
  .inputSchema(z.object({ id: uuid }))
  .action(({ parsedInput, ctx }) => resendInvitation(ctx.userId, ctx.organizationId, parsedInput.id));
