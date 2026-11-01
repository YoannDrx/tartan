"use client";

import { m } from "@tartan/i18n";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export const ForgotPasswordForm = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (sent) {
    return (
      <p role="status" className="font-semibold">
        {m.auth.resetSent}
      </p>
    );
  }
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!email.includes("@")) return setError("Saisis une adresse e-mail valide");
        setError(null);
        setPending(true);
        const res = await authClient.requestPasswordReset({ email, redirectTo: "/nouveau-mot-de-passe" });
        setPending(false);
        // Même réponse que l'adresse existe ou non : le formulaire ne révèle pas qui a un compte.
        if (res.error?.status === 429) setError(m.errors.rateLimited);
        else setSent(true);
      }}
    >
      <Field label={m.auth.emailLabel} error={error ?? undefined}>
        {(a) => (
          <Input
            {...a}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {m.auth.resetSend}
      </Button>
    </form>
  );
};

export const NewPasswordForm = ({ token }: { token: string | null }) => {
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!token) return <p role="alert">{m.auth.resetInvalid}</p>;
  if (done) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <p className="font-semibold">{m.auth.resetDone}</p>
        <Button asChild>
          <Link href="/connexion">{m.auth.signInWithPassword}</Link>
        </Button>
      </div>
    );
  }
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < 10) return setError("10 caractères minimum");
        setError(null);
        setPending(true);
        const res = await authClient.resetPassword({ newPassword: password, token });
        setPending(false);
        if (res.error) setError(m.auth.resetInvalid);
        else setDone(true);
      }}
    >
      <Field label={m.auth.newPassword} hint="10 caractères minimum" error={error ?? undefined}>
        {(a) => (
          <Input
            {...a}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {m.common.save}
      </Button>
    </form>
  );
};
