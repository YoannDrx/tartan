import { authRoute } from "@/lib/zod-route";
import { dismissPasswordPrompt } from "@/server/credentials.service";

// Referme la proposition « définir un mot de passe » de l'accueil, pour tous les appareils du compte.
export const DELETE = authRoute.handler(async (_req, { ctx }) => {
  await dismissPasswordPrompt(ctx.actor.userId);
  return { ok: true as const };
});
