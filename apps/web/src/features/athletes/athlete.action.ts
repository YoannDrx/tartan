"use server";

import { revalidatePath } from "next/cache";
import {
  athleteInput,
  coachNoteInput,
  injuryInput,
  performanceInput,
  updatePerformanceInput,
  strengthTestInput,
  chooseStrengthReference,
} from "@tartan/contracts";
import { selectStrengthReference } from "@/server/strength.service";
import { spaceAction } from "@/features/shell/space-action";
import { z } from "zod";
import { uuid } from "@tartan/contracts";
import {
  addCoachNote,
  addPerformance,
  updatePerformance,
  addStrengthTest,
  deleteCoachNote,
  deletePerformance,
  deleteStrengthTest,
  saveAthlete,
  saveInjury,
} from "@/server/athlete.service";

export const saveAthleteAction = spaceAction.inputSchema(athleteInput).action(async ({ parsedInput, ctx }) => {
  const saved = await saveAthlete(ctx.userId, ctx.organizationId, parsedInput);
  revalidatePath("/athletes");
  revalidatePath(`/athletes/${saved.id}`);
  return saved;
});

const byId = z.object({ id: uuid });

export const selectReferenceAction = spaceAction
  .inputSchema(z.object({ athleteId: uuid, exerciseId: uuid, choice: chooseStrengthReference }))
  .action(async ({ parsedInput, ctx }) => {
    const result = await selectStrengthReference(
      ctx.userId,
      ctx.organizationId,
      parsedInput.athleteId,
      parsedInput.exerciseId,
      parsedInput.choice,
    );
    revalidatePath(`/athletes/${parsedInput.athleteId}`);
    return result;
  });

export const deleteTestAction = spaceAction.inputSchema(byId).action(async ({ parsedInput, ctx }) => {
  const { athleteId } = await deleteStrengthTest(ctx.userId, ctx.organizationId, parsedInput.id);
  revalidatePath(`/athletes/${athleteId}`);
});

export const deletePerformanceAction = spaceAction
  .inputSchema(byId.extend({ expectedVersion: z.number().int().positive().optional() }))
  .action(async ({ parsedInput, ctx }) => {
    const { athleteId } = await deletePerformance(
      ctx.userId,
      ctx.organizationId,
      parsedInput.id,
      parsedInput.expectedVersion,
    );
    revalidatePath(`/athletes/${athleteId}`);
  });

export const deleteNoteAction = spaceAction.inputSchema(byId).action(async ({ parsedInput, ctx }) => {
  const { athleteId } = await deleteCoachNote(ctx.userId, ctx.organizationId, parsedInput.id);
  revalidatePath(`/athletes/${athleteId}`);
});

export const addTestAction = spaceAction.inputSchema(strengthTestInput).action(async ({ parsedInput, ctx }) => {
  await addStrengthTest(ctx.userId, ctx.organizationId, parsedInput);
  revalidatePath(`/athletes/${parsedInput.athleteId}`);
});

export const addPerformanceAction = spaceAction.inputSchema(performanceInput).action(async ({ parsedInput, ctx }) => {
  const result = await addPerformance(ctx.userId, ctx.organizationId, parsedInput);
  revalidatePath(`/athletes/${parsedInput.athleteId}`);
  revalidatePath("/progres");
  return result;
});

export const updatePerformanceAction = spaceAction
  .inputSchema(updatePerformanceInput)
  .action(async ({ parsedInput, ctx }) => {
    const result = await updatePerformance(ctx.userId, ctx.organizationId, parsedInput);
    revalidatePath(`/athletes/${parsedInput.athleteId}`);
    revalidatePath("/progres");
    return result;
  });

export const saveInjuryAction = spaceAction.inputSchema(injuryInput).action(async ({ parsedInput, ctx }) => {
  await saveInjury(ctx.userId, ctx.organizationId, parsedInput);
  revalidatePath(`/athletes/${parsedInput.athleteId}`);
  revalidatePath("/progres");
});

export const addNoteAction = spaceAction.inputSchema(coachNoteInput).action(async ({ parsedInput, ctx }) => {
  await addCoachNote(ctx.userId, ctx.organizationId, parsedInput.athleteId, parsedInput.body);
  revalidatePath(`/athletes/${parsedInput.athleteId}`);
});
