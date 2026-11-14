import { createZodRoute } from "next-zod-route";
import { NextResponse } from "next/server";
import { m } from "@tartan/i18n";
import { AppError, unauthorized } from "./errors";
import { log } from "./logger";
import { getActorFrom } from "./session";
import type { z } from "zod";
import { invalid } from "./errors";

// next-zod-route ne lit pas le JSON des DELETE. Garder le corps pour les clients
// déjà en circulation et pour éviter d'inscrire un jeton push dans l'URL.
export const readJsonBody = async <T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw invalid();
  return parsed.data;
};

export const handleRouteError = (error: unknown) => {
  if (error instanceof AppError) {
    return NextResponse.json({ message: error.message, code: error.code }, { status: error.status });
  }
  // Keep the stable database error code, never its message, query or metadata.
  // Otherwise a transaction timeout and a constraint failure look identical in CI.
  const databaseCode =
    error instanceof Error &&
    error.name === "PrismaClientKnownRequestError" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^P\d{4}$/.test(error.code)
      ? error.code
      : null;
  log.error("route_failed", { code: databaseCode ?? (error instanceof Error ? error.name : "unknown") });
  return NextResponse.json({ message: m.common.genericError, code: "server_error" }, { status: 500 });
};

export const route = createZodRoute({ handleServerError: handleRouteError });

export const authRoute = route.use(async ({ request, next }) => {
  const actor = await getActorFrom(request.headers);
  if (!actor) throw unauthorized();
  return next({ ctx: { actor } });
});
