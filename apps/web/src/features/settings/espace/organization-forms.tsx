"use client";

import type { TrainingProfile } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckRow, Field, Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { TrainingProfileFields } from "@/features/onboarding/training-profile-fields";
import { LogoEditor } from "@/features/avatar/avatar-editor";
import { updateOrganizationAction } from "../settings.action";
import { onErr, type AnyErrors } from "../shared";

const t = w.settings.espace;

export const OrganizationForm = ({
  name,
  overdueReminders,
  disciplines,
  trainingObjectives,
  availableEquipment,
}: {
  name: string;
  overdueReminders: boolean;
} & TrainingProfile) => {
  const [v, setV] = useState({ name, overdueReminders, disciplines, trainingObjectives, availableEquipment });
  const { execute, isPending, result } = useAction(updateOrganizationAction, {
    onSuccess: () => toast.ok(t.saved),
    onError: onErr,
  });
  const errors = result.validationErrors as AnyErrors;
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        execute(v);
      }}
    >
      <Field label={m.onboarding.orgName} error={errors?.name?._errors?.[0]}>
        {(a) => <Input {...a} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
      </Field>
      <TrainingProfileFields value={v} disabled={isPending} onChange={(profile) => setV({ ...v, ...profile })} />
      <CheckRow
        label={m.settings.overdueReminders}
        detail={m.settings.overdueRemindersDetail}
        checked={v.overdueReminders}
        onChange={(e) => setV({ ...v, overdueReminders: e.target.checked })}
      />
      <Button type="submit" size="sm" variant="secondary" className="self-start" disabled={isPending}>
        {m.common.save}
      </Button>
    </form>
  );
};

// Le logo passe par le même recadrage que la photo de profil.
export const LogoForm = ({ logoUrl, name }: { logoUrl: string | null; name: string }) => (
  <section aria-labelledby="logo-espace" className="flex flex-col gap-3">
    <h3 id="logo-espace" className="t-caption text-inherit">
      {m.settings.logo}
    </h3>
    <LogoEditor logoUrl={logoUrl} name={name} alt={t.logoAlt(name)} />
  </section>
);
