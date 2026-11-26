"use client";
import type { FilmingNote } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { onErr } from "@/features/settings/shared";
import { saveFilmingAction } from "./exercise.action";

export function FilmingForm({ note }: { note: FilmingNote }) {
  const [draft, setDraft] = useState(note);
  const action = useAction(saveFilmingAction, {
    onError: onErr,
    onSuccess: ({ data }) => {
      if (data) setDraft(data);
    },
  });
  return (
    <form
      className="on-card grid gap-3 rounded-card bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        action.execute(draft);
      }}
    >
      <h2 className="t-section">{m.filming.title}</h2>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          checked={draft.filmed}
          onChange={(e) => setDraft({ ...draft, filmed: e.target.checked })}
        />
        {m.filming.filmed}
      </label>
      <Field label={m.filming.comment}>
        {(attrs) => (
          <Textarea
            {...attrs}
            maxLength={2000}
            value={draft.comment}
            onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
          />
        )}
      </Field>
      <Button type="submit" disabled={action.isPending}>
        {m.common.save}
      </Button>
    </form>
  );
}
