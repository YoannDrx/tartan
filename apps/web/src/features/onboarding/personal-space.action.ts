"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createPersonalSpaceInput } from "@tartan/contracts";
import { authAction } from "@/lib/safe-action";
import { writeSpaceCookie } from "@/features/shell/space";
import { listSpaces } from "@/server/me.service";
import { createPersonalSpace } from "@/server/personal-space.service";

// Une première inscription ouvre le carnet. Depuis le planificateur d’un club, le bandeau reste celui du club.
export const createPersonalSpaceAction = authAction
  .inputSchema(createPersonalSpaceInput.extend({ planner: z.boolean().optional() }))
  .action(async ({ parsedInput, ctx }) => {
    const { planner, ...input } = parsedInput;
    const created = await createPersonalSpace(ctx.actor.userId, input);
    const clubs = await listSpaces(ctx.actor.userId);
    if (!planner || !clubs.some((s) => s.kind !== "personal" && s.role === "athlete"))
      await writeSpaceCookie(created.organizationId);
    redirect(planner ? "/planificateur" : "/aujourdhui");
  });
