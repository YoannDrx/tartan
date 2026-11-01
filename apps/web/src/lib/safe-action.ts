import { createSafeActionClient } from "next-safe-action";
import { m } from "@tartan/i18n";
import { AppError } from "./errors";
import { log } from "./logger";
import { requireActor } from "./session";

export const action = createSafeActionClient({
  handleServerError: (error) => {
    if (error instanceof AppError) return error.message;
    log.error("action_failed", { code: error.name });
    return m.common.genericError;
  },
});

export const authAction = action.use(async ({ next }) => next({ ctx: { actor: await requireActor() } }));
