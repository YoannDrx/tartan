"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createPersonalSpaceInput } from "@tartan/contracts";
import { authAction } from "@/lib/safe-action";
import { writeSpaceCookie } from "@/features/shell/space";
import { createPersonalSpace } from "@/server/personal-space.service";

// « Je m'entraîne seul » : l'espace personnel naît, devient l'espace en cours, et l'athlète arrive sur sa journée.
export const createPersonalSpaceAction = authAction
  .inputSchema(createPersonalSpaceInput.extend({ planner: z.boolean().optional() }))
  .action(async ({ parsedInput, ctx }) => {
    const { planner, ...input } = parsedInput;
    const created = await createPersonalSpace(ctx.actor.userId, input);
    await writeSpaceCookie(created.organizationId);
    redirect(planner ? "/planificateur" : "/aujourdhui");
  });
