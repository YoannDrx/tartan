import { appleAuthorizationInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { storeAppleAuthorization } from "@/server/apple-authorization.service";

// Connexion Apple sur iPhone : l'app transmet le code d'autorisation, pour que la suppression du compte révoque l'accès.
export const POST = authRoute
  .body(appleAuthorizationInput)
  .handler(async (_req, { ctx, body }) => storeAppleAuthorization(ctx.actor.userId, body));
