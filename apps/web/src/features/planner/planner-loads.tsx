"use client";

import { createApiClient } from "@tartan/api-client";
import {
  plannerReviewedDraft,
  loadSchema,
  type PlannerLoadsPreview,
  type PlannerReviewedDraft,
  type Prescription,
} from "@tartan/contracts";
import { formatPrescription, plannerLoadSummary } from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";

const api = createApiClient({ baseUrl: "" });
const t = m.aiPlanner;
export function PlannerLoads({
  orgId,
  proposalId,
  version,
  session,
  disabled,
  onReady,
  onLoad,
}: {
  orgId: string;
  proposalId: string;
  version: number;
  session: PlannerReviewedDraft;
  disabled: boolean;
  onReady: (key: string, ready: boolean) => void;
  onLoad: (athleteId: string, itemRef: string, load: Prescription["load"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expandedAthlete, setExpandedAthlete] = useState<string | null>(null);
  const uid = useId();
  const [cursors, setCursors] = useState<string[]>([]);
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<{ key: string; data?: PlannerLoadsPreview; error?: string } | null>(null);
  const [editing, setEditing] = useState<{
    athleteId: string;
    itemRef: string;
    exerciseId: string;
    title: string;
  } | null>(null);
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<"kg" | "pct_1rm">("kg");
  const [error, setError] = useState("");
  const requestValid = plannerReviewedDraft.safeParse(session).success;
  const sessionKey = JSON.stringify(session);
  // La pagination appartient à cette version de séance. Une correction repart
  // de la première page ; aucune réponse ancienne ne valide le nouvel aperçu.
  const [cursorSession, setCursorSession] = useState(sessionKey);
  const after = cursorSession === sessionKey ? cursors.at(-1) : undefined;
  const request = JSON.stringify({ expectedVersion: version, session, afterAthleteId: after });
  const key = `${orgId}:${proposalId}:${retry}:${request}`;
  const current = response?.key === key ? response : null;
  useEffect(() => {
    if (!open || !requestValid) return;
    let alive = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const debounce = setTimeout(() => {
      void api
        .previewPlannerLoads(orgId, proposalId, JSON.parse(request), controller.signal)
        .then((data) => {
          if (alive) setResponse({ key, data });
        })
        .catch((cause) => {
          if (alive)
            setResponse({
              key,
              error: controller.signal.aborted
                ? m.common.genericError
                : cause instanceof Error
                  ? cause.message
                  : m.common.genericError,
            });
        })
        .finally(() => clearTimeout(timeout));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timeout);
      clearTimeout(debounce);
      controller.abort();
    };
  }, [open, requestValid, orgId, proposalId, key, request]);
  const valid = Boolean(requestValid && current?.data && !current.error);
  useEffect(() => {
    onReady(sessionKey, valid);
  }, [sessionKey, valid, onReady]);
  useEffect(() => () => onReady(sessionKey, false), [sessionKey, onReady]);
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <Button
        type="button"
        variant="secondary"
        aria-expanded={open}
        disabled={disabled || !requestValid}
        onClick={() => setOpen(!open)}
      >
        {t.previewLoads}
      </Button>
      {open ? (
        <>
          <p className="text-soft">{t.previewProvisional}</p>
          {!current ? <p role="status">{m.common.loading}</p> : null}
          {current?.error ? (
            <>
              <p role="alert">{current.error}</p>
              <Button type="button" variant="secondary" onClick={() => setRetry((v) => v + 1)}>
                {m.common.retry}
              </Button>
            </>
          ) : null}
          {current?.data ? (
            <>
              <p role="status">
                {t.previewCoverage(current.data.offset + current.data.athletes.length, current.data.athleteCount)}
              </p>
              <p className="text-soft">{t.loadRowsHint}</p>
              <div role="group" aria-label={t.loadRows} className="divide-y divide-card-line border-y border-card-line">
                {current.data.athletes.map((athlete) => {
                  const summary = plannerLoadSummary(athlete, session.overrides);
                  const expanded = expandedAthlete === athlete.id;
                  const detailsId = `${uid}-${athlete.id}`;
                  return (
                    <section key={athlete.id}>
                      <h3>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={detailsId}
                          disabled={disabled}
                          onClick={() => setExpandedAthlete(expanded ? null : athlete.id)}
                          className="flex min-h-16 w-full items-center justify-between gap-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          <span className="min-w-0">
                            <span className="block font-semibold break-words">{athlete.name}</span>{" "}
                            <span id={`${detailsId}-summary`} className="block text-sm text-soft">
                              {t.loadRowSummary(summary.exercises, summary.unresolvedPercentages, summary.customized)}
                            </span>
                          </span>
                          <span aria-hidden="true" className="shrink-0">
                            {expanded ? "−" : "+"}
                          </span>
                        </button>
                      </h3>
                      <div id={detailsId} hidden={!expanded} className="pb-4">
                        {expanded
                          ? athlete.items.map((item) => {
                              const kind = item.source?.kind;
                              const sourceLabel =
                                kind && kind in m.strength.referenceKinds
                                  ? m.strength.referenceKinds[kind as keyof typeof m.strength.referenceKinds]
                                  : t.referenceSource;
                              return (
                                <div
                                  key={item.ref}
                                  className="flex min-w-0 flex-col gap-2 border-t border-card-line pt-3"
                                >
                                  <h4 className="font-semibold break-words">{item.name}</h4>
                                  <p>{formatPrescription(item.prescription, item.resolvedLoadKg)}</p>
                                  {item.prescription.load?.type === "pct_1rm" ? (
                                    <p className="text-soft">
                                      {item.prescription.load.value} {m.builder.loadPct}
                                      {item.resolvedLoadKg === null ? ` · ${t.loadUndefined}` : ""}
                                    </p>
                                  ) : null}
                                  {item.source ? (
                                    <p className="text-soft">
                                      {sourceLabel} : {item.source.value} kg · {historyDate(item.source.date)}
                                    </p>
                                  ) : null}
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      disabled={disabled}
                                      onClick={() => {
                                        setEditing({
                                          athleteId: athlete.id,
                                          itemRef: item.ref,
                                          exerciseId: item.exerciseId,
                                          title: `${athlete.name} · ${item.name}`,
                                        });
                                        setUnit(item.prescription.load?.type ?? "kg");
                                        setValue(item.prescription.load?.value.toString() ?? "");
                                        setError("");
                                      }}
                                    >
                                      {t.adaptLoad}
                                    </Button>
                                    {session.overrides.some(
                                      (o) =>
                                        o.athleteId === athlete.id && o.itemRef === item.ref && o.prescription.load,
                                    ) ? (
                                      <Button
                                        type="button"
                                        variant="quiet"
                                        disabled={disabled}
                                        onClick={() => onLoad(athlete.id, item.ref, undefined)}
                                      >
                                        {t.resetLoad}
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })
                          : null}
                      </div>
                    </section>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                {after ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={disabled}
                    onClick={() => {
                      setExpandedAthlete(null);
                      setCursors((old) => old.slice(0, -1));
                    }}
                  >
                    {t.previousAthletes}
                  </Button>
                ) : null}
                {current.data.nextCursor ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={disabled}
                    onClick={() => {
                      setExpandedAthlete(null);
                      setCursorSession(sessionKey);
                      setCursors((old) => [...(cursorSession === sessionKey ? old : []), current.data!.nextCursor!]);
                    }}
                  >
                    {t.nextAthletes}
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </>
      ) : null}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
        title={t.adaptLoad}
        description={editing?.title}
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!editing || disabled) return;
            const parsed = loadSchema.safeParse({
              type: unit,
              value: value.trim() ? Number(value.replace(",", ".")) : NaN,
              ...(unit === "pct_1rm" ? { test: `exercise:${editing.exerciseId}` } : {}),
            });
            if (!parsed.success) {
              setError(m.errors.invalid);
              return;
            }
            onLoad(editing.athleteId, editing.itemRef, parsed.data);
            setEditing(null);
          }}
        >
          <p>{t.noAutomaticLoad}</p>
          <Field label={m.nativeBuilder.unit}>
            {(a) => (
              <Select
                {...a}
                value={unit}
                disabled={disabled}
                onChange={(e) => setUnit(e.target.value === "kg" ? "kg" : "pct_1rm")}
              >
                <option value="kg">{m.builder.loadKg}</option>
                <option value="pct_1rm">{m.builder.loadPct}</option>
              </Select>
            )}
          </Field>
          <Field label={m.builder.load} error={error}>
            {(a) => (
              <Input
                {...a}
                inputMode="decimal"
                value={value}
                disabled={disabled}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" disabled={disabled}>
            {m.nativeBuilder.apply}
          </Button>
        </form>
      </Dialog>
    </section>
  );
}
