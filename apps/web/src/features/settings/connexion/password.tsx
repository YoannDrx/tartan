"use client";

import { PASSWORD_MIN_LENGTH } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckRow, Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/components/ui/toast";
import {
  changePasswordAction,
  definePasswordAction,
  requestPasswordSetupAction,
} from "@/features/auth/credentials.action";
import type { AnyErrors } from "../shared";

const t = w.settings.connexion;

// Le compte n'a pas de mot de passe et la session est récente : un champ, une action.
export const DefinePasswordForm = ({ email, confirmed }: { email: string; confirmed: boolean }) => {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // La session a vieilli entre l'affichage et l'envoi : le lien de confirmation est parti à la place.
  const [confirmationSent, setConfirmationSent] = useState(false);
  const { execute, isPending, result } = useAction(definePasswordAction, {
    onSuccess: ({ data }) => {
      if (data?.status === "confirmation_sent") {
        setConfirmationSent(true);
        return;
      }
      setPassword("");
      toast.ok(t.define.done);
      router.replace("/reglages/connexion");
      router.refresh();
    },
    onError: ({ error: failure }) => {
      if (!failure.validationErrors) setError(failure.serverError ?? m.common.genericError);
    },
  });
  const fieldError = (result.validationErrors as AnyErrors)?.newPassword?._errors?.[0];

  if (confirmationSent) return <p role="status">{t.define.confirmSent(email)}</p>;
  return (
    <form
      noValidate
      className="flex max-w-md flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if (password.length < PASSWORD_MIN_LENGTH) {
          setError(w.auth.passwordTooShort(PASSWORD_MIN_LENGTH));
          return;
        }
        execute({ newPassword: password });
      }}
    >
      {confirmed ? (
        <p role="status" className="font-semibold">
          {t.define.confirmed}
        </p>
      ) : null}
      <p className="max-w-prose">{t.define.detail}</p>
      {/* L'adresse accompagne le mot de passe : le gestionnaire de mots de passe range les deux ensemble. */}
      <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
      <Field label={t.define.field} hint={w.auth.passwordHint(PASSWORD_MIN_LENGTH)} error={error ?? fieldError}>
        {(a11y) => (
          <PasswordInput
            {...a11y}
            name="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>
      <Button type="submit" className="self-start" disabled={isPending}>
        {t.define.submit}
      </Button>
    </form>
  );
};

// Session ancienne : rien ne se saisit avant d'avoir confirmé par e-mail que c'est bien la bonne personne.
export const ConfirmPasswordSetup = ({ email }: { email: string }) => {
  const [state, setState] = useState<"idle" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const { execute, isPending } = useAction(requestPasswordSetupAction, {
    onSuccess: () => setState("sent"),
    onError: ({ error: failure }) => setError(failure.serverError ?? m.common.genericError),
  });
  return (
    <div className="flex max-w-prose flex-col items-start gap-3">
      <p>{t.define.confirmLead}</p>
      {state === "sent" ? (
        <p role="status" className="font-semibold">
          {t.define.confirmSent(email)}
        </p>
      ) : (
        <Button
          disabled={isPending}
          onClick={() => {
            setError(null);
            execute();
          }}
        >
          {t.define.confirmCta}
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export const ChangePasswordForm = ({ email }: { email: string }) => {
  const [values, setValues] = useState({ current: "", next: "" });
  const [revoke, setRevoke] = useState(false);
  const [errors, setErrors] = useState<{ current?: string; next?: string; form?: string }>({});
  const { execute, isPending } = useAction(changePasswordAction, {
    onSuccess: ({ data }) => {
      setValues({ current: "", next: "" });
      setRevoke(false);
      toast.ok(data?.revoked ? t.change.doneRevoked : t.change.done);
    },
    onError: ({ error: failure }) => {
      const validation = failure.validationErrors as AnyErrors;
      if (validation) {
        setErrors({
          current: validation.currentPassword?._errors?.[0],
          next: validation.newPassword?._errors?.[0],
        });
        return;
      }
      const message = failure.serverError ?? m.common.genericError;
      // Chaque refus s'affiche à côté du champ qu'il concerne.
      if (message === w.auth.errors.wrongCurrent) setErrors({ current: message });
      else if (message === w.auth.errors.sameAsCurrent) setErrors({ next: message });
      else setErrors({ form: message });
    },
  });

  return (
    <form
      noValidate
      className="flex max-w-md flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!values.current) {
          setErrors({ current: w.auth.passwordRequired });
          return;
        }
        if (values.next.length < PASSWORD_MIN_LENGTH) {
          setErrors({ next: w.auth.passwordTooShort(PASSWORD_MIN_LENGTH) });
          return;
        }
        setErrors({});
        execute({ currentPassword: values.current, newPassword: values.next, revokeOtherSessions: revoke });
      }}
    >
      <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
      <Field label={t.change.current} error={errors.current}>
        {(a11y) => (
          <PasswordInput
            {...a11y}
            name="current-password"
            autoComplete="current-password"
            value={values.current}
            onChange={(event) => setValues({ ...values, current: event.target.value })}
          />
        )}
      </Field>
      <Field label={t.change.next} hint={w.auth.passwordHint(PASSWORD_MIN_LENGTH)} error={errors.next}>
        {(a11y) => (
          <PasswordInput
            {...a11y}
            name="new-password"
            autoComplete="new-password"
            value={values.next}
            onChange={(event) => setValues({ ...values, next: event.target.value })}
          />
        )}
      </Field>
      <CheckRow
        label={t.change.revoke}
        detail={t.change.revokeDetail}
        checked={revoke}
        onChange={(event) => setRevoke(event.target.checked)}
      />
      {errors.form ? (
        <p role="alert" className="text-alert">
          {errors.form}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Button type="submit" disabled={isPending}>
          {t.change.submit}
        </Button>
        <Link href="/mot-de-passe-oublie" className="inline-flex min-h-11 items-center underline">
          {t.change.forgot}
        </Link>
      </div>
    </form>
  );
};
