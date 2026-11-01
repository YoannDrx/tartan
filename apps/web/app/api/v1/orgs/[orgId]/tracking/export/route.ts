import { NextResponse } from "next/server";
import { isoDate, uuid } from "@tartan/contracts";
import { z } from "zod";
import { authRoute } from "@/lib/zod-route";
import { exportTrackingCsv } from "@/server/stats.service";
import { orgParams } from "../../../../_params";

export const GET = authRoute
  .params(orgParams)
  .query(z.object({ from: isoDate, to: isoDate, athleteId: uuid.optional() }))
  .handler(async (_req, { ctx, params, query }) => {
    const csv = await exportTrackingCsv(ctx.actor.userId, params.orgId, query);
    return new NextResponse(`\ufeff${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tartan-suivi-${query.from}.csv"`,
      },
    });
  });
