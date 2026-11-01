"use client";

import type { SessionLogInput } from "@tartan/contracts";
import { pendingOps, submitOp, type QueuedOp, type SendResult } from "@/features/offline/op-queue";

type Pending = { organizationId: string; sessionId: string; input: SessionLogInput };

export const sendValidation = ({ organizationId, sessionId, input }: Pending): Promise<SendResult> =>
  submitOp({
    id: input.clientId,
    kind: "log",
    target: sessionId,
    path: `/orgs/${organizationId}/sessions/${sessionId}/log`,
    body: input,
  });

// Une validation en attente reste visible quand la page, enregistrée avant, est rouverte hors ligne.
export const pendingStatusFor = async (sessionId: string): Promise<SessionLogInput["status"] | null> => {
  const ops: QueuedOp[] = await pendingOps();
  const last = ops.filter((op) => op.kind === "log" && op.target === sessionId).at(-1);
  return last ? (last.body as SessionLogInput).status : null;
};

export const newClientId = (): string => crypto.randomUUID();
