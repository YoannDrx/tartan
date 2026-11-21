"use client";

import { PASSWORD_MIN_LENGTH } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { definePasswordAction, dismissPasswordPromptAction } from "./credentials.action";

const t = w.auth.prompt;

// Pour qui est entré par un lien : une proposition facultative, sous les séances, qui ne retarde rien.
// Refermée, elle l'est côté serveur : elle ne revient ni ici ni sur un autre appareil.
// `embedded` : posée dans la carte facultative de l'athlète, comme une ligne parmi d'autres, sans cadre propre.
export const PasswordPrompt = ({
  email,
  canSetNow,
  embedded = false,
}: {
  email: string;
  canSetNow: boolean;
  embedded?: boolean;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const define = useAction(definePasswordAction, {
    onSuccess: ({ data }) => {
      // La session a vieilli entre-temps : la rubrique Connexion prend le relais, avec le lien de confirmation.
      if (data?.status === "confirmation_sent") {
        router.push("/reglages/connexion");
        return;
      }
      setHidden(true);
      toast.ok(t.done);
      router.refresh();
    },
    onError: ({ error: failure }) => setError(failure.serverError ?? m.common.genericError),
  });
  const dismiss = useAction(dismissPasswordPromptAction, {
    onSuccess: () => toast.ok(t.dismissed),
    onError: () => {
      setHidden(false);
      toast.error(m.common.genericError);
    },
  });

  if (hidden) return null;
  const Title = embedded ? "h3" : "h2";
  return (
    <section
      aria-labelledby="mot-de-passe-propose"
      className={cn("flex flex-col gap-3", !embedded && "on-card rounded-card bg-card p-4")}
    >
      <div className="flex flex-col gap-1">
        <Title id="mot-de-passe-propose" className={cn("text-balance", embedded ? "font-semibold" : "t-h2")}>
          {t.title}
        </Title>
        <p className={cn("max-w-prose", embedded && "t-caption font-normal text-soft")}>{t.body}</p>
      </div>
      {open ? (
        <form
          noValidate
          className="flex max-w-md flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (password.length < PASSWORD_MIN_LENGTH) {
              setError(w.auth.passwordTooShort(PASSWORD_MIN_LENGTH));
              return;
            }
            setError(null);
            define.execute({ newPassword: password });
          }}
        >
          <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
          <Field label={t.field} hint={w.auth.passwordHint(PASSWORD_MIN_LENGTH)} error={error ?? undefined}>
            {(a11y) => (
              <PasswordInput
                {...a11y}
                autoFocus
                name="new-password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={define.isPending}>
              {t.submit}
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {canSetNow ? (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              {t.open}
            </Button>
          ) : (
            <Button asChild variant="secondary">
              <Link href="/reglages/connexion#mot-de-passe">{t.open}</Link>
            </Button>
          )}
          <Button
            variant="quiet"
            disabled={dismiss.isPending}
            onClick={() => {
              setHidden(true);
              dismiss.execute();
            }}
          >
            {t.dismiss}
          </Button>
        </div>
      )}
    </section>
  );
};
