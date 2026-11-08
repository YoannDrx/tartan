"use server";

import { uuid } from "@tartan/contracts";
import { refundReasons } from "@tartan/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/lib/safe-action";
import {
  adminCancelAtPeriodEnd,
  adminConfirmStore,
  adminDeleteUser,
  adminExtendTrial,
  adminGrantPlan,
  adminResendVerification,
  adminSetMinimumVersion,
  adminSetSuspended,
  adminStopRollout,
} from "@/server/admin-console.service";
import { confirmRefund, prepareRefund } from "@/server/billing-refund.service";

const userId = z.object({ userId: uuid });

export const resendVerificationAction = adminAction.inputSchema(userId).action(async ({ ctx, parsedInput }) => {
  await adminResendVerification(ctx.actor, parsedInput.userId);
});

export const setSuspendedAction = adminAction
  .inputSchema(userId.extend({ suspended: z.boolean() }))
  .action(async ({ ctx, parsedInput }) => {
    await adminSetSuspended(ctx.actor, parsedInput.userId, parsedInput.suspended);
    revalidatePath(`/admin/utilisateurs/${parsedInput.userId}`);
  });

export const deleteUserAction = adminAction.inputSchema(userId).action(async ({ ctx, parsedInput }) => {
  await adminDeleteUser(ctx.actor, parsedInput.userId);
  revalidatePath("/admin/utilisateurs");
});

export const grantPlanAction = adminAction
  .inputSchema(z.object({ organizationId: uuid, plan: z.enum(["discovery", "coach", "club", "pilot"]) }))
  .action(async ({ ctx, parsedInput }) => {
    await adminGrantPlan(ctx.actor, parsedInput.organizationId, parsedInput.plan);
    revalidatePath(`/admin/espaces/${parsedInput.organizationId}`);
  });

export const cancelAtPeriodEndAction = adminAction
  .inputSchema(z.object({ subscriptionId: uuid }))
  .action(async ({ ctx, parsedInput }) => {
    await adminCancelAtPeriodEnd(ctx.actor, parsedInput.subscriptionId);
    revalidatePath("/admin/abonnements");
  });

export const extendTrialAction = adminAction
  .inputSchema(z.object({ subscriptionId: uuid, days: z.number().int().min(1).max(60) }))
  .action(async ({ ctx, parsedInput }) => {
    await adminExtendTrial(ctx.actor, parsedInput.subscriptionId, parsedInput.days);
    revalidatePath("/admin/abonnements");
  });

export const prepareRefundAction = adminAction
  .inputSchema(
    z.object({
      invoiceId: z.string().min(1).max(100),
      amountCents: z.number().int().positive(),
      reasonCode: z.enum(refundReasons),
      withdrawal: z.boolean(),
      note: z.string().trim().max(500).nullable(),
    }),
  )
  .action(async ({ ctx, parsedInput }) => prepareRefund(ctx.actor, parsedInput));

export const confirmRefundAction = adminAction
  .inputSchema(
    z.object({ refundId: uuid, token: z.string().min(1).max(100), amountCents: z.number().int().positive() }),
  )
  .action(async ({ ctx, parsedInput }) => {
    const result = await confirmRefund(ctx.actor, parsedInput);
    revalidatePath("/admin/factures");
    return result;
  });

export const confirmStoreAction = adminAction
  .inputSchema(z.object({ id: uuid }))
  .action(async ({ ctx, parsedInput }) => {
    await adminConfirmStore(ctx.actor, parsedInput.id);
    revalidatePath("/admin/versions");
  });

export const stopRolloutAction = adminAction
  .inputSchema(z.object({ id: uuid }))
  .action(async ({ ctx, parsedInput }) => {
    await adminStopRollout(ctx.actor, parsedInput.id);
    revalidatePath("/admin/versions");
  });

export const setMinimumVersionAction = adminAction
  .inputSchema(
    z.object({
      platform: z.enum(["ios", "android"]),
      minimumVersion: z
        .string()
        .regex(/^\d+\.\d+\.\d+$/)
        .nullable(),
      reason: z.string().trim().max(200).nullable(),
    }),
  )
  .action(async ({ ctx, parsedInput }) => {
    await adminSetMinimumVersion(ctx.actor, parsedInput);
    revalidatePath("/admin/versions");
  });
