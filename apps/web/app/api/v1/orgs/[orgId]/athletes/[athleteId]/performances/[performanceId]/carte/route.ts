import { uuid } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { recordCardImage } from "@/features/progress/record-card";
import { performanceCard } from "@/server/performance.service";
import { orgParams } from "../../../../../../../_params";

// L'image d'un record personnel, à partager. Rendue à la demande, jamais mise en cache publique.
export const GET = authRoute
  .params(orgParams.extend({ athleteId: uuid, performanceId: uuid }))
  .handler(async (_req, { ctx, params }) => {
    const card = await performanceCard(ctx.actor.userId, params.orgId, params.athleteId, params.performanceId);
    const image = await recordCardImage(card);
    image.headers.set("Cache-Control", "private, no-store");
    return image;
  });
