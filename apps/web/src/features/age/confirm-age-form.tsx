"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { confirmAgeAction } from "./age.action";

export const ConfirmAgeForm = () => {
  const router = useRouter();
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState<string | undefined>();
  const { execute, isPending } = useAction(confirmAgeAction, {
    onSuccess: () => {
      router.replace("/accueil");
      router.refresh();
    },
    onError: ({ error: failure }) => {
      // Une date refusée ouvre l'écran qui explique la suite : le serveur l'a enregistrée.
      setError(failure.validationErrors ? m.invite.birthRequired : undefined);
      if (failure.serverError) router.refresh();
    },
  });
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!birthDate) {
          setError(m.invite.birthRequired);
          return;
        }
        setError(undefined);
        execute({ birthDate });
      }}
    >
      <Field label={m.invite.birthDate} error={error}>
        {(a) => (
          <Input
            {...a}
            type="date"
            autoComplete="bday"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        )}
      </Field>
      <Button type="submit" size="lg" disabled={isPending}>
        {m.age.confirm}
      </Button>
    </form>
  );
};
