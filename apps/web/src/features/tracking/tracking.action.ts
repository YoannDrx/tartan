"use server";

import { revalidatePath } from "next/cache";
import { rollCallInput, uuid } from "@tartan/contracts";
import { z } from "zod";
import { spaceAction } from "@/features/shell/space-action";
import { generateAutonomousVersion } from "@/server/session.service";
import { remindAthletes, takeRollCall } from "@/server/tracking.service";

export const rollCallAction = spaceAction
  .inputSchema(rollCallInput.extend({ sessionId: uuid }))
  .action(async ({ parsedInput: { sessionId, ...input }, ctx }) => {
    const res = await takeRollCall(ctx.userId, ctx.organizationId, sessionId, input);
    revalidatePath(`/seances/${sessionId}/suivi`);
    return res;
  });

export const remindAction = spaceAction
  .inputSchema(z.object({ sessionId: uuid, athleteIds: z.array(uuid).optional() }))
  .action(({ parsedInput, ctx }) =>
    remindAthletes(ctx.userId, ctx.organizationId, parsedInput.sessionId, parsedInput.athleteIds),
  );

export const generateAutonomousAction = spaceAction
  .inputSchema(z.object({ sessionId: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    await generateAutonomousVersion(ctx.userId, ctx.organizationId, parsedInput.sessionId);
    revalidatePath(`/seances/${parsedInput.sessionId}/suivi`);
  });
