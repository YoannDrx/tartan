"use server";

import { revalidatePath } from "next/cache";
import { annotationInput, createVideoInput, jumpAttemptInput, shareVideoInput, uuid } from "@tartan/contracts";
import { z } from "zod";
import { spaceAction } from "@/features/shell/space-action";
import {
  addAnnotation,
  addJumpAttempt,
  createVideoUpload,
  deleteAnnotation,
  deleteJumpAttempt,
  deleteVideo,
  shareVideo,
  linkVideoExercise,
  markVideoReviewed,
} from "@/server/video.service";

export const createVideoAction = spaceAction.inputSchema(createVideoInput).action(async ({ parsedInput, ctx }) => {
  const res = await createVideoUpload(ctx.userId, ctx.organizationId, parsedInput);
  revalidatePath("/videos");
  return res;
});

export const addAnnotationAction = spaceAction
  .inputSchema(annotationInput.extend({ videoId: uuid }))
  .action(async ({ parsedInput: { videoId, ...input }, ctx }) => {
    const res = await addAnnotation(ctx.userId, ctx.organizationId, videoId, input);
    revalidatePath(`/videos/${videoId}`);
    revalidatePath(`/mes-sauts/${videoId}`);
    return res;
  });

export const deleteAnnotationAction = spaceAction
  .inputSchema(z.object({ id: uuid, videoId: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteAnnotation(ctx.userId, ctx.organizationId, parsedInput.id);
    revalidatePath(`/videos/${parsedInput.videoId}`);
    revalidatePath(`/mes-sauts/${parsedInput.videoId}`);
  });

export const deleteJumpAction = spaceAction.inputSchema(z.object({ id: uuid })).action(async ({ parsedInput, ctx }) => {
  const { athleteId } = await deleteJumpAttempt(ctx.userId, ctx.organizationId, parsedInput.id);
  revalidatePath(`/athletes/${athleteId}`);
});

export const linkVideoExerciseAction = spaceAction
  .inputSchema(z.object({ videoId: uuid, exerciseId: uuid.nullable() }))
  .action(async ({ parsedInput, ctx }) => {
    await linkVideoExercise(ctx.userId, ctx.organizationId, parsedInput.videoId, parsedInput.exerciseId);
  });

export const shareVideoAction = spaceAction
  .inputSchema(shareVideoInput.extend({ videoId: uuid }))
  .action(async ({ parsedInput: { videoId, ...input }, ctx }) => {
    await shareVideo(ctx.userId, ctx.organizationId, videoId, input);
    revalidatePath(`/videos/${videoId}`);
    revalidatePath(`/mes-sauts/${videoId}`);
  });

export const deleteVideoAction = spaceAction
  .inputSchema(z.object({ videoId: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteVideo(ctx.userId, ctx.organizationId, parsedInput.videoId);
    revalidatePath("/videos");
    revalidatePath("/mes-sauts");
  });

export const addJumpAction = spaceAction.inputSchema(jumpAttemptInput).action(async ({ parsedInput, ctx }) => {
  const res = await addJumpAttempt(ctx.userId, ctx.organizationId, parsedInput);
  revalidatePath(`/athletes/${parsedInput.athleteId}`);
  return res;
});

export const markVideoReviewedAction = spaceAction
  .inputSchema(z.object({ videoId: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    await markVideoReviewed(ctx.userId, ctx.organizationId, parsedInput.videoId);
    revalidatePath("/videos");
    revalidatePath(`/videos/${parsedInput.videoId}`);
  });
