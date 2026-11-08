"use client";
import type { CalendarSession } from "@tartan/contracts";
import { publicationCandidates, publicationSelection } from "@tartan/domain";
import { formatDateLong, m } from "@tartan/i18n";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { publishSessionsAction } from "./session.action";
const t = m.batchPublication;
export function BatchPublication({ sessions }: { sessions: CalendarSession[] }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [review, setReview] = useState<CalendarSession[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const publish = useAction(publishSessionsAction, {
    onSuccess: () => {
      setReview(null);
      setSelected([]);
      toast.ok(t.success);
      router.refresh();
    },
    onError: ({ error }) => setError(error.serverError ?? m.common.genericError),
  });
  const candidates = publicationCandidates(sessions);
  if (!candidates.length && !review) return null;
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={refreshing}
        onClick={() => {
          setReview(candidates);
          setSelected([]);
          setError(null);
        }}
      >
        {t.open}
      </Button>
      <Dialog
        open={review !== null}
        onOpenChange={(open) => {
          if (!open && !publish.isPending) setReview(null);
        }}
        title={t.title}
        description={t.hint}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            publish.execute(publicationSelection(review ?? [], selected));
          }}
        >
          <p className="text-soft">{t.atomic}</p>
          <p role="status">{t.selected(selected.length)}</p>
          <ul className="divide-y divide-card-line">
            {review?.map((s) => (
              <li key={s.id} className="py-3">
                <label className="flex min-h-11 items-start gap-3">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    disabled={publish.isPending || (selected.length >= 14 && !selected.includes(s.id))}
                    onChange={(e) =>
                      setSelected((ids) => (e.target.checked ? [...ids, s.id] : ids.filter((id) => id !== s.id)))
                    }
                  />
                  <span className="min-w-0">
                    <strong className="block break-words">{s.title}</strong>
                    <span className="block">
                      {formatDateLong(s.date)} · {s.audience}
                    </span>
                    {s.publishAt ? <span className="block text-soft">{t.scheduled}</span> : null}
                  </span>
                </label>
                <Link className="inline-flex min-h-11 items-center" href={`/seances/${s.id}`}>
                  {t.edit}
                </Link>
              </li>
            ))}
          </ul>
          {error ? (
            <>
              <p role="alert">{error}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setReview(null);
                  startRefresh(() => router.refresh());
                }}
              >
                {t.refresh}
              </Button>
            </>
          ) : null}
          <Button type="submit" disabled={!selected.length || publish.isPending}>
            {t.confirm(selected.length)}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
