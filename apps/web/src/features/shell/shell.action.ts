"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuid } from "@tartan/contracts";
import { forbidden } from "@/lib/errors";
import { authAction } from "@/lib/safe-action";
import { listSpaces, updatePreferences } from "@/server/me.service";
import { answerSatisfaction } from "@/server/satisfaction.service";
import { writeSpaceCookie } from "./space";
import { spaceAction } from "./space-action";

export const switchSpaceAction = authAction
  .inputSchema(z.object({ organizationId: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    const spaces = await listSpaces(ctx.actor.userId, { includeDemo: true });
    if (!spaces.some((s) => s.organizationId === parsedInput.organizationId)) throw forbidden();
    await writeSpaceCookie(parsedInput.organizationId);
    revalidatePath("/", "layout");
  });

export const chooseHomeAction = authAction
  .inputSchema(z.object({ organizationId: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    await updatePreferences(ctx.actor.userId, { homeOrganizationId: parsedInput.organizationId });
    await writeSpaceCookie(parsedInput.organizationId);
    revalidatePath("/", "layout");
  });

export const answerSatisfactionAction = spaceAction
  .inputSchema(z.object({ recommend: z.boolean(), comment: z.string().trim().max(1000).optional() }))
  .action(async ({ parsedInput, ctx }) => {
    await answerSatisfaction(ctx.userId, ctx.organizationId, parsedInput);
  });
