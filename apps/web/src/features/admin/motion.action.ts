"use server";

import { exerciseFamily } from "@tartan/contracts";
import { REVIEW_BATCHES } from "@tartan/mascot/v2/engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/lib/safe-action";
import { setMotionFamilyApproval } from "@/server/motion-review.service";

export const approveMotionFamilyAction = adminAction
  .inputSchema(z.object({ family: exerciseFamily, approved: z.boolean(), batch: z.enum(REVIEW_BATCHES).optional() }))
  .action(async ({ ctx, parsedInput }) => {
    await setMotionFamilyApproval(ctx.actor, parsedInput.family, parsedInput.approved, parsedInput.batch);
    revalidatePath("/admin/mouvements");
  });
