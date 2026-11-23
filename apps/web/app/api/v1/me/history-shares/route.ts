import { historyShareInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { listMyHistoryShares, shareHistory } from "@/server/history-share.service";

// Les partages de son historique personnel : la liste, et le partage (ou le changement de cases) vers un espace.
export const GET = authRoute.handler(async (_req, { ctx }) => listMyHistoryShares(ctx.actor.userId));

export const POST = authRoute
  .body(historyShareInput)
  .handler(async (_req, { ctx, body }) => ({ share: await shareHistory(ctx.actor.userId, body) }));
