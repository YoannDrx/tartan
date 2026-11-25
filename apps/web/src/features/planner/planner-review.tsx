"use client";

import {
  PLANNER_SLOT_EXERCISE_ID,
  isoDate,
  sessionTextLimits,
  sessionType,
  type ExerciseSummary,
  type PlannerDraftsResponse,
  type PlannerProposalResponse,
  type PlannerReviewedDraft,
  type Prescription,
} from "@tartan/contracts";
import {
  editSessionBlock,
  formatPrescription,
  occurrenceRef,
  phasePlanningKey,
  replacedExercisePrescription,
  sequenceOccurrences,
  sessionExerciseReferences,
  validSessionStructure,
  type PhasePlanningReadiness,
} from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { CircleDashed, Search, TriangleAlert, X } from "lucide-react";
import { useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { PlannerSolo } from "./planner-solo";
import { Chip } from "@/components/states";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Dialog } from "@/components/ui/dialog";
import { CheckRow, Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { ExerciseFinder, ExerciseQuickCreate } from "@/features/exercises/exercise-finder";
import { PhasePlanningPanel } from "@/features/phases/phase-planning";
import { ExerciseSource } from "@/features/sessions/exercise-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SequenceEditor, type SequenceItemExtras } from "@/features/sessions/sequence-editor";
import { PrescriptionEditor } from "@/features/sessions/session-builder";
import { PlannerLoads } from "./planner-loads";
import { Fold, type PlannerContext } from "./planner-request";

const t = w.planner;
export type PlannerDraftWarning = NonNullable<PlannerDraftsResponse["warnings"]>[number][number];
export type PlannerDraftSlot = NonNullable<PlannerDraftsResponse["slots"]>[number];
export type PlannerDraftUpdate = (
  index: number,
  update: (session: PlannerReviewedDraft) => PlannerReviewedDraft,
) => void;
type Item = PlannerReviewedDraft["draft"]["blocks"][number]["items"][number];
type Picked = Pick<ExerciseSummary, "id" | "name">;

/** L'identifiant, dans la page, de l'emplacement à compléter : le bouton du bas y mène. */
export const plannerSlotAnchor = (slotId: string) => `emplacement-${slotId}`;

const CheckLine = ({ children }: { children: ReactNode }) => (
  <p className="flex min-w-0 items-start gap-2">
    <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-st-partial" />
    <span className="min-w-0 break-words">
      <span className="font-semibold">{t.toCheck}. </span>
      {children}
    </span>
  </p>
);

/**
 * Une séance à relire, dans l'éditeur du constructeur. Chaque exercice dit son état là où il est : rien pour une
 * fiche reconnue ; « À vérifier », avec les autres fiches en un geste, pour une fiche rapprochée ; un emplacement
 * en pointillés, à sa place, pour un exercice qui n'a pas encore de fiche. Ajouter et remplacer cherchent dans
 * toute la bibliothèque.
 */
export function PlannerDraftReview({
  index,
  session,
  context,
  proposal,
  orgId,
  busy,
  onUpdate,
  onLoadsReady,
  onSlot,
  onProbable,
  warnings = [],
  slots = [],
}: {
  warnings?: PlannerDraftWarning[];
  slots?: PlannerDraftSlot[];
  index: number;
  session: PlannerReviewedDraft;
  context: PlannerContext;
  proposal: PlannerProposalResponse;
  orgId: string;
  busy: boolean;
  onUpdate: PlannerDraftUpdate;
  onLoadsReady: (index: number, key: string, ready: boolean) => void;
  /** Le coach donne sa fiche à un emplacement, ou le retire. */
  onSlot: (slot: PlannerDraftSlot, choice: { kind: "use"; exercise: Picked } | { kind: "remove" }) => Promise<void>;
  /** Le coach valide une fiche rapprochée, ou en choisit une autre : le terme est retenu. */
  onProbable: (warning: PlannerDraftWarning, exercise: Picked) => Promise<void>;
}) {
  const { lists, remember } = useContext(ExerciseSource);
  const solo = useContext(PlannerSolo);
  const root = useRef<HTMLElement>(null);
  // Après un geste, le clavier reprend sur l'exercice concerné, à sa place dans la séance : la carte qui portait
  // le bouton a changé, le focus ne doit pas tomber dans le vide. Deux images plus tard, la séance est de nouveau
  // modifiable et la feuille refermée.
  const focusLater = (find: (section: HTMLElement) => HTMLElement | null | undefined) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (root.current) find(root.current)?.focus();
      }),
    );
  const focusItem = (ref: string | null | undefined) =>
    ref
      ? focusLater((section) => section.querySelector<HTMLElement>(`[data-seq-node="${CSS.escape(ref)}"] button`))
      : 0;
  const fillSlot = (slot: PlannerDraftSlot, exercise: Picked) =>
    void onSlot(slot, { kind: "use", exercise }).then(() => focusItem(slot.itemRef));
  const removeSlot = (slot: PlannerDraftSlot) =>
    void onSlot(slot, { kind: "remove" }).then(() => focusLater((section) => section.querySelector<HTMLElement>("h3")));
  const settleProbable = (warning: PlannerDraftWarning, exercise: Picked) =>
    void onProbable(warning, exercise).then(() => focusItem(warning.itemRef));
  const [editingRef, setEditingRef] = useState<string | null>(null);
  const [editingAway, setEditingAway] = useState(false);
  const [previousDraft, setPreviousDraft] = useState<PlannerReviewedDraft | null>(null);
  // Le sélecteur ouvert : pour remplacer un exercice, trancher une fiche à vérifier, ou compléter un emplacement.
  const [picking, setPicking] = useState<
    | { kind: "replace"; ref: string }
    | { kind: "probable"; warning: PlannerDraftWarning }
    | { kind: "slot"; slot: PlannerDraftSlot; create: boolean }
    | null
  >(null);
  // La phase n'est redemandée que si le coach change la date ou les destinataires de la séance.
  const [rescheduled, setRescheduled] = useState(false);
  const acceptLoads = useCallback(
    (key: string, ready: boolean) => onLoadsReady(index, key, ready),
    [index, onLoadsReady],
  );
  const acceptPhase = useCallback(
    (state: PhasePlanningReadiness) => {
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
    [index, onUpdate],
  );
  const change = (patch: Partial<PlannerReviewedDraft>) => onUpdate(index, (old) => ({ ...old, ...patch }));
  const editBlock = (ref: string, action: "duplicate" | "remove") => {
    setPreviousDraft(session);
    change(editSessionBlock(session, ref, action, () => crypto.randomUUID()));
  };
  const hasSlot = (block: PlannerReviewedDraft["draft"]["blocks"][number]) =>
    block.items.some(
      (item) =>
        item.exerciseId === PLANNER_SLOT_EXERCISE_ID || item.autonomous?.exerciseId === PLANNER_SLOT_EXERCISE_ID,
    );
  const reschedule = (patch: Partial<PlannerReviewedDraft>) => {
    setRescheduled(true);
    change({ ...patch, phaseReview: undefined });
  };
  const groupIds = session.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId);
  const athleteIds = session.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId);
  const assignNames = proposal.targets
    .filter((target) => session.assignments.some((a) => a.targetType === target.type && a.targetId === target.id))
    .map((target) => target.label);
  const items = session.draft.blocks.flatMap((block) => block.items);
  const slotOf = (ref: string | undefined) => slots.find((slot) => slot.itemRef === ref);
  const probableOf = (ref: string | undefined) =>
    warnings.find((warning) => warning.itemRef === ref && warning.code === "approximate_exercise");
  const nameOf = (exerciseId: string) =>
    context.exercises.find((exercise) => exercise.id === exerciseId)?.name ??
    proposal.exercises.find((exercise) => exercise.id === exerciseId)?.name ??
    t.unknownExercise;
  const itemName = (item: Item) => {
    const slot = item.exerciseId === PLANNER_SLOT_EXERCISE_ID ? slotOf(item.ref) : undefined;
    return slot ? t.slot.name(slot.said) : nameOf(item.exerciseId);
  };
  const updatePrescription = (ref: string, prescription: Prescription, away = false) =>
    onUpdate(index, (old) => ({
      ...old,
      draft: {
        ...old.draft,
        blocks: old.draft.blocks.map((b) => ({
          ...b,
          items: b.items.map((i) =>
            i.ref !== ref
              ? i
              : away && i.autonomous
                ? { ...i, autonomous: { ...i.autonomous, prescription } }
                : { ...i, prescription },
          ),
        })),
      },
    }));
  // Remplacer garde ce que le coach a prescrit ; les charges adaptées par athlète pour cet exercice partent.
  const replace = (ref: string, exercise: Picked) => {
    onUpdate(index, (old) => ({
      ...old,
      overrides: old.overrides.filter((o) => sessionExerciseReferences(old.draft).get(o.itemRef)?.ref !== ref),
      draft: {
        ...old.draft,
        blocks: old.draft.blocks.map((b) => ({
          ...b,
          items: b.items.map((i) =>
            i.ref === ref
              ? {
                  ...i,
                  exerciseId: exercise.id,
                  prescription: replacedExercisePrescription(i.prescription, exercise.id),
                }
              : i,
          ),
        })),
      },
    }));
    toast.ok(t.replace.done(exercise.name));
  };
  const pick = (exercise: ExerciseSummary) => {
    const target = picking;
    setPicking(null);
    if (!target || busy) return;
    remember([exercise]);
    if (target.kind === "slot") return fillSlot(target.slot, exercise);
    if (target.kind === "probable") return settleProbable(target.warning, exercise);
    // Remplacer une fiche à vérifier, c'est la trancher : le terme dit est retenu pour la nouvelle fiche.
    const doubt = probableOf(target.ref);
    if (doubt) return settleProbable(doubt, exercise);
    replace(target.ref, exercise);
  };
  const sessionWarnings = warnings.filter((warning) => !warning.itemRef);

  const extras: SequenceItemExtras = {
    name: (item) => (slotOf(item.ref) ? itemName(item) : undefined),
    // Un exercice sans fiche : à sa place, avec le terme dit et sa prescription, et trois gestes possibles.
    card: (item, grip) => {
      const slot = item.exerciseId === PLANNER_SLOT_EXERCISE_ID ? slotOf(item.ref) : undefined;
      if (!slot) return null;
      return (
        <div
          id={plannerSlotAnchor(slot.id)}
          className="min-w-0 scroll-mt-24 rounded-button border-2 border-dashed border-control-line"
        >
          <div className="flex min-w-0 items-center gap-1 py-1 pr-2">
            {grip}
            <button
              type="button"
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1 text-left"
              onClick={() => {
                setEditingRef(item.ref!);
                setEditingAway(false);
              }}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-button bg-card-raised">
                <CircleDashed aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 break-words leading-snug">
                <span className="block font-semibold">{t.slot.name(slot.said)}</span>
                <span className="t-caption block font-normal text-soft">
                  {formatPrescription(item.prescription) || t.slot.noPrescription}
                </span>
              </span>
            </button>
          </div>
          <div className="flex flex-col gap-2 border-t border-dashed border-control-line px-3 py-2.5">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 t-caption font-normal text-soft">
              <Chip tone="warning">{t.slot.label}</Chip>
              {t.slot.noFiche}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                aria-label={t.slot.chooseFor(slot.said)}
                onClick={() => setPicking({ kind: "slot", slot, create: false })}
              >
                <Search aria-hidden className="size-4" />
                {t.slot.choose}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                aria-label={t.slot.createFor(slot.said)}
                onClick={() => setPicking({ kind: "slot", slot, create: true })}
              >
                {t.slot.create}
              </Button>
              <Button
                size="sm"
                variant="quiet"
                aria-label={t.slot.removeFor(slot.said)}
                onClick={() => removeSlot(slot)}
              >
                <X aria-hidden className="size-4" />
                {t.slot.remove}
              </Button>
            </div>
          </div>
        </div>
      );
    },
    note: (item) => {
      const notes = warnings.filter((warning) => warning.itemRef === item.ref);
      if (!notes.length) return null;
      return (
        <div className="flex min-w-0 flex-col gap-2">
          {notes.map((warning, i) =>
            warning.code === "approximate_exercise" ? (
              <div key={i} className="flex min-w-0 flex-col gap-2">
                <CheckLine>{warning.said ? t.probable.said(warning.said) : t.probable.unsure}</CheckLine>
                <div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => settleProbable(warning, { id: item.exerciseId, name: nameOf(item.exerciseId) })}
                  >
                    {t.probable.confirm}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {warning.alternatives?.length ? (
                    <span className="t-caption font-normal text-soft">{t.probable.others}</span>
                  ) : null}
                  {/* Une autre fiche possible : un geste, et la séance la prend. */}
                  {warning.alternatives?.map((other) => (
                    <Button
                      key={other.exerciseId}
                      size="sm"
                      variant="secondary"
                      aria-label={t.probable.use(other.name)}
                      className="h-auto max-w-full whitespace-normal py-2 text-left"
                      onClick={() => settleProbable(warning, { id: other.exerciseId, name: other.name })}
                    >
                      {other.name}
                    </Button>
                  ))}
                  <Button size="sm" variant="quiet" onClick={() => setPicking({ kind: "probable", warning })}>
                    <Search aria-hidden className="size-4" />
                    {t.probable.search}
                  </Button>
                </div>
              </div>
            ) : (
              <CheckLine key={i}>{t.warnings[warning.code](warning.detail)}</CheckLine>
            ),
          )}
        </div>
      );
    },
  };

  const editing = editingRef ? items.find((item) => item.ref === editingRef) : undefined;
  const away = editing && editingAway && editing.autonomous ? editing.autonomous : null;
  const editingSlot = editing ? slotOf(editing.ref) : undefined;
  const editingId = away?.exerciseId ?? editing?.exerciseId;
  const pickingSlot = picking?.kind === "slot" ? picking.slot : null;
  const suggested = pickingSlot
    ? {
        name: pickingSlot.suggestion?.name ?? pickingSlot.said,
        ...(pickingSlot.suggestion
          ? { category: pickingSlot.suggestion.category, loadKind: pickingSlot.suggestion.loadKind }
          : {}),
      }
    : undefined;
  const replacing = picking?.kind === "replace" ? items.find((item) => item.ref === picking.ref) : undefined;

  return (
    <section
      ref={root}
      aria-label={session.draft.title}
      className="flex min-w-0 flex-col gap-4 rounded-card border border-card-line p-4"
    >
      <header className="flex min-w-0 flex-col gap-0.5">
        <h3 tabIndex={-1} className="t-h2 break-words">
          {session.draft.title}
        </h3>
        <p>
          {isoDate.safeParse(session.date).success ? historyDate(session.date) : m.errors.invalid}
          {session.startTime ? ` · ${session.startTime}` : ""} · {m.sessionType[session.draft.type]}
        </p>
        <p className="break-words text-soft">{assignNames.join(", ")}</p>
      </header>
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
        <Fold title={t.editSchedule}>
          <div className="grid gap-3 tablet:grid-cols-2">
            <Field
              label={m.builder.title}
              error={
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
            <Field label={m.builder.date}>
              {(a) => (
                <DateInput
                  {...a}
                  min={proposal.selection.period.from}
                  max={proposal.selection.period.to}
                  value={session.date}
                  onChange={(e) => reschedule({ date: e.target.value })}
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
          <fieldset className="min-w-0" hidden={solo}>
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
                    reschedule({
                      assignments: selected
                        ? session.assignments.filter((a) => a.targetType !== target.type || a.targetId !== target.id)
                        : [...session.assignments, { targetType: target.type, targetId: target.id }],
                    })
                  }
                />
              );
            })}
          </fieldset>
        </Fold>
        {sessionWarnings.length ? (
          <div className="flex flex-col gap-2" role="group" aria-label={t.toCheckCount(sessionWarnings.length)}>
            {sessionWarnings.map((warning, i) => (
              <CheckLine key={i}>{t.warnings[warning.code](warning.detail)}</CheckLine>
            ))}
          </div>
        ) : null}
        {previousDraft ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="self-start"
            onClick={() => {
              onUpdate(index, () => previousDraft);
              setPreviousDraft(null);
            }}
          >
            {t.undo}
          </Button>
        ) : null}
        {session.draft.blocks.map((block) => (
          <section key={block.ref} className="flex min-w-0 flex-col gap-2 border-t border-card-line pt-4">
            <Field
              label={t.blockName}
              error={
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
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="quiet"
                disabled={busy || hasSlot(block) || session.draft.blocks.length >= 12}
                onClick={() => editBlock(block.ref!, "duplicate")}
              >
                {m.builder.duplicateBlock}
              </Button>
              <ConfirmDialog
                title={m.nativeBuilder.removeBlock}
                onConfirm={() => editBlock(block.ref!, "remove")}
                trigger={
                  <Button
                    size="sm"
                    variant="quiet"
                    disabled={busy || hasSlot(block) || session.draft.blocks.length === 1}
                  >
                    {m.builder.deleteBlock}
                  </Button>
                }
              />
            </div>
            {hasSlot(block) ? <p className="t-caption text-soft">{m.builder.resolveBlockSlots}</p> : null}
            {/* Les marges de l'éditeur sont celles du constructeur : ici il s'aligne sur la carte de la séance. */}
            <div className="-mx-3 min-w-0">
              <SequenceEditor
                block={block}
                exercises={context.exercises}
                extras={extras}
                onEdit={(ref) => {
                  setEditingRef(ref);
                  setEditingAway(false);
                }}
                onEditAutonomous={(ref) => {
                  setEditingRef(ref);
                  setEditingAway(true);
                }}
                onChange={(next) => {
                  setPreviousDraft(session);
                  const draft = {
                    ...session.draft,
                    blocks: session.draft.blocks.map((b) => (b.ref === block.ref ? next : b)),
                  };
                  const refs = validSessionStructure(draft) ? sessionExerciseReferences(draft) : null;
                  change({
                    draft,
                    overrides: refs ? session.overrides.filter((o) => refs.has(o.itemRef)) : session.overrides,
                  });
                }}
              />
            </div>
            {/* La prescription de l'exercice touché, juste sous son bloc. */}
            {editing && editingId && block.items.some((item) => item.ref === editing.ref) ? (
              <div className="flex min-w-0 flex-col gap-3 rounded-button bg-card-raised p-3">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <p className="min-w-0 break-words font-semibold">
                    {away ? m.builder.sequence.autonomousLine(nameOf(away.exerciseId)) : itemName(editing)}
                  </p>
                  <Button size="sm" variant="quiet" className="-my-1.5 shrink-0" onClick={() => setEditingRef(null)}>
                    {m.common.close}
                  </Button>
                </div>
                {(editing.prescription.notes?.length ?? 0) > sessionTextLimits.notes ? (
                  <p role="alert">
                    {m.builder.notes} : {t.textLimit(editing.prescription.notes!.length, sessionTextLimits.notes)}
                  </p>
                ) : null}
                <PrescriptionEditor
                  intensityEnabled
                  value={away?.prescription ?? editing.prescription}
                  exercise={context.exercises.find((exercise) => exercise.id === editingId)}
                  testKeys={editingSlot ? [] : [`exercise:${editingId}`]}
                  onChange={(value) => updatePrescription(editing.ref!, value, Boolean(away))}
                />
                {!away && !editingSlot ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="self-start"
                    onClick={() => setPicking({ kind: "replace", ref: editing.ref! })}
                  >
                    {t.replace.action}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {validSessionStructure(session.draft) ? (
              <Fold bare title={t.preview}>
                <ol className="divide-y divide-card-line" aria-label={t.preview}>
                  {sequenceOccurrences(block.sequence ?? []).map(({ node, rounds }) => {
                    const item =
                      node.kind === "exercise" ? block.items.find((entry) => entry.ref === node.itemRef) : undefined;
                    return (
                      <li
                        key={occurrenceRef(node.kind === "exercise" ? node.itemRef : node.ref, rounds)}
                        className="py-2"
                      >
                        {rounds.length ? (
                          <p className="t-caption font-normal text-soft">
                            {rounds
                              .map((round) => m.builder.sequence.round(round.name, round.round, round.rounds))
                              .join(" · ")}
                          </p>
                        ) : null}
                        <p className="break-words font-semibold">
                          {item ? itemName(item) : m.builder.sequenceRecovery}
                        </p>
                        <p>
                          {formatPrescription(
                            node.kind === "recovery" ? { duration_s: node.durationS } : item!.prescription,
                          )}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </Fold>
            ) : null}
          </section>
        ))}
      </fieldset>
      {context.phasesEnabled && (rescheduled || !session.phaseReview) ? (
        <fieldset disabled={busy} className="min-w-0">
          <PhasePlanningPanel
            key={phasePlanningKey(session.date, groupIds, athleteIds)}
            organizationId={orgId}
            date={session.date}
            groupIds={groupIds}
            athleteIds={athleteIds}
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
        blocked={slots.length ? t.slot.loadsBlocked : undefined}
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
      {/* Une seule feuille pour chercher une fiche : remplacer, trancher une fiche à vérifier, compléter. */}
      <Dialog
        wide
        open={Boolean(picking)}
        onOpenChange={(open) => {
          if (!open) setPicking(null);
        }}
        title={
          pickingSlot
            ? picking?.kind === "slot" && picking.create
              ? t.slot.createTitle(pickingSlot.said)
              : t.slot.title(pickingSlot.said)
            : picking?.kind === "probable"
              ? t.probable.searchTitle(picking.warning.said ?? "")
              : t.replace.title(replacing ? itemName(replacing) : "")
        }
        description={pickingSlot ? t.slot.hint : picking?.kind === "probable" ? t.probable.searchHint : t.replace.hint}
      >
        {picking?.kind === "slot" && picking.create ? (
          <div className="flex min-w-0 flex-col gap-4">
            <ExerciseQuickCreate
              term={suggested!.name}
              suggested={suggested}
              onDone={(result) => pick(result.exercise)}
            />
            <Button
              size="sm"
              variant="quiet"
              className="self-start"
              onClick={() => setPicking({ kind: "slot", slot: picking.slot, create: false })}
            >
              <Search aria-hidden className="size-4" />
              {t.slot.backToSearch}
            </Button>
          </div>
        ) : picking ? (
          <div className="flex min-w-0 flex-col gap-3">
            {pickingSlot?.candidates.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="t-caption font-normal text-soft">{t.slot.near}</span>
                {pickingSlot.candidates.map((candidate) => (
                  <Button
                    key={candidate.exerciseId}
                    size="sm"
                    variant="secondary"
                    aria-label={t.slot.pick(candidate.name)}
                    className="h-auto max-w-full whitespace-normal py-2 text-left"
                    onClick={() => {
                      setPicking(null);
                      fillSlot(pickingSlot, { id: candidate.exerciseId, name: candidate.name });
                    }}
                  >
                    {candidate.name}
                  </Button>
                ))}
              </div>
            ) : null}
            <ExerciseFinder
              autoFocus
              lists={lists}
              suggested={suggested}
              pickLabel={pickingSlot ? t.slot.pick : picking.kind === "probable" ? t.probable.pick : t.replace.pick}
              onPick={pick}
              onLoaded={remember}
            />
          </div>
        ) : null}
      </Dialog>
    </section>
  );
}
