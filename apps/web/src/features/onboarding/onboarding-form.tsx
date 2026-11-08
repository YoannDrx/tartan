"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { ageAt } from "@tartan/domain";
import { confirmAgeInput, trainingProfileSchema } from "@tartan/contracts";
import { z } from "zod";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CheckRow, Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { TrainingProfileFields } from "./training-profile-fields";
import { createSpaceAction } from "./onboarding.action";

const schema = z.object({
  ...trainingProfileSchema.shape,
  firstGroupGoal: z.string().trim().max(280),
  firstName: z.string().trim().min(1, "Indique ton prénom"),
  lastName: z.string().trim().min(1, "Indique ton nom"),
  birthDate: confirmAgeInput.shape.birthDate,
  name: z.string().trim().min(1, "Donne un nom à ton espace"),
  type: z.enum(["club", "independent"]),
  firstGroupName: z.string().trim().min(1, "Donne un nom à ton premier groupe"),
  termsAccepted: z.boolean().refine(Boolean, m.invite.termsRequired),
});

export const OnboardingForm = ({
  firstName,
  lastName,
  birthDate,
  nextPath,
}: {
  firstName: string;
  lastName: string;
  birthDate: string;
  nextPath: string;
}) => {
  const router = useRouter();
  const [pending, setPending] = useState<z.infer<typeof schema> | null>(null);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName,
      lastName,
      birthDate,
      name: "",
      type: "independent" as const,
      firstGroupName: "",
      firstGroupGoal: "",
      disciplines: [] as string[],
      trainingObjectives: [] as z.infer<typeof trainingProfileSchema>["trainingObjectives"],
      availableEquipment: [] as z.infer<typeof trainingProfileSchema>["availableEquipment"],
      termsAccepted: false,
    },
  });
  const { errors } = form.formState;
  const { execute, isPending } = useAction(createSpaceAction, {
    onSuccess: () => {
      router.push(nextPath);
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  const prenom = form.watch("firstName") || "Thomas";
  const save = (v: z.infer<typeof schema>) =>
    execute({
      name: v.name,
      type: v.type,
      firstGroupName: v.firstGroupName,
      disciplines: v.disciplines,
      trainingObjectives: v.trainingObjectives,
      availableEquipment: v.availableEquipment,
      firstGroupGoal: v.firstGroupGoal,
      profile: { firstName: v.firstName, lastName: v.lastName, birthDate: v.birthDate },
      termsAccepted: true,
    });

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit((v) => (birthDate ? save(v) : setPending(v)))}
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
        <Field label={m.invite.birthDate} error={errors.birthDate?.message}>
          {(a) => (
            <Input
              {...a}
              type="date"
              autoComplete="bday"
              readOnly={Boolean(birthDate)}
              {...form.register("birthDate")}
            />
          )}
        </Field>
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
        <Field
          label={m.trainingProfile.firstGroupGoal}
          hint={m.trainingProfile.groupGoalHint}
          error={errors.firstGroupGoal?.message}
        >
          {(a) => <Input {...a} maxLength={280} {...form.register("firstGroupGoal")} />}
        </Field>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="t-h2 mb-3">{m.trainingProfile.title}</legend>
        <TrainingProfileFields
          value={{
            disciplines: form.watch("disciplines"),
            trainingObjectives: form.watch("trainingObjectives"),
            availableEquipment: form.watch("availableEquipment"),
          }}
          disabled={isPending}
          onChange={(value) => {
            form.setValue("disciplines", value.disciplines);
            form.setValue("trainingObjectives", value.trainingObjectives);
            form.setValue("availableEquipment", value.availableEquipment);
          }}
        />
      </fieldset>
      <div>
        <CheckRow label={m.invite.consentTerms} {...form.register("termsAccepted")} />
        {errors.termsAccepted ? (
          <p role="alert" className="text-alert">
            {errors.termsAccepted.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={isPending}>
        {m.onboarding.createSpace}
      </Button>
      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={m.age.checkTitle}
        description={
          pending
            ? m.age.check(
                new Date(`${pending.birthDate}T12:00:00Z`).toLocaleDateString("fr-FR"),
                ageAt(pending.birthDate, new Date(), "Europe/Paris"),
              )
            : undefined
        }
        confirmLabel={m.age.saveConfirmed}
        cancelLabel={m.age.correct}
        tone="neutral"
        onConfirm={() => {
          if (pending) save(pending);
        }}
      />
    </form>
  );
};
