"use server";

import { revalidatePath } from "next/cache";
import { exerciseInput, uuid } from "@tartan/contracts";
import { z } from "zod";
import { spaceAction } from "@/features/shell/space-action";
import { createExerciseVideoUpload, deleteExercise, saveExercise } from "@/server/exercise.service";

export const saveExerciseAction = spaceAction.inputSchema(exerciseInput).action(async ({ parsedInput, ctx }) => {
  const saved = await saveExercise(ctx.userId, ctx.organizationId, parsedInput);
  revalidatePath("/exercices");
  return saved;
});

export const deleteExerciseAction = spaceAction
  .inputSchema(z.object({ id: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteExercise(ctx.userId, ctx.organizationId, parsedInput.id);
    revalidatePath("/exercices");
  });

export const exerciseUploadAction = spaceAction
  .inputSchema(z.object({ exerciseId: uuid }))
  .action(({ parsedInput, ctx }) => createExerciseVideoUpload(ctx.userId, ctx.organizationId, parsedInput.exerciseId));
