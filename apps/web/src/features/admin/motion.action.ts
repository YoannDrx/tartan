"use server";

import { exerciseFamily } from "@tartan/contracts";
import { MOTION_BATCHES } from "@tartan/mascot/exercise";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/lib/safe-action";
import { setMotionFamilyApproval } from "@/server/motion-review.service";

export const approveMotionFamilyAction = adminAction
  .inputSchema(z.object({ family: exerciseFamily, approved: z.boolean(), batch: z.enum(MOTION_BATCHES).optional() }))
  .action(async ({ ctx, parsedInput }) => {
    await setMotionFamilyApproval(ctx.actor, parsedInput.family, parsedInput.approved, parsedInput.batch);
    revalidatePath("/admin/mouvements");
  });
