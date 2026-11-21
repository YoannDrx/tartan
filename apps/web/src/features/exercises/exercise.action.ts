"use server";

import { revalidatePath } from "next/cache";
import {
  exerciseFilter,
  exerciseInput,
  exerciseListInput,
  exerciseListName,
  exerciseListOrder,
  quickExerciseInput,
  uuid,
} from "@tartan/contracts";
import { z } from "zod";
import { spaceAction } from "@/features/shell/space-action";
import {
  createExerciseVideoUpload,
  deleteExercise,
  exerciseDefaultsFor,
  getExerciseSheet,
  personalizeExercise,
  quickCreateExercise,
  saveExercise,
  searchExercises,
} from "@/server/exercise.service";
import {
  createExerciseList,
  deleteExerciseList,
  reorderExerciseLists,
  setFavorite,
  setListMembership,
  updateExerciseList,
} from "@/server/exercise-list.service";

// La bibliothèque et chaque fiche relisent leurs listes après un changement.
const refresh = (exerciseId?: string) => {
  revalidatePath("/exercices");
  if (exerciseId) revalidatePath(`/exercices/${exerciseId}`);
};

export const saveExerciseAction = spaceAction.inputSchema(exerciseInput).action(async ({ parsedInput, ctx }) => {
  const saved = await saveExercise(ctx.userId, ctx.organizationId, parsedInput);
  refresh(saved.id);
  return saved;
});

export const deleteExerciseAction = spaceAction
  .inputSchema(z.object({ id: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteExercise(ctx.userId, ctx.organizationId, parsedInput.id);
    refresh();
  });

export const exerciseUploadAction = spaceAction
  .inputSchema(z.object({ exerciseId: uuid }))
  .action(({ parsedInput, ctx }) => createExerciseVideoUpload(ctx.userId, ctx.organizationId, parsedInput.exerciseId));

// Le sélecteur du constructeur et la bibliothèque chargent leurs fiches à la demande.
export const searchExercisesAction = spaceAction
  .inputSchema(
    z.object({
      q: z.string().max(120),
      filter: exerciseFilter,
      offset: z.number().int().min(0).max(10_000),
      limit: z.number().int().min(1).max(100),
      ownFirst: z.boolean().optional(),
    }),
  )
  .action(({ parsedInput, ctx }) => searchExercises(ctx.userId, ctx.organizationId, parsedInput));

// Création rapide : la famille et la charge proposées pour un nom, puis la fiche créée sans quitter l'écran.
export const exerciseDefaultsAction = spaceAction
  .inputSchema(z.object({ name: z.string().trim().max(120) }))
  .action(({ parsedInput, ctx }) => exerciseDefaultsFor(ctx.userId, ctx.organizationId, parsedInput.name));

export const quickCreateExerciseAction = spaceAction
  .inputSchema(quickExerciseInput)
  .action(async ({ parsedInput, ctx }) => {
    const result = await quickCreateExercise(ctx.userId, ctx.organizationId, parsedInput);
    if (result.created || parsedInput.listId) refresh(result.id);
    return result;
  });

export const exerciseSheetAction = spaceAction
  .inputSchema(z.object({ id: uuid }))
  .action(({ parsedInput, ctx }) => getExerciseSheet(ctx.userId, ctx.organizationId, parsedInput.id));

export const setFavoriteAction = spaceAction
  .inputSchema(z.object({ exerciseId: uuid, favorite: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    await setFavorite(ctx.userId, ctx.organizationId, parsedInput.exerciseId, parsedInput.favorite);
    refresh(parsedInput.exerciseId);
  });

export const personalizeExerciseAction = spaceAction
  .inputSchema(z.object({ id: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    const copy = await personalizeExercise(ctx.userId, ctx.organizationId, parsedInput.id);
    refresh(copy.id);
    return copy;
  });

export const createListAction = spaceAction.inputSchema(exerciseListInput).action(async ({ parsedInput, ctx }) => {
  const list = await createExerciseList(ctx.userId, ctx.organizationId, parsedInput);
  refresh();
  return list;
});

export const updateListAction = spaceAction
  .inputSchema(z.object({ listId: uuid, name: exerciseListName.optional(), sharedWithCoaches: z.boolean().optional() }))
  .action(async ({ parsedInput: { listId, ...update }, ctx }) => {
    await updateExerciseList(ctx.userId, ctx.organizationId, listId, update);
    refresh();
  });

export const deleteListAction = spaceAction
  .inputSchema(z.object({ listId: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteExerciseList(ctx.userId, ctx.organizationId, parsedInput.listId);
    refresh();
  });

export const reorderListsAction = spaceAction.inputSchema(exerciseListOrder).action(async ({ parsedInput, ctx }) => {
  await reorderExerciseLists(ctx.userId, ctx.organizationId, parsedInput);
  refresh();
});

export const setListMembershipAction = spaceAction
  .inputSchema(z.object({ listId: uuid, exerciseId: uuid, member: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    await setListMembership(
      ctx.userId,
      ctx.organizationId,
      parsedInput.listId,
      parsedInput.exerciseId,
      parsedInput.member,
    );
    refresh(parsedInput.exerciseId);
  });
