"use server";

import { revalidatePath } from "next/cache";
import {
  competitionInput,
  preferencesInput,
  publishSessionsInput,
  deleteSessionInput,
  isoDate,
  saveScheduledSessionInput,
  sessionDraft,
  uuid,
} from "@tartan/contracts";
import { z } from "zod";
import { spaceAction } from "@/features/shell/space-action";
import { updatePreferences } from "@/server/me.service";
import {
  deleteCompetition,
  deleteSession,
  deleteTemplate,
  duplicateSession,
  duplicateWeek,
  moveSession,
  publishSession,
  publishSessions,
  saveCompetition,
  saveScheduledSession,
  saveTemplate,
} from "@/server/session.service";

export const saveCalendarViewAction = spaceAction
  .inputSchema(preferencesInput)
  .action(async ({ ctx, parsedInput }) => updatePreferences(ctx.actor.userId, parsedInput));

export const saveSessionAction = spaceAction
  .inputSchema(saveScheduledSessionInput.extend({ publish: z.boolean().default(false) }))
  .action(async ({ parsedInput: { publish, ...input }, ctx }) => {
    const saved = await saveScheduledSession(ctx.userId, ctx.organizationId, input);
    if (publish) await publishSession(ctx.userId, ctx.organizationId, saved.id, undefined, saved.version);
    revalidatePath("/calendrier");
    revalidatePath("/suivi");
    return saved;
  });

export const deleteSessionAction = spaceAction
  .inputSchema(deleteSessionInput.extend({ id: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteSession(ctx.userId, ctx.organizationId, parsedInput.id, parsedInput);
    revalidatePath("/calendrier");
    revalidatePath("/suivi");
  });

export const deleteTemplateAction = spaceAction
  .inputSchema(z.object({ id: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteTemplate(ctx.userId, ctx.organizationId, parsedInput.id);
  });

export const deleteCompetitionAction = spaceAction
  .inputSchema(z.object({ id: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteCompetition(ctx.userId, ctx.organizationId, parsedInput.id);
    revalidatePath("/calendrier");
  });

export const moveSessionAction = spaceAction
  .inputSchema(z.object({ id: uuid, date: isoDate }))
  .action(async ({ parsedInput, ctx }) => {
    await moveSession(ctx.userId, ctx.organizationId, parsedInput.id, parsedInput.date);
    revalidatePath("/calendrier");
  });

export const duplicateSessionAction = spaceAction
  .inputSchema(z.object({ id: uuid, date: isoDate }))
  .action(async ({ parsedInput, ctx }) => {
    const copy = await duplicateSession(ctx.userId, ctx.organizationId, parsedInput.id, parsedInput.date);
    revalidatePath("/calendrier");
    return copy;
  });

export const duplicateWeekAction = spaceAction
  .inputSchema(z.object({ fromWeek: isoDate, toWeek: isoDate, targetGroupId: uuid.optional() }))
  .action(async ({ parsedInput, ctx }) => {
    const res = await duplicateWeek(ctx.userId, ctx.organizationId, parsedInput);
    revalidatePath("/calendrier");
    return res;
  });

export const saveTemplateAction = spaceAction
  .inputSchema(sessionDraft)
  .action(({ parsedInput, ctx }) => saveTemplate(ctx.userId, ctx.organizationId, parsedInput));

export const saveCompetitionAction = spaceAction.inputSchema(competitionInput).action(async ({ parsedInput, ctx }) => {
  const saved = await saveCompetition(ctx.userId, ctx.organizationId, parsedInput);
  revalidatePath("/calendrier");
  return saved;
});

export const publishSessionsAction = spaceAction
  .inputSchema(publishSessionsInput)
  .action(async ({ parsedInput, ctx }) => {
    const result = await publishSessions(ctx.userId, ctx.organizationId, parsedInput);
    revalidatePath("/calendrier");
    revalidatePath("/suivi");
    return result;
  });
