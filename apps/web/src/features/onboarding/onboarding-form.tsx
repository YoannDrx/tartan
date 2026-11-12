"use client";

import { DateInput } from "@/components/ui/date-input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Check } from "lucide-react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ageAt } from "@tartan/domain";
import { confirmAgeInput, trainingProfileSchema } from "@tartan/contracts";
import { z } from "zod";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CheckRow, Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { TrainingProfileFields } from "./training-profile-fields";
import { createSpaceAction } from "./onboarding.action";

const schema = z.object({
  ...trainingProfileSchema.shape,
  firstGroupGoal: z.string().trim().max(280),
  firstName: z.string().trim().min(1, m.onboarding.errors.firstName),
  lastName: z.string().trim().min(1, m.onboarding.errors.lastName),
  birthDate: confirmAgeInput.shape.birthDate,
  name: z.string().trim().min(1, m.onboarding.errors.name),
  type: z.enum(["club", "independent"]),
  firstGroupName: z.string().trim().min(1, m.onboarding.errors.firstGroupName),
  termsAccepted: z.boolean().refine(Boolean, m.invite.termsRequired),
});

type Values = z.infer<typeof schema>;

// Trois temps, comme un départ : chacun ne demande que ce qu'il lui faut, et se valide avant le suivant.
const STEPS: { name: string; fields: (keyof Values)[] }[] = [
  { name: m.onboarding.steps.start, fields: ["firstName", "lastName", "birthDate"] },
  { name: m.onboarding.steps.ready, fields: ["type", "name", "firstGroupName", "firstGroupGoal"] },
  { name: m.onboarding.steps.go, fields: ["termsAccepted"] },
];
const LAST = STEPS.length - 1;

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
  const [pending, setPending] = useState<Values | null>(null);
  const [step, setStep] = useState(0);
  const headings = useRef<(HTMLLegendElement | null)[]>([]);
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
  // Le titre du temps affiché reçoit le focus : le lecteur d'écran l'annonce, le clavier repart du haut.
  // Le temps s'affiche et prend le focus d'un seul geste : un focus donné une image plus tard arrachait
  // la saisie à un champ déjà rempli.
  const goTo = (target: number) => {
    flushSync(() => setStep(target));
    headings.current[target]?.focus();
    headings.current[target]?.scrollIntoView({ block: "start" });
  };
  const next = async () => {
    if (await form.trigger(STEPS[step]!.fields, { shouldFocus: true })) goTo(step + 1);
  };
  const save = (v: Values) =>
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
      onSubmit={(event) => {
        // Entrée dans un champ fait avancer d'un temps ; seul le dernier crée l'espace.
        if (step < LAST) {
          event.preventDefault();
          void next();
          return;
        }
        void form.handleSubmit(
          (v) => (birthDate ? save(v) : setPending(v)),
          (invalid) => {
            // Une erreur dans un temps précédent y ramène, au lieu de rester muette sous un écran masqué.
            const first = STEPS.findIndex((entry) => entry.fields.some((field) => field in invalid));
            if (first >= 0 && first !== step) goTo(first);
          },
        )(event);
      }}
    >
      <ol aria-label={m.onboarding.stepsLabel} className="grid grid-cols-3 gap-2">
        {STEPS.map((entry, index) => (
          <li
            key={entry.name}
            aria-current={index === step ? "step" : undefined}
            className={cn(
              "flex flex-col gap-1 border-t-[3px] pt-2",
              index <= step ? "border-accent" : "border-card-line text-soft",
            )}
          >
            <span aria-hidden className="t-num flex h-7 items-center text-[24px]">
              {index < step ? <Check className="size-6" /> : index + 1}
            </span>
            <span className={cn("t-caption", index === step ? "font-semibold" : "font-normal")}>{entry.name}</span>
          </li>
        ))}
      </ol>
      <p className="sr-only" role="status">
        {m.onboarding.stepStatus(step + 1, STEPS.length, STEPS[step]!.name)}
      </p>
      <fieldset hidden={step !== 0} className="flex flex-col gap-4">
        <legend
          tabIndex={-1}
          ref={(node) => {
            headings.current[0] = node;
          }}
          className="t-h2 mb-3 outline-none"
        >
          {m.onboarding.profileTitle}
        </legend>
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
            <DateInput
              {...a}
              autoComplete="bday"
              readOnly={Boolean(birthDate)}
              value={form.watch("birthDate") ?? ""}
              onChange={(event) =>
                form.setValue("birthDate", event.target.value, {
                  shouldDirty: true,
                  shouldValidate: form.formState.isSubmitted,
                })
              }
            />
          )}
        </Field>
      </fieldset>
      <fieldset hidden={step !== 1} className="flex flex-col gap-4">
        <legend
          tabIndex={-1}
          ref={(node) => {
            headings.current[1] = node;
          }}
          className="t-h2 mb-3 outline-none"
        >
          {m.onboarding.orgTitle}
        </legend>
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
      <fieldset hidden={step !== LAST} className="flex flex-col gap-3">
        <legend
          tabIndex={-1}
          ref={(node) => {
            headings.current[LAST] = node;
          }}
          className="t-h2 mb-3 outline-none"
        >
          {m.trainingProfile.title}
        </legend>
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
      <div hidden={step !== LAST}>
        <CheckRow label={m.invite.consentTerms} {...form.register("termsAccepted")} />
        {errors.termsAccepted ? (
          <p role="alert" className="text-alert">
            {errors.termsAccepted.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col-reverse gap-3 tablet:flex-row tablet:justify-between">
        {step > 0 ? (
          <Button type="button" variant="secondary" size="lg" disabled={isPending} onClick={() => goTo(step - 1)}>
            {m.onboarding.back}
          </Button>
        ) : (
          <span />
        )}
        {/* Deux éléments distincts : sans clé, le bouton cliqué deviendrait le bouton d'envoi pendant le clic. */}
        {step < LAST ? (
          <Button key="next" type="button" size="lg" onClick={() => void next()}>
            {m.onboarding.next}
          </Button>
        ) : (
          <Button key="submit" type="submit" size="lg" disabled={isPending}>
            {m.onboarding.createSpace}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (open) return;
          setPending(null);
          // Corriger ramène à la date, qui est au premier temps.
          goTo(0);
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
