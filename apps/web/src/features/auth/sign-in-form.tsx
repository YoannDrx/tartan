"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

const schema = z.object({
  email: z.email("Saisis une adresse e-mail valide"),
  password: z.string().optional(),
});

export const SignInForm = ({
  callbackURL = "/accueil",
  providers,
  defaultEmail,
}: {
  callbackURL?: string;
  providers: ("google" | "apple")[];
  defaultEmail?: string;
}) => {
  const router = useRouter();
  const [mode, setMode] = useState<"magic" | "signin" | "signup">("magic");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: defaultEmail ?? "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setError(null);
    if (mode === "magic") {
      const res = await authClient.signIn.magicLink({ email, callbackURL });
      if (res.error) setError(m.common.genericError);
      else setSent(true);
      return;
    }
    const res =
      mode === "signin"
        ? await authClient.signIn.email({ email, password: password ?? "", callbackURL })
        : await authClient.signUp.email({
            email,
            password: password ?? "",
            name: email.split("@")[0] ?? email,
            callbackURL,
          });
    if (res.error) {
      setError(mode === "signin" ? m.auth.invalidCredentials : (res.error.message ?? m.common.genericError));
      return;
    }
    router.push(callbackURL);
    router.refresh();
  });

  if (sent) {
    return (
      <div role="status">
        <p className="font-semibold">{m.auth.magicLinkSent}</p>
        <button type="button" className="mt-2 min-h-11 text-ctx-link underline" onClick={() => setSent(false)}>
          Changer d'adresse
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {providers.includes("apple") ? (
        <Button
          variant="inverse"
          size="lg"
          onClick={() => authClient.signIn.social({ provider: "apple", callbackURL })}
        >
          {m.auth.withApple}
        </Button>
      ) : null}
      {providers.includes("google") ? (
        <Button
          variant="secondary"
          size="lg"
          onClick={() => authClient.signIn.social({ provider: "google", callbackURL })}
        >
          {m.auth.withGoogle}
        </Button>
      ) : null}
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label={m.auth.emailLabel} error={errors.email?.message}>
          {(a11y) => (
            <Input
              {...a11y}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder={m.auth.emailPlaceholder}
              {...form.register("email")}
            />
          )}
        </Field>
        {mode !== "magic" ? (
          <Field label={m.auth.passwordLabel} hint={mode === "signup" ? "10 caractères minimum" : undefined}>
            {(a11y) => (
              <Input
                {...a11y}
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                {...form.register("password")}
              />
            )}
          </Field>
        ) : null}
        {error ? (
          <p role="alert" className="text-alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {mode === "magic"
            ? m.auth.sendMagicLink
            : mode === "signin"
              ? m.auth.signInWithPassword
              : m.auth.signUpWithPassword}
        </Button>
      </form>
      <div className="flex flex-col items-start">
        {mode === "magic" ? (
          <button type="button" className="min-h-11 text-ctx-link underline" onClick={() => setMode("signin")}>
            {m.auth.usePassword}
          </button>
        ) : (
          <>
            {mode === "signin" ? (
              <a href="/mot-de-passe-oublie" className="inline-flex min-h-11 items-center">
                {m.auth.forgotPassword}
              </a>
            ) : null}
            <button
              type="button"
              className="min-h-11 text-ctx-link underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin"
                ? `${m.auth.noAccount} ${m.auth.signUpWithPassword}`
                : `${m.auth.hasAccount} ${m.auth.signInWithPassword}`}
            </button>
            <button type="button" className="min-h-11 text-ctx-link underline" onClick={() => setMode("magic")}>
              {m.auth.useMagicLink}
            </button>
          </>
        )}
      </div>
      <p className="t-caption font-normal text-soft">
        En continuant, tu acceptes les <a href="/conditions">conditions d'utilisation</a> et la{" "}
        <a href="/confidentialite">politique de confidentialité</a>.
      </p>
    </div>
  );
};
