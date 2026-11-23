"use client";

import type { HistoryShareScope } from "@tartan/contracts";
import { HISTORY_SCOPES } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckRow } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { shareHistoryAction } from "./history-share.action";

const t = w.personal.share;

// Juste après l'arrivée dans le groupe d'un coach : facultatif, case par case. La santé n'est pas une case.
export const HistoryShareForm = ({ organizationId }: { organizationId: string }) => {
  const router = useRouter();
  const [scopes, setScopes] = useState<HistoryShareScope[]>([]);
  const [error, setError] = useState<string | null>(null);
  const leave = () => {
    router.push("/aujourdhui");
    router.refresh();
  };
  const share = useAction(shareHistoryAction, {
    onSuccess: () => {
      toast.ok(t.shared);
      leave();
    },
    onError: ({ error: failure }) => setError(failure.serverError ?? m.common.genericError),
  });
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (scopes.length === 0) {
          setError(t.pickOne);
          return;
        }
        setError(null);
        share.execute({ organizationId, scopes });
      }}
    >
      <fieldset className="flex flex-col">
        <legend className="font-semibold">{t.scopesLabel}</legend>
        {HISTORY_SCOPES.map((scope) => (
          <CheckRow
            key={scope}
            label={t.scopes[scope]}
            detail={t.scopeDetail[scope]}
            checked={scopes.includes(scope)}
            onChange={(event) =>
              setScopes(event.target.checked ? [...scopes, scope] : scopes.filter((entry) => entry !== scope))
            }
          />
        ))}
      </fieldset>
      <p className="t-caption font-normal text-soft">{t.health}</p>
      <p className="t-caption font-normal text-soft">{t.revocable}</p>
      {error ? (
        <p role="alert" className="text-alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-3 tablet:flex-row tablet:justify-between">
        <Button type="button" variant="secondary" size="lg" disabled={share.isPending} onClick={leave}>
          {t.skip}
        </Button>
        <Button type="submit" size="lg" disabled={share.isPending}>
          {t.submit}
        </Button>
      </div>
    </form>
  );
};
