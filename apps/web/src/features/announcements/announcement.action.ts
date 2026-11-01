"use server";

import { revalidatePath } from "next/cache";
import { announcementInput, uuid } from "@tartan/contracts";
import { z } from "zod";
import { spaceAction } from "@/features/shell/space-action";
import { deleteAnnouncement, publishAnnouncement, setAnnouncementPinned } from "@/server/comm.service";

export const publishAnnouncementAction = spaceAction
  .inputSchema(announcementInput)
  .action(async ({ parsedInput, ctx }) => {
    const created = await publishAnnouncement(ctx.userId, ctx.organizationId, parsedInput);
    revalidatePath("/annonces");
    return created;
  });

export const pinAnnouncementAction = spaceAction
  .inputSchema(z.object({ id: uuid, pinned: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    await setAnnouncementPinned(ctx.userId, ctx.organizationId, parsedInput.id, parsedInput.pinned);
    revalidatePath("/annonces");
  });

export const deleteAnnouncementAction = spaceAction
  .inputSchema(z.object({ id: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteAnnouncement(ctx.userId, ctx.organizationId, parsedInput.id);
    revalidatePath("/annonces");
  });
