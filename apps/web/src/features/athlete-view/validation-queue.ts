"use client";

import { sessionLogPaths } from "@/features/athlete-view/session-log-paths";
import { m } from "@tartan/i18n";
import type { SessionLogInput } from "@tartan/contracts";
import { pendingOps, submitOp, type QueuedOp, type SendResult } from "@/features/offline/op-queue";

type Pending = {
  organizationId: string;
  sessionId: string;
  athleteId?: string;
  athleteName?: string;
  input: SessionLogInput;
};

export const sendValidation = async ({
  organizationId,
  sessionId,
  athleteId,
  athleteName,
  input,
}: Pending): Promise<SendResult> => {
  const path = sessionLogPaths(organizationId, sessionId, athleteId).write;
  if ((await pendingOps()).some((op) => op.path === path && op.blocked))
    return { state: "error", message: m.offline.needsReview };
  return submitOp({
    id: input.clientId,
    kind: "log",
    target: sessionId,
    path,
    ...(athleteId ? { athleteName } : {}),
    body: input,
  });
};

// Une validation en attente reste visible quand la page, enregistrée avant, est rouverte hors ligne.
export const pendingStatusFor = async (sessionId: string): Promise<SessionLogInput["status"] | null> => {
  const ops: QueuedOp[] = (await pendingOps()).filter((op) => !op.path.includes("/athletes/"));
  if (ops.some((op) => op.blocked && op.target === sessionId)) return null;
  const last = ops.filter((op) => op.kind === "log" && op.target === sessionId).at(-1);
  return last ? (last.body as SessionLogInput).status : null;
};

export const newClientId = (): string => crypto.randomUUID();
