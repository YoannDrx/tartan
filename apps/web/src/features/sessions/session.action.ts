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
import { forbidden } from "@/lib/errors";
import { findPersonalSpace } from "@/server/personal-space.service";
import { spaceAction } from "@/features/shell/space-action";
import { exerciseSummariesByIds } from "@/server/exercise.service";
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

export const recoverExercisesAction = spaceAction
  .inputSchema(z.array(uuid).max(12 * 60 * 2))
  .action(({ parsedInput, ctx }) => exerciseSummariesByIds(ctx.userId, ctx.organizationId, parsedInput));

export const saveCalendarViewAction = spaceAction
  .inputSchema(preferencesInput)
  .action(async ({ ctx, parsedInput }) => updatePreferences(ctx.actor.userId, parsedInput));

async function saveTarget(ctx: { userId: string; organizationId: string }, personal?: boolean) {
  if (!personal) return ctx.organizationId;
  const notebook = await findPersonalSpace(ctx.userId);
  if (!notebook) throw forbidden();
  return notebook.id;
}

export const saveSessionAction = spaceAction
  .inputSchema(
    saveScheduledSessionInput.extend({ publish: z.boolean().default(false), personal: z.boolean().optional() }),
  )
  .action(async ({ parsedInput: { publish, personal, ...input }, ctx }) => {
    const target = await saveTarget(ctx, personal);
    const saved = await saveScheduledSession(ctx.userId, target, input);
    const published = publish ? await publishSession(ctx.userId, target, saved.id, undefined, saved.version) : null;
    revalidatePath("/calendrier");
    revalidatePath("/suivi");
    return { ...saved, recipients: published?.recipients ?? null };
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
  .inputSchema(sessionDraft.extend({ personal: z.boolean().optional() }))
  .action(async ({ parsedInput: { personal, ...draft }, ctx }) =>
    saveTemplate(ctx.userId, await saveTarget(ctx, personal), draft),
  );

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
