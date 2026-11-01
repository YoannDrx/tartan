import { createZodRoute } from "next-zod-route";
import { NextResponse } from "next/server";
import { m } from "@tartan/i18n";
import { AppError, unauthorized } from "./errors";
import { log } from "./logger";
import { getActorFrom } from "./session";

export const route = createZodRoute({
  handleServerError: (error: Error) => {
    if (error instanceof AppError) {
      return NextResponse.json({ message: error.message, code: error.code }, { status: error.status });
    }
    log.error("route_failed", { code: error.name });
    return NextResponse.json({ message: m.common.genericError, code: "server_error" }, { status: 500 });
  },
});

export const authRoute = route.use(async ({ request, next }) => {
  const actor = await getActorFrom(request.headers);
  if (!actor) throw unauthorized();
  return next({ ctx: { actor } });
});
