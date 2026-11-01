"use server";

import { revalidatePath } from "next/cache";
import { athleteInput, coachNoteInput, injuryInput, performanceInput, strengthTestInput } from "@tartan/contracts";
import { spaceAction } from "@/features/shell/space-action";
import { addCoachNote, addPerformance, addStrengthTest, saveAthlete, saveInjury } from "@/server/athlete.service";

export const saveAthleteAction = spaceAction.inputSchema(athleteInput).action(async ({ parsedInput, ctx }) => {
  const saved = await saveAthlete(ctx.userId, ctx.organizationId, parsedInput);
  revalidatePath("/athletes");
  revalidatePath(`/athletes/${saved.id}`);
  return saved;
});

export const addTestAction = spaceAction.inputSchema(strengthTestInput).action(async ({ parsedInput, ctx }) => {
  await addStrengthTest(ctx.userId, ctx.organizationId, parsedInput);
  revalidatePath(`/athletes/${parsedInput.athleteId}`);
});

export const addPerformanceAction = spaceAction.inputSchema(performanceInput).action(async ({ parsedInput, ctx }) => {
  await addPerformance(ctx.userId, ctx.organizationId, parsedInput);
  revalidatePath(`/athletes/${parsedInput.athleteId}`);
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
