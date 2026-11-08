"use client";

import { prescriptionRefreshPreview, sessionSaveResult, type PrescriptionRefreshPreview } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type LoadState = PrescriptionRefreshPreview["athletes"][number]["changes"][number]["before"];
const LoadValue = ({ value, label }: { value: LoadState; label: string }) => {
  const ref = value.reference;
  const origin = ref?.originKind ?? ref?.kind;
  const kind =
    origin === "one_rm"
      ? m.strength.referenceKinds.tested
      : origin === "three_rm"
        ? m.prescriptionRefresh.threeRm
        : ref?.originKind && ref.originKind in m.strength.referenceKinds
          ? m.strength.referenceKinds[ref.originKind as keyof typeof m.strength.referenceKinds]
          : m.prescriptionRefresh.legacy;
  return (
    <div className="min-w-0">
      <p className="t-caption">{label}</p>
      <p className="t-num text-xl">
        {value.kg === null ? m.prescriptionRefresh.missing : `${String(value.kg).replace(".", ",")} kg`}
      </p>
      {ref ? (
        <p className="t-caption mt-1">{m.prescriptionRefresh.source(ref.value, kind, ref.date, ref.stepKg ?? 1.25)}</p>
      ) : null}
    </div>
  );
};

export const RefreshLoads = ({
  initial,
  organizationId,
}: {
  initial: PrescriptionRefreshPreview;
  organizationId: string;
}) => {
  const [preview, setPreview] = useState(initial);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [saved, setSaved] = useState(false);
  const count = preview.athletes.filter((a) => a.status === "ready").length;
  const endpoint = `/api/v1/orgs/${organizationId}/sessions/${preview.sessionId}/refresh-loads`;
  const request = async (confirm: boolean) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        endpoint,
        confirm
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ expectedVersion: preview.sessionVersion, token: preview.token, confirmed: true }),
            }
          : { cache: "no-store" },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json?.message ?? m.common.genericError);
      if (confirm) {
        sessionSaveResult.parse(json);
        setSaved(true);
      } else {
        setPreview(prescriptionRefreshPreview.parse(json));
        setStale(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : m.common.genericError);
      setStale(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  if (saved)
    return (
      <div className="flex flex-col gap-4">
        <p role="status">{m.prescriptionRefresh.saved}</p>
        <Button asChild>
          <Link href={`/seances/${preview.sessionId}/suivi`}>{m.prescriptionRefresh.back}</Link>
        </Button>
      </div>
    );
  return (
    <div className="flex flex-col gap-4" aria-busy={busy}>
      <p>{m.prescriptionRefresh.lead}</p>
      <p className="font-semibold">{m.prescriptionRefresh.summary(count, preview.athletes.length)}</p>
      {preview.athletes.map((athlete) => (
        <section key={athlete.athleteId} className="on-card rounded-card bg-card p-4" aria-label={athlete.name}>
          <h2 className="t-section break-words">{athlete.name}</h2>
          <p className="mt-1">{m.prescriptionRefresh.status[athlete.status]}</p>
          {athlete.changes.map((change) => (
            <div key={change.itemRef} className="mt-4 border-t border-card-line pt-3">
              <h3 className="font-semibold break-words">
                {change.exerciseName} · {change.percentage} %
              </h3>
              <div className="mt-2 grid gap-4 tablet:grid-cols-2">
                <LoadValue label={m.prescriptionRefresh.before} value={change.before} />
                <LoadValue label={m.prescriptionRefresh.after} value={change.after} />
              </div>
            </div>
          ))}
          {athlete.incompatible.map((item) => (
            <p key={item.itemRef} className="mt-3 break-words">
              {item.exerciseName} : {m.prescriptionRefresh.incompatible}
            </p>
          ))}
        </section>
      ))}
      {error ? <p role="alert">{error}</p> : null}
      {!count ? <p>{m.prescriptionRefresh.empty}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={busy} onClick={() => void request(false)}>
          {m.prescriptionRefresh.reload}
        </Button>
        <ConfirmDialog
          title={m.prescriptionRefresh.title}
          tone="neutral"
          description={m.prescriptionRefresh.confirmDetail(count)}
          confirmLabel={m.prescriptionRefresh.confirm}
          trigger={<Button disabled={busy || stale || !count}>{m.prescriptionRefresh.confirm}</Button>}
          onConfirm={() => void request(true)}
        />
      </div>
    </div>
  );
};
