import { authRoute } from "@/lib/zod-route";
import { requestPasswordSetupConfirmation } from "@/server/credentials.service";

// Session trop ancienne pour définir un mot de passe : envoie le lien qui prouve que la boîte mail est à la personne.
export const POST = authRoute.handler(async (request, { ctx }) => {
  await requestPasswordSetupConfirmation(ctx.actor, request.headers);
  return { ok: true as const };
});
