"use client";

import { ApiError, createApiClient } from "@tartan/api-client";
import type { PlannerAliasList } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Fold } from "./planner-request";

const api = createApiClient({ baseUrl: "" });
const t = w.planner.aliases;
type Alias = PlannerAliasList["aliases"][number];

/**
 * « Mes termes » : ce que l'espace a appris au planificateur, chaque fois qu'un coach a choisi une fiche pour un
 * terme. Replié par défaut, chargé à l'ouverture. Retirer un terme le rend à la recherche dans la bibliothèque.
 */
export function PlannerAliases({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; aliases?: Alias[]; failed?: boolean } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const key = `${orgId}:${attempt}`;
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void api
      .plannerAliases(orgId, controller.signal)
      .then((data) => setState({ key, aliases: data.aliases }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, failed: true });
      });
    return () => controller.abort();
  }, [open, orgId, key]);
  const current = state?.key === key ? state : null;
  const aliases = current?.aliases;
  const remove = async (alias: Alias) => {
    setRemoving(alias.id);
    try {
      await api.forgetPlannerAlias(orgId, alias.id);
      setState((old) => (old?.aliases ? { ...old, aliases: old.aliases.filter((entry) => entry.id !== alias.id) } : old));
      toast.ok(t.removed(alias.said));
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : m.common.genericError);
    } finally {
      setRemoving(null);
    }
  };
  return (
    <Fold title={t.title} detail={aliases ? t.count(aliases.length) : undefined} onToggle={setOpen}>
      <p className="t-caption font-normal text-soft">{t.hint}</p>
      {!current ? <p role="status">{t.loading}</p> : null}
      {current?.failed ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert">{t.failed}</p>
          <Button size="sm" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            {t.retry}
          </Button>
        </div>
      ) : null}
      {aliases && !aliases.length ? <p>{t.empty}</p> : null}
      {aliases?.length ? (
        <ul className="divide-y divide-card-line border-y border-card-line">
          {aliases.map((alias) => (
            <li key={alias.id} className="flex min-w-0 items-center gap-3 py-1">
              <p className="min-w-0 flex-1 break-words py-2">
                <span className="font-semibold">{t.said(alias.said)}</span>{" "}
                <span className="text-soft">{t.means}</span> {alias.exerciseName}
              </p>
              <Button
                size="sm"
                variant="quiet"
                className="shrink-0"
                aria-label={t.removeFor(alias.said)}
                disabled={removing === alias.id}
                onClick={() => void remove(alias)}
              >
                {t.remove}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </Fold>
  );
}
