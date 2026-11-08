import { releaseStatusQuery } from "@tartan/contracts";
import { route } from "@/lib/zod-route";
import { releaseStatus } from "@/server/releases.service";

export const GET = route
  .query(releaseStatusQuery)
  .handler(async (_req, { query }) => releaseStatus(query.platform, query.version));
