"use server";

import { exerciseFamily } from "@tartan/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/lib/safe-action";
import { setMotionFamilyApproval } from "@/server/motion-review.service";

export const approveMotionFamilyAction = adminAction
  .inputSchema(z.object({ family: exerciseFamily, approved: z.boolean() }))
  .action(async ({ ctx, parsedInput }) => {
    await setMotionFamilyApproval(ctx.actor, parsedInput.family, parsedInput.approved);
    revalidatePath("/admin/mouvements");
  });
