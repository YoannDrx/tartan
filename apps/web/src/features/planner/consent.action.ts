"use server";

import { z } from "zod";
import { authAction } from "@/lib/safe-action";
import { updatePreferences } from "@/server/me.service";

export const setAiConsentAction = authAction
  .inputSchema(z.object({ granted: z.boolean() }))
  .action(async ({ ctx, parsedInput }) => {
    await updatePreferences(ctx.actor.userId, { aiConsent: parsedInput.granted });
  });
