"use client";

import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckRow } from "@/components/ui/field";
import { answerParentalAction } from "./invitation.action";

export const ParentalForm = ({ token }: { token: string }) => {
  const [scope, setScope] = useState({ health: true, video: true });
  const [answered, setAnswered] = useState<"granted" | "refused" | null>(null);
  const { execute, isPending, result } = useAction(answerParentalAction, {
    onSuccess: ({ input }) => setAnswered(input.decision),
  });
  if (answered) {
    return (
      <div role="status" className="rounded-card border border-border bg-surface p-4">
        <p className="font-semibold">{answered === "granted" ? m.parental.grantedTitle : m.parental.refusedTitle}</p>
        {answered === "refused" ? <p className="mt-1 text-muted">{m.parental.refusedBody}</p> : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <CheckRow
          label={m.parental.health}
          checked={scope.health}
          onChange={(e) => setScope({ ...scope, health: e.target.checked })}
        />
        <CheckRow
          label={m.parental.video}
          checked={scope.video}
          onChange={(e) => setScope({ ...scope, video: e.target.checked })}
        />
      </div>
      <p className="t-caption font-normal text-muted">{m.parental.otherParent}</p>
      {result.serverError ? (
        <p role="alert" className="text-brand-strong">
          {result.serverError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="lg" disabled={isPending} onClick={() => execute({ token, decision: "granted", scope })}>
          {m.parental.grant}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          disabled={isPending}
          onClick={() => execute({ token, decision: "refused", scope: { health: false, video: false } })}
        >
          {m.parental.refuse}
        </Button>
      </div>
    </div>
  );
};
