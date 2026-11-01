"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuid } from "@tartan/contracts";
import { forbidden } from "@/lib/errors";
import { authAction } from "@/lib/safe-action";
import { listSpaces } from "@/server/me.service";
import { SPACE_COOKIE } from "./space";

export const switchSpaceAction = authAction
  .inputSchema(z.object({ organizationId: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    const spaces = await listSpaces(ctx.actor.userId);
    if (!spaces.some((s) => s.organizationId === parsedInput.organizationId)) throw forbidden();
    const jar = await cookies();
    jar.set(SPACE_COOKIE, parsedInput.organizationId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    revalidatePath("/", "layout");
  });
