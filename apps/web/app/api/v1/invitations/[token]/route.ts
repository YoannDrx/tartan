import { z } from "zod";
import { route } from "@/lib/zod-route";
import { previewInvitation } from "@/server/invitation.service";

export const GET = route
  .params(z.object({ token: z.string().min(16).max(200) }))
  .handler(async (_req, { params }) => previewInvitation(params.token));
