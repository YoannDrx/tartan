"use client";

import { createApiClient } from "@tartan/api-client";
import { phasePlanningQuery, type PhasePlanningResponse, type PhasePlanningQuery } from "@tartan/contracts";
import { phasePlanningKey, type PhasePlanningReadiness } from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";

const t = m.trainingPhases;
export function PhasePlanningPanel({
  organizationId,
  date,
  groupIds,
  athleteIds,
  onReady,
}: {
  organizationId: string;
  date: string;
  groupIds: string[];
  athleteIds: string[];
  onReady: (state: PhasePlanningReadiness) => void;
}) {
  const key = phasePlanningKey(date, groupIds, athleteIds);
  const [choices, setChoices] = useState<PhasePlanningQuery["choices"]>([]);
  const [retry, setRetry] = useState(0);
  const queryString = JSON.stringify({ ...JSON.parse(key), choices });
  const requestKey = `${queryString}:${retry}`;
  const [response, setResponse] = useState<{ key: string; data?: PhasePlanningResponse; error?: string } | null>(null);
  const valid = phasePlanningQuery.safeParse(JSON.parse(queryString)).success;
  const hasAudience = groupIds.length + athleteIds.length > 0;
  useEffect(() => {
    if (!valid || !hasAudience) return;
    const controller = new AbortController();
    const api = createApiClient({
      baseUrl: "",
      fetch: (url, init) => fetch(url, { ...init, signal: controller.signal }),
    });
    void api
      .phasePlanning(organizationId, JSON.parse(queryString))
      .then((data) => {
        if (!controller.signal.aborted) setResponse({ key: requestKey, data });
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setResponse({ key: requestKey, error: cause instanceof Error ? cause.message : m.common.genericError });
      });
    return () => controller.abort();
  }, [organizationId, requestKey, queryString, valid, hasAudience]);
  const current = response?.key === requestKey ? response : null;
  const ready =
    !hasAudience || Boolean(current?.data && current.data.athletes.every((a) => a.result.kind !== "choose_group"));
  useEffect(() => {
    onReady({ key, ready });
  }, [key, ready, onReady]);
  return (
    <section aria-label={t.planning} className="flex min-w-0 flex-col gap-3 rounded-card border border-card-line p-4">
      <h2 className="t-section">{t.planning}</h2>
      <p className="text-soft">{t.planningHint}</p>
      {!hasAudience ? (
        <p>{t.noAudience}</p>
      ) : !valid ? (
        <p>{t.invalid}</p>
      ) : !current ? (
        <p role="status">{m.common.loading}</p>
      ) : null}
      {current?.error ? <p role="alert">{current.error}</p> : null}
      {current?.data ? (
        <>
          {current.data.groups.map((g) =>
            g.phase ? (
              <div key={g.id}>
                <h3 className="font-semibold break-words">
                  {g.name} : {g.phase.name}
                </h3>
                <p className="text-soft">
                  {t.kinds[g.phase.kind]} · {historyDate(g.phase.startDate)} – {historyDate(g.phase.endDate)}
                </p>
                {g.phase.objective ? <p className="break-words">{g.phase.objective}</p> : null}
              </div>
            ) : null,
          )}
          {current.data.athletes.some((a) => a.result.kind === "choose_group") ? (
            <p role="status">{t.chooseGroup}</p>
          ) : null}
          {current.data.athletes
            .filter((a) => a.result.kind === "choose_group")
            .map((a) => (
              <Field key={a.id} label={t.referenceFor(a.name)}>
                {(props) => (
                  <Select
                    {...props}
                    value=""
                    onChange={(event) =>
                      setChoices((old) => [
                        ...old.filter((c) => c.athleteId !== a.id),
                        { athleteId: a.id, groupId: event.target.value },
                      ])
                    }
                  >
                    <option value="" disabled>
                      {t.chooseTarget}
                    </option>
                    {a.result.kind === "choose_group"
                      ? a.result.phases.map((p) => (
                          <option key={p.id} value={p.target.id}>
                            {p.targetName} : {p.name}
                          </option>
                        ))
                      : null}
                  </Select>
                )}
              </Field>
            ))}
          <details>
            <summary className="min-h-11 cursor-pointer py-3 font-semibold">
              {t.planningAthletes(current.data.athletes.filter((a) => a.result.kind === "phase").length)}
            </summary>
            <ul className="space-y-2">
              {current.data.athletes.map((a) =>
                a.result.kind === "phase" ? (
                  <li key={a.id} className="break-words">
                    <span className="font-semibold">{a.name}</span> : {a.result.phase.name}
                    {a.result.phase.target.type === "athlete" ? (
                      <p className="text-soft">{t.individualPriority}</p>
                    ) : null}
                    {a.result.phase.objective ? <p>{a.result.phase.objective}</p> : null}
                  </li>
                ) : null,
              )}
            </ul>
          </details>
          {!current.data.groups.some((g) => g.phase) && !current.data.athletes.some((a) => a.result.kind !== "none") ? (
            <p>{t.noPlanning}</p>
          ) : null}
        </>
      ) : null}
      {hasAudience && valid ? (
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              setChoices([]);
              setRetry((n) => n + 1);
            }}
          >
            {t.retryPlanning}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
