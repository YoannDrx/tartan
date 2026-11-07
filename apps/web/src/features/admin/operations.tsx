"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { correctBirthDateAction, retryEmailAction } from "./operations.action";

export const RetryEmail = ({ id }: { id: string }) => {
  const retry = useAction(retryEmailAction, {
    onSuccess: () => toast.ok(m.admin.retryQueued),
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  return (
    <ConfirmDialog
      title={m.admin.retryEmail}
      description={m.admin.retryEmailDetail}
      confirmLabel={m.admin.retryEmail}
      tone="neutral"
      onConfirm={() => retry.execute({ id })}
      trigger={
        <Button variant="secondary" size="sm" disabled={retry.isPending}>
          {m.admin.retryEmail}
        </Button>
      }
    />
  );
};

export const BirthDateCorrection = () => {
  const [userId, setUserId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [reason, setReason] = useState<"verified_support_request" | "migration_error">("verified_support_request");
  const correction = useAction(correctBirthDateAction, {
    onSuccess: () => {
      toast.ok(m.admin.correctionDone);
      setUserId("");
      setBirthDate("");
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <p className="text-soft">{m.admin.correctionDetail}</p>
      <Field label={m.admin.userId}>
        {(a) => <Input {...a} value={userId} onChange={(e) => setUserId(e.target.value)} />}
      </Field>
      <Field label={m.invite.birthDate}>
        {(a) => <Input {...a} type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />}
      </Field>
      <Field label={m.admin.correctionReason}>
        {(a) => (
          <Select {...a} value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
            {Object.entries(m.admin.correctionReasons).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <ConfirmDialog
        title={m.admin.correctionConfirm}
        description={`${userId} · ${birthDate} · ${m.admin.correctionReasons[reason]}`}
        confirmLabel={m.admin.correctionConfirm}
        tone="neutral"
        onConfirm={() => correction.execute({ userId, birthDate, reason })}
        trigger={<Button disabled={correction.isPending || !userId || !birthDate}>{m.admin.correctionConfirm}</Button>}
      />
    </div>
  );
};
