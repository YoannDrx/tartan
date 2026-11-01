import { uuid } from "@tartan/contracts";
import { z } from "zod";

export const orgParams = z.object({ orgId: uuid });
export const sessionParams = z.object({ orgId: uuid, sessionId: uuid });
export const videoParams = z.object({ orgId: uuid, videoId: uuid });
