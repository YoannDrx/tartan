"use client";

import { requiresParentalConsent } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckRow, Field, Input } from "@/components/ui/field";
import { acceptInvitationAction } from "./invitation.action";

export const AcceptForm = ({
  token,
  role,
  firstName,
  lastName,
  birthDate,
}: {
  token: string;
  role: "athlete" | "coach" | "assistant";
  firstName: string;
  lastName: string;
  birthDate: string;
}) => {
  const router = useRouter();
  const isAthlete = role === "athlete";
  const [values, setValues] = useState({ firstName, lastName, birthDate, guardianEmail: "" });
  const [consents, setConsents] = useState({ terms: false, health: false, video: false });
  const [formError, setFormError] = useState<string | null>(null);
  const minor = isAthlete && values.birthDate ? requiresParentalConsent(values.birthDate, new Date()) : false;
  const { execute, isPending, result } = useAction(acceptInvitationAction, {
    onSuccess: () => {
      router.push("/accueil");
      router.refresh();
    },
    onError: ({ error }) => setFormError(error.serverError ?? m.common.genericError),
  });
  const fieldErrors = result.validationErrors as Record<string, { _errors?: string[] }> | undefined;

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
        execute({
          token,
          firstName: values.firstName,
          lastName: values.lastName,
          birthDate: values.birthDate || null,
          guardianEmail: minor ? values.guardianEmail : undefined,
          consents,
        });
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
      {isAthlete ? (
        <Field label={m.invite.birthDate} error={fieldErrors?.birthDate?._errors?.[0]}>
          {(a) => (
            <Input
              {...a}
              type="date"
              autoComplete="bday"
              value={values.birthDate}
              onChange={(e) => setValues({ ...values, birthDate: e.target.value })}
            />
          )}
        </Field>
      ) : null}
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
      <div className="flex flex-col border-t border-border pt-2">
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
            <p className="t-caption mt-1 font-normal text-muted">{m.invite.consentOptional}</p>
          </>
        ) : null}
      </div>
      {formError ? (
        <p role="alert" className="text-brand-strong">
          {formError}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={isPending}>
        {m.invite.accept}
      </Button>
    </form>
  );
};
