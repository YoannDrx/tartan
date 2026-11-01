"use server";

import { revalidatePath } from "next/cache";
import { blockUserInput, commentInput, reportContentInput, uuid } from "@tartan/contracts";
import { z } from "zod";
import { authAction } from "@/lib/safe-action";
import { spaceAction } from "@/features/shell/space-action";
import { addComment, blockUser, reportContent, resolveReport } from "@/server/comm.service";

export const addCommentAction = spaceAction
  .inputSchema(commentInput.extend({ path: z.string().startsWith("/") }))
  .action(async ({ parsedInput: { path, ...input }, ctx }) => {
    const created = await addComment(ctx.userId, ctx.organizationId, input);
    revalidatePath(path);
    return created;
  });

export const reportContentAction = spaceAction
  .inputSchema(reportContentInput)
  .action(({ parsedInput, ctx }) => reportContent(ctx.userId, ctx.organizationId, parsedInput));

export const blockUserAction = authAction
  .inputSchema(blockUserInput.extend({ path: z.string().startsWith("/") }))
  .action(async ({ parsedInput, ctx }) => {
    await blockUser(ctx.actor.userId, parsedInput.userId);
    revalidatePath(parsedInput.path);
  });

export const resolveReportAction = spaceAction
  .inputSchema(z.object({ id: uuid, removeContent: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    await resolveReport(ctx.userId, ctx.organizationId, parsedInput);
    revalidatePath("/reglages");
  });
