import { authRoute } from "@/lib/zod-route";
import { getAthleteWelcome } from "@/server/athlete-view.service";
import { orgParams } from "../../../../_params";

// L'accueil d'un athlète qui vient d'arriver : le groupe et le coach qui le signe, ou rien après une semaine ou une
// première séance validée. L'app native en déduit, avec ses premiers pas, ce que montre l'écran du jour.
export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => ({ welcome: await getAthleteWelcome(ctx.actor.userId, params.orgId) }));
