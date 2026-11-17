"use client";

import type { TrainingProfile } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { useAction } from "next-safe-action/hooks";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckRow, Field, Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { TrainingProfileFields } from "@/features/onboarding/training-profile-fields";
import { updateOrganizationAction, uploadLogoAction } from "../settings.action";
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

export const LogoForm = ({ logoUrl, name }: { logoUrl: string | null; name: string }) => {
  const router = useRouter();
  const { execute, isPending } = useAction(uploadLogoAction, { onSuccess: () => router.refresh(), onError: onErr });
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-thumb bg-card-raised font-semibold">
        {logoUrl ? (
          <Image src={logoUrl} alt={t.logoAlt(name)} fill sizes="64px" className="object-contain" unoptimized />
        ) : (
          name.slice(0, 2).toUpperCase()
        )}
      </span>
      <Field label={m.settings.logo} hint={m.settings.logoHint} className="flex-1">
        {(a) => (
          <Input
            {...a}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="py-2"
            disabled={isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) execute({ file });
            }}
          />
        )}
      </Field>
    </div>
  );
};
