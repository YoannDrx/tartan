"use client";

import { createApiClient, ApiError } from "@tartan/api-client";
import { m } from "@tartan/i18n";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const api = createApiClient({ baseUrl: "" });

export function RemoveProposal({
  orgId,
  id,
  version,
  period,
}: {
  orgId: string;
  id: string;
  version: number;
  period: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  );
}
