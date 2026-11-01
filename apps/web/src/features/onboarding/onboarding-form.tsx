"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { createSpaceAction } from "./onboarding.action";

const schema = z.object({
  firstName: z.string().trim().min(1, "Indique ton prénom"),
  lastName: z.string().trim().min(1, "Indique ton nom"),
  name: z.string().trim().min(1, "Donne un nom à ton espace"),
  type: z.enum(["club", "independent"]),
  firstGroupName: z.string().trim().min(1, "Donne un nom à ton premier groupe"),
});

export const OnboardingForm = ({ firstName, lastName }: { firstName: string; lastName: string }) => {
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { firstName, lastName, name: "", type: "independent" as const, firstGroupName: "" },
  });
  const { errors } = form.formState;
  const { execute, isPending } = useAction(createSpaceAction, {
    onSuccess: () => {
      router.push("/suivi");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  const prenom = form.watch("firstName") || "Thomas";

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit((v) =>
        execute({
          name: v.name,
          type: v.type,
          firstGroupName: v.firstGroupName,
          disciplines: ["high_jump"],
          profile: { firstName: v.firstName, lastName: v.lastName },
        }),
      )}
    >
      <fieldset className="flex flex-col gap-4">
        <legend className="t-h2 mb-3">{m.onboarding.profileTitle}</legend>
        <div className="grid gap-4 tablet:grid-cols-2">
          <Field label={m.onboarding.firstName} error={errors.firstName?.message}>
            {(a) => <Input {...a} autoComplete="given-name" {...form.register("firstName")} />}
          </Field>
          <Field label={m.onboarding.lastName} error={errors.lastName?.message}>
            {(a) => <Input {...a} autoComplete="family-name" {...form.register("lastName")} />}
          </Field>
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-4">
        <legend className="t-h2 mb-3">{m.onboarding.orgTitle}</legend>
        <Field label={m.onboarding.orgType}>
          {(a) => (
            <Select {...a} {...form.register("type")}>
              <option value="independent">{m.onboarding.orgTypeIndependent}</option>
              <option value="club">{m.onboarding.orgTypeClub}</option>
            </Select>
          )}
        </Field>
        <Field label={m.onboarding.orgName} hint={m.onboarding.orgNameHint(prenom)} error={errors.name?.message}>
          {(a) => <Input {...a} {...form.register("name")} />}
        </Field>
        <Field
          label={m.onboarding.firstGroup}
          hint={m.onboarding.firstGroupHint}
          error={errors.firstGroupName?.message}
        >
          {(a) => <Input {...a} {...form.register("firstGroupName")} />}
        </Field>
      </fieldset>
      <Button type="submit" size="lg" disabled={isPending}>
        {m.onboarding.createSpace}
      </Button>
    </form>
  );
};
