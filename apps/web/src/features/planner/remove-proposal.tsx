"use client";

import { createApiClient, ApiError } from "@tartan/api-client";
import { m } from "@tartan/i18n";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const api = createApiClient({ baseUrl: "" });

export function RemoveProposal({
  orgId,
  id,
  version,
  period,
  canDuplicate,
}: {
  orgId: string;
  id: string;
  version: number;
  period: string;
  canDuplicate: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const copyId = useRef<string | null>(null);
  async function duplicate() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const copy = await api.duplicatePlannerProposal(orgId, id, (copyId.current ??= crypto.randomUUID()), version);
      router.push(`/planificateur?proposition=${copy.id}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : m.common.genericError);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api.removePlannerProposal(orgId, id, version);
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : m.common.genericError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="self-start">
      <summary className="flex min-h-11 cursor-pointer items-center underline">
        {m.aiPlanner.moreProposalActions}
      </summary>
      <div className="flex flex-wrap items-center gap-2">
        {canDuplicate && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void duplicate()}>
            {m.aiPlanner.duplicateProposal}
          </Button>
        )}
        {error && !open && <p role="alert">{error}</p>}
        <Dialog
          open={open}
          onOpenChange={(value) => {
            setOpen(value);
            setError("");
          }}
          title={m.aiPlanner.removeProposal}
          description={m.aiPlanner.removeProposalDetail(period)}
          trigger={
            <Button variant="quiet" size="sm" className="self-start">
              {m.aiPlanner.removeProposal}
            </Button>
          }
        >
          {error ? <p role="alert">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {m.common.cancel}
            </Button>
            <Button disabled={busy} onClick={() => void remove()}>
              {m.aiPlanner.removeProposal}
            </Button>
          </div>
        </Dialog>
      </div>
    </details>
  );
}
