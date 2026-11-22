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
import { w } from "@tartan/i18n/web";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";

const api = createApiClient({ baseUrl: "" });
const t = w.planner.loads;

/**
 * Les charges de chaque athlète pour la séance à l'écran. Une fois ouvert, l'aperçu le reste : à chaque retouche
 * de la séance il se met à jour sur place, l'athlète ouvert reste ouvert. `blocked` : pourquoi il ne peut pas
 * encore s'ouvrir (un exercice attend sa fiche).
 */
export function PlannerLoads({
  orgId,
  proposalId,
  version,
  session,
  disabled,
  blocked,
  onReady,
  onLoad,
}: {
  orgId: string;
  proposalId: string;
  version: number;
  session: PlannerReviewedDraft;
  disabled: boolean;
  blocked?: string;
  onReady: (key: string, ready: boolean) => void;
  onLoad: (athleteId: string, itemRef: string, load: Prescription["load"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expandedAthlete, setExpandedAthlete] = useState<string | null>(null);
  const uid = useId();
  const [cursors, setCursors] = useState<string[]>([]);
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<{ key: string; data?: PlannerLoadsPreview; error?: string } | null>(null);
  // Le dernier aperçu reçu reste affiché pendant que le suivant se calcule : rien ne se referme.
  const [shown, setShown] = useState<PlannerLoadsPreview | null>(null);
  const [editing, setEditing] = useState<{
    athleteId: string;
    itemRef: string;
    exerciseId: string;
    title: string;
  } | null>(null);
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<"kg" | "pct_1rm">("kg");
  const [error, setError] = useState("");
  const requestValid = !blocked && plannerReviewedDraft.safeParse(session).success;
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
          if (!alive) return;
          setResponse({ key, data });
          setShown(data);
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
  const updating = open && requestValid && !current;
  const data = open && requestValid ? (current?.data ?? shown) : null;
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <Button
        type="button"
        variant="secondary"
        className="self-start"
        aria-expanded={open}
        disabled={disabled || !requestValid}
        onClick={() => setOpen(!open)}
      >
        {t.open}
        <ChevronDown
          aria-hidden
          className={cn("size-5 transition-transform duration-(--duration-quick)", open && "rotate-180")}
        />
      </Button>
      {blocked ? <p className="t-caption font-normal text-soft">{blocked}</p> : null}
      {open && requestValid ? (
        <div className="flex min-w-0 flex-col gap-3" aria-busy={updating}>
          <p className="t-caption font-normal text-soft">{t.hint}</p>
          {/* Toujours présent : l'annonce de la mise à jour ne déplace rien. */}
          <p role="status" className="min-h-5 t-caption font-normal text-soft">
            {updating ? (shown ? t.updating : m.common.loading) : ""}
          </p>
          {current?.error ? (
            <div className="flex flex-wrap items-center gap-2">
              <p role="alert">{current.error}</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => setRetry((v) => v + 1)}>
                {m.common.retry}
              </Button>
            </div>
          ) : null}
          {data ? (
            <>
              <p>{t.coverage(data.offset + 1, data.offset + data.athletes.length, data.athleteCount)}</p>
              {data.athletes.length ? <p className="t-caption font-normal text-soft">{t.rowsHint}</p> : null}
              <div
                role="group"
                aria-label={t.rows}
                className={cn(
                  "divide-y divide-card-line border-y border-card-line transition-opacity duration-(--duration-quick)",
                  updating && "opacity-60",
                )}
              >
                {data.athletes.map((athlete) => {
                  const summary = plannerLoadSummary(athlete, session.overrides);
                  const expanded = expandedAthlete === athlete.id;
                  const detailsId = `${uid}-${athlete.id}`;
                  return (
                    <section key={athlete.id}>
                      <h4>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={detailsId}
                          disabled={disabled}
                          onClick={() => setExpandedAthlete(expanded ? null : athlete.id)}
                          className="flex min-h-16 w-full items-center justify-between gap-3 py-3 text-left"
                        >
                          <span className="min-w-0">
                            <span className="block break-words font-semibold">{athlete.name}</span>{" "}
                            <span className="block t-caption font-normal text-soft">
                              {t.rowSummary(summary.exercises, summary.unresolvedPercentages, summary.customized)}
                            </span>
                          </span>
                          <ChevronDown
                            aria-hidden
                            className={cn(
                              "size-5 shrink-0 transition-transform duration-(--duration-quick)",
                              expanded && "rotate-180",
                            )}
                          />
                        </button>
                      </h4>
                      <div id={detailsId} hidden={!expanded} className="pb-4">
                        {expanded
                          ? athlete.items.map((item) => {
                              const kind = item.source?.kind;
                              const sourceLabel =
                                kind && kind in m.strength.referenceKinds
                                  ? m.strength.referenceKinds[kind as keyof typeof m.strength.referenceKinds]
                                  : t.reference;
                              return (
                                <div
                                  key={item.ref}
                                  className="flex min-w-0 flex-col gap-2 border-t border-card-line pt-3"
                                >
                                  <h5 className="break-words font-semibold">{item.name}</h5>
                                  <p>{formatPrescription(item.prescription, item.resolvedLoadKg)}</p>
                                  {item.prescription.load?.type === "pct_1rm" ? (
                                    <p className="text-soft">
                                      {t.percent(item.prescription.load.value, m.builder.loadPct)}
                                      {item.resolvedLoadKg === null ? t.percentUndefined : ""}
                                    </p>
                                  ) : null}
                                  {item.source ? (
                                    <p className="text-soft">
                                      {t.source(sourceLabel, item.source.value, historyDate(item.source.date))}
                                    </p>
                                  ) : null}
                                  <div className="flex flex-wrap gap-2 pb-3">
                                    <Button
                                      type="button"
                                      size="sm"
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
                                      {t.adapt}
                                    </Button>
                                    {session.overrides.some(
                                      (o) =>
                                        o.athleteId === athlete.id && o.itemRef === item.ref && o.prescription.load,
                                    ) ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="quiet"
                                        disabled={disabled}
                                        onClick={() => onLoad(athlete.id, item.ref, undefined)}
                                      >
                                        {t.reset}
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
              {after || data.nextCursor ? (
                <div className="flex flex-wrap gap-2">
                  {after ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={disabled}
                      onClick={() => {
                        setExpandedAthlete(null);
                        setCursors((old) => old.slice(0, -1));
                      }}
                    >
                      {t.previous}
                    </Button>
                  ) : null}
                  {data.nextCursor ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={disabled || updating}
                      onClick={() => {
                        setExpandedAthlete(null);
                        setCursorSession(sessionKey);
                        setCursors((old) => [...(cursorSession === sessionKey ? old : []), data.nextCursor!]);
                      }}
                    >
                      {t.next}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
        title={t.adapt}
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
          <p>{t.noAutomatic}</p>
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
