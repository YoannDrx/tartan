import { accountingCsv } from "@/server/admin-console.service";
import { requireActor } from "@/lib/session";
import { requireStepUp, STEP_UP_READ_MS } from "@/server/admin-step-up.service";

export const GET = async (request: Request) => {
  const actor = await requireActor();
  await requireStepUp(actor, STEP_UP_READ_MS);
  const year = Number(new URL(request.url).searchParams.get("annee")) || new Date().getUTCFullYear();
  return new Response(await accountingCsv(actor, year), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tartan-factures-${year}.csv"`,
    },
  });
};
