"use server";

import { revalidatePath } from "next/cache";
import { historyShareInput, uuid } from "@tartan/contracts";
import { z } from "zod";
import { authAction } from "@/lib/safe-action";
import { revokeHistoryShare, shareHistory } from "@/server/history-share.service";

export const shareHistoryAction = authAction
  .inputSchema(historyShareInput)
  .action(async ({ parsedInput, ctx }) => shareHistory(ctx.actor.userId, parsedInput));

export const revokeHistoryShareAction = authAction
  .inputSchema(z.object({ organizationId: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    await revokeHistoryShare(ctx.actor.userId, parsedInput.organizationId);
    revalidatePath("/reglages/confidentialite");
  });
