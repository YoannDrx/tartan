import { authRoute } from "@/lib/zod-route";
import { getSignInMethods } from "@/server/credentials.service";

// Les moyens de connexion du compte : lien, mot de passe, Google, Apple. Jamais le mot de passe lui-même.
export const GET = authRoute.handler(async (_req, { ctx }) => getSignInMethods(ctx.actor));
