"use client";

import { w } from "@tartan/i18n/web";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

const TOKEN = /^[A-Za-z0-9._-]{16,200}$/;

// Le lien entier (`https://…/i/<code>`), le chemin (`/i/<code>`) ou le code seul : on garde ce qui suit « /i/ ».
export const invitationPathFrom = (raw: string): string | null => {
  const value = raw.trim();
  const code = value.includes("/i/") ? (value.split("/i/")[1] ?? "").split(/[?#/\s]/)[0]! : value;
  return TOKEN.test(code) ? `/i/${code}` : null;
};

export const InvitationCode = () => {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const path = invitationPathFrom(value);
    if (!path) {
      setError(w.welcome.invite.invalid);
      return;
    }
    setError(undefined);
    setPending(true);
    router.push(path);
  };
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3">
      <Field label={w.welcome.invite.label} hint={w.welcome.invite.hint} error={error}>
        {(a) => (
          <Input
            {...a}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="url"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}
      </Field>
      <Button type="submit" variant="secondary" size="lg" disabled={pending} className="tablet:self-start">
        {w.welcome.invite.open}
      </Button>
    </form>
  );
};
