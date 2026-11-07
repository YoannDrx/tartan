"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { m } from "@tartan/i18n";
import { ageAt } from "@tartan/domain";
import { confirmAgeInput } from "@tartan/contracts";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { confirmAgeAction } from "./age.action";

export const ConfirmAgeForm = () => {
  const router = useRouter();
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
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
        if (!confirmAgeInput.safeParse({ birthDate }).success || birthDate > new Date().toISOString().slice(0, 10)) {
          setError(m.invite.birthRequired);
          return;
        }
        setError(undefined);
        setConfirming(true);
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
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={m.age.checkTitle}
        description={m.age.check(
          new Date(`${birthDate}T12:00:00Z`).toLocaleDateString("fr-FR"),
          ageAt(birthDate, new Date(), "Europe/Paris"),
        )}
        confirmLabel={m.age.saveConfirmed}
        cancelLabel={m.age.correct}
        tone="neutral"
        onConfirm={() => execute({ birthDate })}
      />
    </form>
  );
};
