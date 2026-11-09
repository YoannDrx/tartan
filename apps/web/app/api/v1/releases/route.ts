import { isStaff } from "@tartan/domain";
import { z } from "zod";
import { authRoute } from "@/lib/zod-route";
import { listSpaces } from "@/server/me.service";
import { listReleases, unseenRelease } from "@/server/releases.service";

const query = z.object({ platform: z.enum(["web", "ios", "android"]).default("web") });

export const GET = authRoute.query(query).handler(async (_req, { ctx, query: { platform } }) => {
  const spaces = await listSpaces(ctx.actor.userId);
  const audience = spaces.some((space) => isStaff(space.role)) ? "coach" : "athlete";
  return {
    releases: listReleases(audience),
    unseen: await unseenRelease(ctx.actor.userId, platform, audience),
  };
});
