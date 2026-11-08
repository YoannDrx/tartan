"use client";

import { DateInput } from "@/components/ui/date-input";
import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import {
  correctBirthDateAction,
  disableAiEverywhereAction,
  retryEmailAction,
  setSpaceFeaturesAction,
} from "./operations.action";

type SpaceFeatures = { progressionEnabled: boolean; phasesEnabled: boolean; aiPlannerEnabled: boolean };

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
        {(a) => <DateInput {...a} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />}
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

export const SpaceFeaturesForm = ({
  organizationId,
  name,
  discovery,
  features,
}: {
  organizationId: string;
  name: string;
  discovery: boolean;
  features: SpaceFeatures;
}) => {
  // La case garde son état pendant que la page se rafraîchit ; seul un refus la ramène en arrière.
  const [shown, setShown] = useState(features);
  const update = useAction(setSpaceFeaturesAction, {
    onSuccess: () => toast.ok(m.admin.featuresSaved),
    onError: ({ error }) => {
      setShown(features);
      toast.error(error.serverError ?? m.common.genericError);
    },
  });
  const options = [
    { key: "progressionEnabled", label: m.admin.featureProgression },
    { key: "phasesEnabled", label: m.admin.featurePhases },
    { key: "aiPlannerEnabled", label: m.admin.featureAi },
  ] as const;
  return (
    <fieldset className="py-2">
      <legend className="font-semibold">{name}</legend>
      <div className="flex flex-wrap gap-x-6">
        {options.map((option) => (
          <label key={option.key} className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={shown[option.key]}
              disabled={update.isPending}
              onChange={(event) => {
                const next = { ...shown, [option.key]: event.target.checked };
                setShown(next);
                update.execute({ organizationId, ...next });
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
      {discovery ? <p className="t-caption text-soft">{m.admin.aiNotInDiscovery}</p> : null}
    </fieldset>
  );
};

export const DisableAiEverywhere = () => {
  const disable = useAction(disableAiEverywhereAction, {
    onSuccess: () => toast.ok(m.admin.disableAiDone),
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  return (
    <ConfirmDialog
      title={m.admin.disableAi}
      description={m.admin.disableAiDetail}
      confirmLabel={m.admin.disableAi}
      onConfirm={() => disable.execute()}
      trigger={
        <Button variant="secondary" size="sm" disabled={disable.isPending}>
          {m.admin.disableAi}
        </Button>
      }
    />
  );
};
