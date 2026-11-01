"use server";

import { z } from "zod";
import { spaceAction } from "@/features/shell/space-action";
import { createCheckout, createPortal } from "@/server/billing.service";

export const checkoutAction = spaceAction
  .inputSchema(z.object({ plan: z.enum(["coach", "club"]), interval: z.enum(["month", "year"]) }))
  .action(async ({ parsedInput, ctx }) => createCheckout(ctx.userId, ctx.organizationId, parsedInput));

export const portalAction = spaceAction.action(async ({ ctx }) => createPortal(ctx.userId, ctx.organizationId));
