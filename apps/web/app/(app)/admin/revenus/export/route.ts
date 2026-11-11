import { unauthorized } from "@/lib/errors";
import { getActorFrom } from "@/lib/session";
import { handleRouteError } from "@/lib/zod-route";
import { accountingCsv } from "@/server/admin-console.service";
import { requireStepUp, STEP_UP_READ_MS } from "@/server/admin-step-up.service";

// Une année demandée hors bornes ou illisible retombe sur l'année en cours.
const yearOf = (request: Request): number => {
  const asked = Number(new URL(request.url).searchParams.get("annee"));
  return Number.isInteger(asked) && asked >= 2000 && asked <= 2100 ? asked : new Date().getUTCFullYear();
};

export const GET = async (request: Request) => {
  try {
    const actor = await getActorFrom(request.headers);
    if (!actor) throw unauthorized();
    await requireStepUp(actor, STEP_UP_READ_MS);
    const year = yearOf(request);
    return new Response(await accountingCsv(actor, year), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tartan-factures-${year}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    // Un refus répond 401 ou 403 : sans cela, il sortait en erreur 500.
    return handleRouteError(error);
  }
};
