import { createSafeActionClient } from "next-safe-action";
import { m } from "@tartan/i18n";
import { AppError } from "./errors";
import { log } from "./logger";
import { requireActor } from "./session";
import { requireStepUp, STEP_UP_READ_MS } from "@/server/admin-step-up.service";

export const action = createSafeActionClient({
  handleServerError: (error) => {
    if (error instanceof AppError) return error.message;
    log.error("action_failed", { code: error.name });
    return m.common.genericError;
  },
});

export const authAction = action.use(async ({ next }) => next({ ctx: { actor: await requireActor() } }));

// Console de l'éditeur : réservée aux adresses listées, avec une passkey vérifiée récemment.
export const adminAction = authAction.use(async ({ next, ctx }) => {
  await requireStepUp(ctx.actor, STEP_UP_READ_MS);
  return next({ ctx });
});
