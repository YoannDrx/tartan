import { authRoute } from "@/lib/zod-route";
import { deleteDemoSpace, getDemoSpace, openDemoSpace } from "@/server/demo-space.service";
import { orgParams } from "../../../_params";

// L'espace de démonstration du coach connecté, vu depuis l'un de ses espaces : le lire, l'ouvrir (ou le remettre
// à zéro), le supprimer. Réservé aux encadrants ; un athlète n'en a pas.
export const GET = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => ({ demo: await getDemoSpace(ctx.actor.userId, params.orgId) }));
export const POST = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => openDemoSpace(ctx.actor.userId, params.orgId));
export const DELETE = authRoute
  .params(orgParams)
  .handler(async (_req, { ctx, params }) => ({ deleted: await deleteDemoSpace(ctx.actor.userId, params.orgId) }));
