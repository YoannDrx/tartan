"use server";

import { uuid } from "@tartan/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/lib/safe-action";
import { adminBanGameDevice, adminHideGameScore } from "@/server/game.service";

export const hideGameScoreAction = adminAction
  .inputSchema(z.object({ id: uuid, hidden: z.boolean() }))
  .action(async ({ ctx, parsedInput }) => {
    await adminHideGameScore(ctx.actor, parsedInput.id, parsedInput.hidden);
    revalidatePath("/admin/jeu");
  });

export const banGameDeviceAction = adminAction
  .inputSchema(z.object({ id: uuid }))
  .action(async ({ ctx, parsedInput }) => {
    await adminBanGameDevice(ctx.actor, parsedInput.id);
    revalidatePath("/admin/jeu");
  });
