"use client";

import { PASSWORD_MIN_LENGTH } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { KeyRound, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";
import { LinkSent, type ResendOutcome, type SentKind } from "./link-sent";

// Se connecter à un compte, ou en créer un : seul le chemin par mot de passe diffère.
export type SignInIntent = "signin" | "create";

type AuthError = { status?: number; code?: string } | null | undefined;

// Ce qu'un refus du serveur veut dire pour la personne. Jamais le message brut : il pourrait dire qu'un compte existe.
const failure = (error: AuthError, fallback: string): string =>
  error?.status === 429 ? w.auth.rateLimited : error?.code === "EMAIL_UNREACHABLE" ? m.auth.emailUnreachable : fallback;

const outcomeOf = (error: AuthError): ResendOutcome =>
  !error ? "sent" : error.status === 429 ? "limited" : error.code === "EMAIL_UNREACHABLE" ? "unreachable" : "failed";

const validEmail = (value: string) => z.email().safeParse(value).success;

// Sur un téléphone étroit (320 à 360 px), un long libellé passe sur deux lignes au lieu de déborder de la carte.
const PATH_BUTTON = "px-4 py-2 leading-snug whitespace-normal";

// L'adresse d'abord, puis deux chemins de même rang : le mot de passe, ou un lien reçu par e-mail.
export const SignInForm = ({
  callbackURL = "/accueil",
  providers,
  defaultEmail,
  intent: initialIntent = "signin",
  switchable = false,
}: {
  callbackURL?: string;
  providers: ("google" | "apple")[];
  defaultEmail?: string;
  intent?: SignInIntent;
  // Sur une invitation, on ne sait pas si la personne a déjà un compte : elle le dit elle-même.
  switchable?: boolean;
}) => {
  const [intent, setIntent] = useState<SignInIntent>(initialIntent);
  const [step, setStep] = useState<"paths" | "password">("paths");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [pending, setPending] = useState<"password" | "link" | null>(null);
  const [sent, setSent] = useState<{ kind: SentKind; email: string; notice?: string } | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const t = intent === "create" ? w.auth.create : w.auth.signIn;

  // Le champ du mot de passe vient d'apparaître : la saisie continue dedans.
  useEffect(() => {
    if (step === "password") passwordRef.current?.focus();
  }, [step]);

  const address = email.trim();
  const checkEmail = (): boolean => {
    if (validEmail(address)) return true;
    setErrors({ email: w.auth.emailInvalid });
    emailRef.current?.focus();
    return false;
  };

  const requestLink = (to: string) =>
    authClient.signIn.magicLink({
      email: to,
      callbackURL,
      errorCallbackURL: `/connexion?lien=expire&next=${encodeURIComponent(callbackURL)}`,
    });

  const sendLink = async () => {
    if (!checkEmail()) return;
    setErrors({});
    setPending("link");
    const res = await requestLink(address);
    setPending(null);
    if (res.error) setErrors({ form: failure(res.error, m.common.genericError) });
    else setSent({ kind: "magic", email: address });
  };

  const submitPassword = async () => {
    if (!checkEmail()) return;
    if (intent === "create" && password.length < PASSWORD_MIN_LENGTH) {
      setErrors({ password: w.auth.passwordTooShort(PASSWORD_MIN_LENGTH) });
      return;
    }
    if (!password) {
      setErrors({ password: w.auth.passwordRequired });
      return;
    }
    setErrors({});
    setPending("password");
    if (intent === "create") {
      const res = await authClient.signUp.email(
        { email: address, password, name: address.split("@")[0] ?? address, callbackURL },
        // Si l'adresse a déjà un compte, l'e-mail qui le dit ramène à la page d'où l'on vient (une invitation).
        { headers: { "x-tartan-return": callbackURL } },
      );
      setPending(null);
      // Même écran qu'un compte existe déjà ou non : c'est l'e-mail qui fait la différence.
      if (res.error) setErrors({ form: failure(res.error, m.common.genericError) });
      else setSent({ kind: "verify", email: address });
      return;
    }
    const res = await authClient.signIn.email({ email: address, password, callbackURL });
    if (!res.error) {
      // Une seule navigation complète : sous Safari, enchaîner push et refresh rechargeait la page et effaçait la saisie suivante.
      window.location.assign(callbackURL);
      return;
    }
    setPending(null);
    // Bon mot de passe sur une adresse pas encore confirmée : le lien de confirmation vient de repartir.
    if (res.error.status === 403) setSent({ kind: "verify", email: address, notice: w.auth.sent.verifyFirst });
    else setErrors({ form: failure(res.error, w.auth.invalidCredentials) });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (step === "password") void submitPassword();
    else if (checkEmail()) {
      setErrors({});
      setStep("password");
    }
  };

  if (sent) {
    return (
      <LinkSent
        kind={sent.kind}
        email={sent.email}
        notice={sent.notice}
        onResend={async () => {
          const res =
            sent.kind === "magic"
              ? await requestLink(sent.email)
              : await authClient.sendVerificationEmail({ email: sent.email, callbackURL });
          return outcomeOf(res.error);
        }}
        onChangeEmail={() => {
          setSent(null);
          setStep("paths");
          setPassword("");
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label={m.auth.emailLabel} error={errors.email}>
          {(a11y) => (
            <Input
              {...a11y}
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder={m.auth.emailPlaceholder}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>
        {step === "password" ? (
          <Field
            label={t.passwordLabel}
            hint={intent === "create" ? w.auth.passwordHint(PASSWORD_MIN_LENGTH) : undefined}
            error={errors.password}
          >
            {(a11y) => (
              <PasswordInput
                {...a11y}
                ref={passwordRef}
                name="password"
                autoComplete={intent === "create" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </Field>
        ) : null}
        {errors.form ? (
          <p role="alert" className="text-alert">
            {errors.form}
          </p>
        ) : null}
        {step === "paths" ? (
          <div role="group" aria-label={w.auth.paths} className="flex flex-col gap-3">
            <Button type="submit" size="lg" className={PATH_BUTTON} disabled={pending !== null}>
              <KeyRound aria-hidden className="size-4 shrink-0" />
              {t.withPassword}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className={PATH_BUTTON}
              disabled={pending !== null}
              onClick={() => void sendLink()}
            >
              <Mail aria-hidden className="size-4 shrink-0" />
              {t.withLink}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button type="submit" size="lg" disabled={pending !== null}>
              {t.submit}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className={PATH_BUTTON}
              disabled={pending !== null}
              onClick={() => void sendLink()}
            >
              <Mail aria-hidden className="size-4 shrink-0" />
              {w.auth.linkInstead}
            </Button>
            {intent === "signin" ? (
              <Link href="/mot-de-passe-oublie" className="inline-flex min-h-11 items-center self-start underline">
                {w.auth.signIn.forgot}
              </Link>
            ) : null}
          </div>
        )}
      </form>
      {providers.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-card-line pt-4">
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
        </div>
      ) : null}
      {switchable ? (
        <button
          type="button"
          className="min-h-11 self-start text-ctx-link underline"
          onClick={() => {
            setIntent(intent === "create" ? "signin" : "create");
            setErrors({});
          }}
        >
          {intent === "create" ? w.auth.haveAccount : w.auth.noAccountYet}
        </button>
      ) : null}
      <p className="t-caption font-normal text-soft">
        {w.auth.terms.before} <a href="/conditions">{w.auth.terms.conditions}</a> {w.auth.terms.between}{" "}
        <a href="/confidentialite">{w.auth.terms.privacy}</a>.
      </p>
    </div>
  );
};
