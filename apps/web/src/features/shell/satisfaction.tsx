"use client";

import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { answerSatisfactionAction } from "./shell.action";

export const SatisfactionQuestion = () => {
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const send = useAction(answerSatisfactionAction, {
    onSuccess: () => {
      setDone(true);
      toast.ok(m.satisfaction.thanks);
    },
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  if (done) return null;
  return (
    <aside aria-label={m.satisfaction.question} className="on-card rounded-card bg-card p-4">
      <p className="t-h2">{m.satisfaction.question}</p>
      {answer === null ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setAnswer(true)}>
            {m.satisfaction.yes}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAnswer(false)}>
            {m.satisfaction.no}
          </Button>
        </div>
      ) : (
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            send.execute({ recommend: answer, comment });
          }}
        >
          <Field label={m.satisfaction.why}>
            {(a) => <Textarea {...a} value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />}
          </Field>
          <Button type="submit" size="sm" className="self-start" disabled={send.isPending}>
            {m.common.send}
          </Button>
        </form>
      )}
    </aside>
  );
};
