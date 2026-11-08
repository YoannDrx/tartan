"use client";

import {
  sessionType,
  sessionTextLimits,
  isoDate,
  type PlannerReviewedDraft,
  type PlannerProposalResponse,
  type Prescription,
} from "@tartan/contracts";
import { formatPrescription, phasePlanningKey, type PhasePlanningReadiness } from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { CheckRow, Field, Input, Select } from "@/components/ui/field";
import { PhasePlanningPanel } from "@/features/phases/phase-planning";
import { PrescriptionEditor } from "@/features/sessions/session-builder";
import type { PlannerContext } from "./planner-selection";
import { PlannerLoads } from "./planner-loads";

export type PlannerDraftUpdate = (
  index: number,
  update: (session: PlannerReviewedDraft) => PlannerReviewedDraft,
) => void;
const t = m.aiPlanner;
export function PlannerDraftReview({
  index,
  session,
  context,
  proposal,
  orgId,
  busy,
  onUpdate,
  onPhaseReady,
  onLoadsReady,
}: {
  index: number;
  session: PlannerReviewedDraft;
  context: PlannerContext;
  proposal: PlannerProposalResponse;
  orgId: string;
  busy: boolean;
  onUpdate: PlannerDraftUpdate;
  onPhaseReady: (index: number, state: PhasePlanningReadiness) => void;
  onLoadsReady: (index: number, key: string, ready: boolean) => void;
}) {
  const [replacement, setReplacement] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const acceptLoads = useCallback(
    (key: string, ready: boolean) => onLoadsReady(index, key, ready),
    [index, onLoadsReady],
  );
  const acceptPhase = useCallback(
    (state: PhasePlanningReadiness) => {
      onPhaseReady(index, state);
      if (state.ready && state.review)
        onUpdate(index, (old) => {
          const key = phasePlanningKey(
            old.date,
            old.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId),
            old.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId),
          );
          return key !== state.key || JSON.stringify(old.phaseReview) === JSON.stringify(state.review)
            ? old
            : { ...old, phaseReview: state.review };
        });
    },
    [index, onUpdate, onPhaseReady],
  );
  const change = (patch: Partial<PlannerReviewedDraft>) => onUpdate(index, (old) => ({ ...old, ...patch }));
  const assignNames = proposal.targets
    .filter((t) => session.assignments.some((a) => a.targetType === t.type && a.targetId === t.id))
    .map((t) => t.label);
  const phaseKey = phasePlanningKey(
    session.date,
    session.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId),
    session.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId),
  );
  const updatePrescription = (ref: string, prescription: Prescription) =>
    onUpdate(index, (old) => ({
      ...old,
      draft: {
        ...old.draft,
        blocks: old.draft.blocks.map((b) => ({
          ...b,
          items: b.items.map((i) => (i.ref === ref ? { ...i, prescription } : i)),
        })),
      },
    }));
  return (
    <section
      aria-label={session.draft.title}
      className="flex min-w-0 flex-col gap-4 rounded-card border border-card-line p-4"
    >
      <header>
        <h2 className="t-section break-words">{session.draft.title}</h2>
        <p>
          {isoDate.safeParse(session.date).success ? historyDate(session.date) : m.errors.invalid}
          {session.startTime ? ` · ${session.startTime}` : ""} · {m.sessionType[session.draft.type]}
        </p>
        <p className="text-soft break-words">{assignNames.join(", ")}</p>
      </header>
      <fieldset disabled={busy} className="min-w-0">
        <details>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">{t.editSchedule}</summary>
          <div className="grid gap-3 tablet:grid-cols-2">
            <Field
              label={m.builder.title}
              hint={
                session.draft.title.trim().length > sessionTextLimits.title
                  ? t.textLimit(session.draft.title.trim().length, sessionTextLimits.title)
                  : undefined
              }
            >
              {(a) => (
                <Input
                  {...a}
                  value={session.draft.title}
                  onChange={(e) => change({ draft: { ...session.draft, title: e.target.value } })}
                />
              )}
            </Field>
            <Field label={m.trainingPhases.start}>
              {(a) => (
                <Input
                  {...a}
                  type="date"
                  min={proposal.selection.period.from}
                  max={proposal.selection.period.to}
                  value={session.date}
                  onChange={(e) => change({ date: e.target.value, phaseReview: undefined })}
                />
              )}
            </Field>
            <Field label={m.builder.time}>
              {(a) => (
                <Input
                  {...a}
                  type="time"
                  value={session.startTime ?? ""}
                  onChange={(e) => change({ startTime: e.target.value || null })}
                />
              )}
            </Field>
            <Field label={m.builder.duration}>
              {(a) => (
                <Input
                  {...a}
                  type="number"
                  min={1}
                  max={600}
                  value={session.draft.durationMin ?? ""}
                  onChange={(e) =>
                    change({ draft: { ...session.draft, durationMin: e.target.value ? Number(e.target.value) : null } })
                  }
                />
              )}
            </Field>
            <Field label={m.builder.type}>
              {(a) => (
                <Select
                  {...a}
                  value={session.draft.type}
                  onChange={(e) => change({ draft: { ...session.draft, type: sessionType.parse(e.target.value) } })}
                >
                  {sessionType.options.map((type) => (
                    <option key={type} value={type}>
                      {m.sessionType[type]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <fieldset className="min-w-0 mt-3">
            <legend className="font-semibold">{m.builder.audience}</legend>
            {proposal.targets.map((target) => {
              const selected = session.assignments.some(
                (a) => a.targetType === target.type && a.targetId === target.id,
              );
              return (
                <CheckRow
                  key={target.token}
                  label={target.label}
                  checked={selected}
                  onChange={() =>
                    change({
                      assignments: selected
                        ? session.assignments.filter((a) => a.targetType !== target.type || a.targetId !== target.id)
                        : [...session.assignments, { targetType: target.type, targetId: target.id }],
                      phaseReview: undefined,
                    })
                  }
                />
              );
            })}
          </fieldset>
        </details>
        {session.draft.blocks.map((block) => (
          <section key={block.ref} className="mt-3 border-t border-card-line pt-3">
            <Field
              label={m.nativeBuilder.blockName}
              hint={
                block.name.trim().length > sessionTextLimits.blockName
                  ? t.textLimit(block.name.trim().length, sessionTextLimits.blockName)
                  : undefined
              }
            >
              {(a) => (
                <Input
                  {...a}
                  value={block.name}
                  onChange={(e) =>
                    change({
                      draft: {
                        ...session.draft,
                        blocks: session.draft.blocks.map((b) =>
                          b.ref === block.ref ? { ...b, name: e.target.value } : b,
                        ),
                      },
                    })
                  }
                />
              )}
            </Field>
            {block.items.map((item) => {
              const exercise = context.exercises.find((e) => e.id === item.exerciseId);
              return (
                <div key={item.ref} className="flex min-w-0 flex-col gap-2 py-3">
                  <p className="font-semibold break-words">{exercise?.name ?? m.common.notFound}</p>
                  <p>{formatPrescription(item.prescription)}</p>
                  {(item.prescription.notes?.length ?? 0) > sessionTextLimits.notes ? (
                    <p role="alert">
                      {m.builder.notes} : {t.textLimit(item.prescription.notes!.length, sessionTextLimits.notes)}
                    </p>
                  ) : null}
                  <details>
                    <summary className="min-h-11 cursor-pointer py-2">{m.builder.setPrescription}</summary>
                    <PrescriptionEditor
                      value={item.prescription}
                      exercise={exercise}
                      testKeys={[`exercise:${item.exerciseId}`]}
                      onChange={(value) => updatePrescription(item.ref!, value)}
                    />
                  </details>
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => {
                      setReplacement(item.ref!);
                      setSearch("");
                    }}
                  >
                    {t.replaceExercise}
                  </Button>
                </div>
              );
            })}
          </section>
        ))}
      </fieldset>
      {context.phasesEnabled ? (
        <fieldset disabled={busy} className="min-w-0">
          <PhasePlanningPanel
            key={phaseKey}
            organizationId={orgId}
            date={session.date}
            groupIds={session.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId)}
            athleteIds={session.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId)}
            initialChoices={session.phaseReview?.choices ?? []}
            onReady={acceptPhase}
          />
        </fieldset>
      ) : null}
      <PlannerLoads
        orgId={orgId}
        proposalId={proposal.id}
        version={proposal.version}
        session={session}
        disabled={busy}
        onReady={acceptLoads}
        onLoad={(athleteId, itemRef, load) =>
          onUpdate(index, (old) => {
            const prior = old.overrides.find((o) => o.athleteId === athleteId && o.itemRef === itemRef);
            const prescription = { ...prior?.prescription };
            if (load) prescription.load = load;
            else delete prescription.load;
            const rest = old.overrides.filter((o) => o.athleteId !== athleteId || o.itemRef !== itemRef);
            return {
              ...old,
              overrides: Object.keys(prescription).length ? [...rest, { athleteId, itemRef, prescription }] : rest,
            };
          })
        }
      />
      <Dialog
        open={Boolean(replacement)}
        onOpenChange={(open) => {
          if (!open) setReplacement(null);
        }}
        title={t.replaceExercise}
        description={t.replacementReset}
      >
        <Field label={m.common.search}>
          {(a) => <Input {...a} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />}
        </Field>
        <div className="mt-3 flex flex-col gap-2">
          {context.exercises
            .filter(
              (e) =>
                proposal.exercises.some((p) => p.id === e.id) &&
                e.name.toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr")),
            )
            .slice(0, 50)
            .map((e) => (
              <Button key={e.id} type="button" variant="secondary" disabled={busy} onClick={() => setChosen(e.id)}>
                {e.name}
              </Button>
            ))}
        </div>
        <p className="mt-3 text-soft">{t.refineSearch}</p>
      </Dialog>
      <ConfirmDialog
        open={Boolean(chosen)}
        onOpenChange={(open) => {
          if (!open) setChosen(null);
        }}
        title={t.replaceExercise}
        description={t.replacementReset}
        confirmLabel={m.nativeBuilder.apply}
        tone="neutral"
        onConfirm={() => {
          const exercise = context.exercises.find((e) => e.id === chosen);
          if (!exercise || !replacement || busy) return;
          const prescription = { ...exercise.defaultPrescription };
          if (prescription.load?.type === "pct_1rm")
            prescription.load = { ...prescription.load, test: `exercise:${exercise.id}` };
          onUpdate(index, (old) => ({
            ...old,
            overrides: old.overrides.filter((o) => o.itemRef !== replacement),
            draft: {
              ...old.draft,
              blocks: old.draft.blocks.map((b) => ({
                ...b,
                items: b.items.map((i) =>
                  i.ref === replacement ? { ...i, exerciseId: exercise.id, prescription } : i,
                ),
              })),
            },
          }));
          setChosen(null);
          setReplacement(null);
        }}
      />
    </section>
  );
}
