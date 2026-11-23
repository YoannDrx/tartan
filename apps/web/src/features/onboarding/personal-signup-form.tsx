"use client";

import { confirmAgeInput, type TrainingProfile } from "@tartan/contracts";
import { ageAt } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { useAction } from "next-safe-action/hooks";
import { useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateInput } from "@/components/ui/date-input";
import { CheckRow, Field, Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { Stepper } from "./onboarding-form";
import { createPersonalSpaceAction } from "./personal-space.action";
import { TrainingProfileFields } from "./training-profile-fields";

const t = w.welcome.soloForm;
const NAMES = [t.steps.start, t.steps.ready, t.steps.go] as const;
const LAST = NAMES.length - 1;

type Errors = Partial<Record<"firstName" | "lastName" | "birthDate" | "terms", string>>;

// « Je m'entraîne seul » : trois temps, comme la création de l'espace d'un coach. Toi, ton entraînement, les
// conditions ; puis l'espace personnel naît et l'athlète arrive sur sa journée.
export const PersonalSignupForm = ({
  firstName,
  lastName,
  birthDate,
}: {
  firstName: string;
  lastName: string;
  birthDate: string;
}) => {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({ firstName, lastName, birthDate });
  const [profile, setProfile] = useState<TrainingProfile>({
    disciplines: [],
    trainingObjectives: [],
    availableEquipment: [],
  });
  const [consents, setConsents] = useState({ terms: false, health: false, video: false });
  const [errors, setErrors] = useState<Errors>({});
  const [confirming, setConfirming] = useState(false);
  const headings = useRef<(HTMLLegendElement | null)[]>([]);
  const confirmed = useRef(false);
  const { execute, isPending } = useAction(createPersonalSpaceAction, {
    onError: ({ error }) => {
      confirmed.current = false;
      toast.error(error.serverError ?? m.common.genericError);
    },
  });

  // Le temps affiché prend le focus d'un seul geste : le lecteur d'écran l'annonce, le clavier repart du haut.
  const goTo = (target: number) => {
    flushSync(() => setStep(target));
    headings.current[target]?.focus();
    headings.current[target]?.scrollIntoView({ block: "start" });
  };
  const checkProfile = (): boolean => {
    const next: Errors = {};
    if (!values.firstName.trim()) next.firstName = m.onboarding.errors.firstName;
    if (!values.lastName.trim()) next.lastName = m.onboarding.errors.lastName;
    if (!confirmAgeInput.safeParse({ birthDate: values.birthDate }).success) next.birthDate = m.invite.birthRequired;
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const save = () =>
    execute({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      ...(birthDate ? {} : { birthDate: values.birthDate }),
      disciplines: profile.disciplines,
      trainingObjectives: profile.trainingObjectives,
      termsAccepted: true,
      consents: { health: consents.health, video: consents.video },
    });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Entrée fait avancer d'un temps ; seul le dernier ouvre l'espace.
    if (step === 0) {
      if (checkProfile()) goTo(1);
      return;
    }
    if (step < LAST) {
      goTo(step + 1);
      return;
    }
    if (!checkProfile()) {
      goTo(0);
      return;
    }
    if (!consents.terms) {
      setErrors({ terms: m.invite.termsRequired });
      return;
    }
    if (birthDate) save();
    else setConfirming(true);
  };
  const legend = (index: number, text: string) => (
    <legend
      tabIndex={-1}
      ref={(node) => {
        headings.current[index] = node;
      }}
      className="t-h2 mb-3 outline-none"
    >
      {text}
    </legend>
  );

  return (
    <form noValidate data-step={step} onSubmit={submit} className="flex flex-col gap-6">
      <Stepper step={step} names={NAMES} label={t.stepsLabel} />
      <p className="sr-only" role="status">
        {m.onboarding.stepStatus(step + 1, NAMES.length, NAMES[step]!)}
      </p>
      <fieldset hidden={step !== 0} className="flex flex-col gap-4">
        {legend(0, t.profileTitle)}
        <div className="grid gap-4 tablet:grid-cols-2">
          <Field label={m.onboarding.firstName} error={errors.firstName}>
            {(a) => (
              <Input
                {...a}
                autoComplete="given-name"
                value={values.firstName}
                onChange={(event) => setValues({ ...values, firstName: event.target.value })}
              />
            )}
          </Field>
          <Field label={m.onboarding.lastName} error={errors.lastName}>
            {(a) => (
              <Input
                {...a}
                autoComplete="family-name"
                value={values.lastName}
                onChange={(event) => setValues({ ...values, lastName: event.target.value })}
              />
            )}
          </Field>
        </div>
        <Field label={m.invite.birthDate} error={errors.birthDate}>
          {(a) => (
            <DateInput
              {...a}
              autoComplete="bday"
              readOnly={Boolean(birthDate)}
              value={values.birthDate}
              onChange={(event) => setValues({ ...values, birthDate: event.target.value })}
            />
          )}
        </Field>
      </fieldset>
      <fieldset hidden={step !== 1} className="flex flex-col gap-3">
        {legend(1, t.trainingTitle)}
        <TrainingProfileFields
          value={profile}
          keys={["disciplines", "trainingObjectives"]}
          hint={t.trainingHint}
          disabled={isPending}
          onChange={setProfile}
        />
      </fieldset>
      <fieldset hidden={step !== LAST} className="flex flex-col gap-3">
        {legend(LAST, t.termsTitle)}
        <p className="max-w-prose">{t.termsLead}</p>
        <p className="t-caption font-normal text-soft">{t.quotas}</p>
        <CheckRow
          label={m.invite.consentTerms}
          checked={consents.terms}
          onChange={(event) => setConsents({ ...consents, terms: event.target.checked })}
        />
        {errors.terms ? (
          <p role="alert" className="text-alert">
            {errors.terms}
          </p>
        ) : null}
        <fieldset className="mt-2 flex flex-col border-t border-card-line pt-3">
          <legend className="font-semibold">{m.invite.consentsTitle}</legend>
          <p className="t-caption font-normal text-soft">{m.invite.consentOptional}</p>
          <CheckRow
            label={m.invite.consentHealth}
            detail={t.consentHealthWhy}
            checked={consents.health}
            onChange={(event) => setConsents({ ...consents, health: event.target.checked })}
          />
          <CheckRow
            label={m.invite.consentVideo}
            detail={t.consentVideoWhy}
            checked={consents.video}
            onChange={(event) => setConsents({ ...consents, video: event.target.checked })}
          />
        </fieldset>
      </fieldset>
      <div className="flex flex-col-reverse gap-3 tablet:flex-row tablet:justify-between">
        {step > 0 ? (
          <Button type="button" variant="secondary" size="lg" disabled={isPending} onClick={() => goTo(step - 1)}>
            {m.onboarding.back}
          </Button>
        ) : (
          <span />
        )}
        {step < LAST ? (
          <Button key="next" type="submit" size="lg">
            {m.onboarding.next}
          </Button>
        ) : (
          <Button key="create" type="submit" size="lg" disabled={isPending}>
            {t.create}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          if (open) return;
          setConfirming(false);
          // « Corriger » ramène à la date ; « Confirmer » laisse l'écran tel quel pendant la création.
          if (!confirmed.current) goTo(0);
        }}
        title={m.age.checkTitle}
        description={
          values.birthDate
            ? m.age.check(
                new Date(`${values.birthDate}T12:00:00Z`).toLocaleDateString("fr-FR"),
                ageAt(values.birthDate, new Date(), "Europe/Paris"),
              )
            : undefined
        }
        confirmLabel={m.age.saveConfirmed}
        cancelLabel={m.age.correct}
        tone="neutral"
        onConfirm={() => {
          confirmed.current = true;
          setConfirming(false);
          save();
        }}
      />
    </form>
  );
};
