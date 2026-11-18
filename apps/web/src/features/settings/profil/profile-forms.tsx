"use client";

import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { useAction } from "next-safe-action/hooks";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { updateProfileAction, uploadAvatarAction } from "../settings.action";
import { onErr, type AnyErrors } from "../shared";

const t = w.settings.profil;

export const ProfileForm = ({
  firstName,
  lastName,
  birthDate,
  units,
}: {
  firstName: string;
  lastName: string;
  birthDate: string;
  units: string;
}) => {
  const [v, setV] = useState({ firstName, lastName, birthDate, units });
  const { execute, isPending, result } = useAction(updateProfileAction, {
    onSuccess: () => toast.ok(t.saved),
    onError: onErr,
  });
  const errors = result.validationErrors as AnyErrors;
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        execute({
          firstName: v.firstName,
          lastName: v.lastName,
          birthDate: v.birthDate || null,
          units: v.units as "kg" | "lb",
        });
      }}
    >
      <div className="grid gap-4 tablet:grid-cols-2">
        <Field label={m.onboarding.firstName} error={errors?.firstName?._errors?.[0]}>
          {(a) => (
            <Input
              {...a}
              autoComplete="given-name"
              value={v.firstName}
              onChange={(e) => setV({ ...v, firstName: e.target.value })}
            />
          )}
        </Field>
        <Field label={m.onboarding.lastName} error={errors?.lastName?._errors?.[0]}>
          {(a) => (
            <Input
              {...a}
              autoComplete="family-name"
              value={v.lastName}
              onChange={(e) => setV({ ...v, lastName: e.target.value })}
            />
          )}
        </Field>
        <Field label={m.invite.birthDate} hint={m.age.alreadySet}>
          {(a) => <DateInput {...a} value={v.birthDate} readOnly />}
        </Field>
        <Field label={t.units}>
          {(a) => (
            <Select {...a} value={v.units} onChange={(e) => setV({ ...v, units: e.target.value })}>
              <option value="kg">{t.kg}</option>
              <option value="lb">{t.lb}</option>
            </Select>
          )}
        </Field>
      </div>
      <Button type="submit" size="sm" variant="secondary" className="self-start" disabled={isPending}>
        {m.common.save}
      </Button>
    </form>
  );
};

export const AvatarForm = ({ avatarUrl, name }: { avatarUrl: string | null; name: string }) => {
  const router = useRouter();
  const { execute, isPending } = useAction(uploadAvatarAction, { onSuccess: () => router.refresh(), onError: onErr });
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card-raised font-semibold">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={t.avatarAlt(name)} fill sizes="64px" className="object-cover" unoptimized />
        ) : (
          name.slice(0, 2).toUpperCase()
        )}
      </span>
      <Field label={m.settings.photo} hint={m.settings.photoHint} className="flex-1">
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
