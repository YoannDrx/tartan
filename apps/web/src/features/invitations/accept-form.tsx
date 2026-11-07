"use client";

import { ageAt, requiresParentalConsent } from "@tartan/domain";
import { confirmAgeInput } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CheckRow, Field, Input } from "@/components/ui/field";
import { acceptInvitationAction } from "./invitation.action";

export const AcceptForm = ({
  token,
  role,
  firstName,
  lastName,
  birthDate,
  parentalFlow,
}: {
  token: string;
  role: "athlete" | "coach" | "assistant";
  firstName: string;
  lastName: string;
  birthDate: string;
  parentalFlow: boolean;
}) => {
  const router = useRouter();
  const isAthlete = role === "athlete";
  const [values, setValues] = useState({ firstName, lastName, birthDate, guardianEmail: "" });
  const [consents, setConsents] = useState({ terms: false, health: false, video: false });
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const minor =
    parentalFlow && isAthlete && values.birthDate ? requiresParentalConsent(values.birthDate, new Date()) : false;
  const { execute, isPending, result } = useAction(acceptInvitationAction, {
    onSuccess: () => {
      router.push("/accueil");
      router.refresh();
    },
    // Un champ refusé affiche son erreur à côté de lui : inutile d'accuser la connexion.
    onError: ({ error }) => {
      if (!error.validationErrors) setFormError(error.serverError ?? m.common.genericError);
    },
  });
  const fieldErrors = result.validationErrors as Record<string, { _errors?: string[] }> | undefined;
  const accept = () =>
    execute({
      token,
      firstName: values.firstName,
      lastName: values.lastName,
      birthDate: values.birthDate || null,
      guardianEmail: minor ? values.guardianEmail : undefined,
      consents,
    });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setFormError(null);
        if (!consents.terms) {
          setFormError(m.invite.termsRequired);
          return;
        }
        if (!confirmAgeInput.safeParse({ birthDate: values.birthDate }).success) {
          setFormError(m.invite.birthRequired);
          return;
        }
        if (birthDate) accept();
        else setConfirming(true);
      }}
    >
      <div className="grid gap-4 tablet:grid-cols-2">
        <Field label={m.onboarding.firstName} error={fieldErrors?.firstName?._errors?.[0]}>
          {(a) => (
            <Input
              {...a}
              autoComplete="given-name"
              value={values.firstName}
              onChange={(e) => setValues({ ...values, firstName: e.target.value })}
            />
          )}
        </Field>
        <Field label={m.onboarding.lastName} error={fieldErrors?.lastName?._errors?.[0]}>
          {(a) => (
            <Input
              {...a}
              autoComplete="family-name"
              value={values.lastName}
              onChange={(e) => setValues({ ...values, lastName: e.target.value })}
            />
          )}
        </Field>
      </div>
      <Field label={m.invite.birthDate} error={fieldErrors?.birthDate?._errors?.[0]}>
        {(a) => (
          <Input
            {...a}
            type="date"
            autoComplete="bday"
            value={values.birthDate}
            readOnly={Boolean(birthDate) && !parentalFlow}
            onChange={(e) => setValues({ ...values, birthDate: e.target.value })}
          />
        )}
      </Field>
      {minor ? (
        <Field
          label={m.invite.guardianEmail}
          hint={m.invite.guardianHint}
          error={fieldErrors?.guardianEmail?._errors?.[0]}
        >
          {(a) => (
            <Input
              {...a}
              type="email"
              autoComplete="off"
              value={values.guardianEmail}
              onChange={(e) => setValues({ ...values, guardianEmail: e.target.value })}
            />
          )}
        </Field>
      ) : null}
      <div className="flex flex-col border-t border-card-line pt-2">
        <CheckRow
          label={m.invite.consentTerms}
          checked={consents.terms}
          onChange={(e) => setConsents({ ...consents, terms: e.target.checked })}
        />
        {isAthlete ? (
          <>
            <CheckRow
              label={m.invite.consentHealth}
              checked={consents.health}
              onChange={(e) => setConsents({ ...consents, health: e.target.checked })}
            />
            <CheckRow
              label={m.invite.consentVideo}
              checked={consents.video}
              onChange={(e) => setConsents({ ...consents, video: e.target.checked })}
            />
            <p className="t-caption mt-1 font-normal text-soft">{m.invite.consentOptional}</p>
          </>
        ) : null}
      </div>
      {formError ? (
        <p role="alert" className="text-alert">
          {formError}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={isPending}>
        {m.invite.accept}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
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
        onConfirm={accept}
      />
    </form>
  );
};
