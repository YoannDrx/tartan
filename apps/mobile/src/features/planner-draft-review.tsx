import { randomUUID } from "expo-crypto";
import {
  PLANNER_SLOT_EXERCISE_ID,
  clockTime,
  isoDate,
  sessionTextLimits,
  sessionType,
  type ExerciseSummary,
  type PlannerProposalResponse,
  type PlannerReviewedDraft,
  type Prescription,
} from "@tartan/contracts";
import {
  editSessionBlock,
  formatPrescription,
  phasePlanningKey,
  replacedExercisePrescription,
  sessionExerciseReferences,
  validSessionStructure,
  type PhasePlanningReadiness,
} from "@tartan/domain";
import { historyDate, m } from "@tartan/i18n";
import { useCallback, useState } from "react";
import { AccessibilityInfo, Alert, View } from "react-native";
import type { api } from "../lib/api";
import { plannerItemState, type PlannerDraftSlot, type PlannerDraftWarning } from "../lib/planner-flow";
import { DateField } from "../ui/date-field";
import { CircleDashed, Search, X } from "../ui/icons";
import { Button, Divider, Field, T, Tag } from "../ui/primitives";
import { radius, space, usePalette } from "../ui/theme";
import { prescriptionFields, type PrescriptionFields } from "./builder/form";
import { PrescriptionEditor } from "./builder/prescription-editor";
import { NativeSequenceEditor, type SequenceItemExtras } from "./builder/sequence-editor";
import { NativePhasePlanning } from "./phase-planning";
import { PlannerExerciseFinder } from "./exercise-finder";
import { PlannerLoadPreview } from "./planner-load-preview";
import { CheckLine, Fold, Pill, PillRow } from "./planner-ui";

type Context = Awaited<ReturnType<typeof api.sessionBuilder>>;
type Item = PlannerReviewedDraft["draft"]["blocks"][number]["items"][number];
type Picked = { id: string; name: string };
const t = m.aiPlanner.screen;
export type PlannerDraftUpdate = (
  index: number,
  update: (session: PlannerReviewedDraft) => PlannerReviewedDraft,
) => void;

/** Le sélecteur ouvert : remplacer un exercice, trancher une fiche à vérifier, ou compléter un emplacement. */
export type Picking =
  | { kind: "replace"; ref: string }
  | { kind: "probable"; warning: PlannerDraftWarning }
  | { kind: "slot"; slot: PlannerDraftSlot; create: boolean };

/**
 * Une séance à relire, dans l'éditeur de séquence du constructeur. Chaque exercice dit son état là où il est : rien
 * pour une fiche reconnue ; « À vérifier », avec les autres fiches en un geste, pour une fiche rapprochée ; un
 * emplacement en pointillés, à sa place, pour un exercice qui n'a pas encore de fiche. Ajouter et remplacer
 * cherchent dans toute la bibliothèque, création comprise.
 */
export function PlannerDraftReview({
  index,
  session,
  context,
  proposal,
  orgId,
  busy,
  warnings,
  slots,
  picking,
  onPicking,
  onUpdate,
  onLoadsReady,
  onSlot,
  onProbable,
  onRemember,
}: {
  index: number;
  session: PlannerReviewedDraft;
  context: Context;
  proposal: PlannerProposalResponse;
  orgId: string;
  busy: boolean;
  warnings: PlannerDraftWarning[];
  slots: PlannerDraftSlot[];
  /** Le sélecteur ouvert pour cette séance : le bouton du bas peut l'ouvrir sur le premier emplacement. */
  picking: Picking | null;
  onPicking: (picking: Picking | null) => void;
  onUpdate: PlannerDraftUpdate;
  onLoadsReady: (index: number, key: string, ready: boolean) => void;
  /** Le coach donne sa fiche à un emplacement, ou le retire. */
  onSlot: (slot: PlannerDraftSlot, choice: { kind: "use"; exercise: Picked } | { kind: "remove" }) => void;
  /** Le coach valide une fiche rapprochée, ou en choisit une autre : le terme est retenu. */
  onProbable: (warning: PlannerDraftWarning, exercise: Picked) => void;
  /** Une fiche créée depuis la séance : l'écran la connaît désormais. */
  onRemember: (exercise: ExerciseSummary) => void;
}) {
  const p = usePalette();
  const [editing, setEditing] = useState<{
    ref: string;
    away: boolean;
    value: Prescription;
    fields: PrescriptionFields;
  } | null>(null);
  const [error, setError] = useState("");
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
    change(editSessionBlock(session, ref, action, randomUUID));
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
  const nameOf = (exerciseId: string) =>
    context.exercises.find((exercise) => exercise.id === exerciseId)?.name ??
    proposal.exercises.find((exercise) => exercise.id === exerciseId)?.name ??
    t.unknownExercise;
  const stateOf = (item: Pick<Item, "ref" | "exerciseId">) => plannerItemState(item, slots, warnings);
  const itemName = (item: Item) => {
    const state = stateOf(item);
    return state.kind === "slot" ? t.slot.name(state.slot.said) : nameOf(item.exerciseId);
  };
  const updatePrescription = (ref: string, prescription: Prescription, away: boolean) =>
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
    AccessibilityInfo.announceForAccessibility(t.replace.done(exercise.name));
  };
  const pick = (target: Picking, exercise: Picked, created?: ExerciseSummary) => {
    onPicking(null);
    if (created) onRemember(created);
    if (busy) return;
    if (target.kind === "slot") return onSlot(target.slot, { kind: "use", exercise });
    if (target.kind === "probable") return onProbable(target.warning, exercise);
    // Remplacer une fiche à vérifier, c'est la trancher : le terme dit est retenu pour la nouvelle fiche.
    const doubt = stateOf({ ref: target.ref, exerciseId: "" });
    if (doubt.kind === "probable") return onProbable(doubt.warning, exercise);
    replace(target.ref, exercise);
  };
  const openEditor = (ref: string, away: boolean) => {
    const item = items.find((entry) => entry.ref === ref);
    const value = away ? item?.autonomous?.prescription : item?.prescription;
    if (!item || !value) return;
    setEditing({ ref, away, value, fields: prescriptionFields(value) });
  };
  const sessionWarnings = warnings.filter((warning) => !warning.itemRef);

  const extras: SequenceItemExtras = {
    name: (item) => (stateOf(item).kind === "slot" ? itemName(item) : undefined),
    // Un exercice sans fiche : à sa place, avec le terme dit et sa prescription, et trois gestes possibles.
    card: (item) => {
      const state = stateOf(item);
      if (state.kind !== "slot") return null;
      const slot = state.slot;
      return (
        <View
          testID={`planner-slot-${slot.id}`}
          style={{
            gap: space.sm,
            padding: space.md,
            borderRadius: radius.button,
            borderWidth: 2,
            borderStyle: "dashed",
            borderColor: p.controlLine,
          }}
        >
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
            <CircleDashed size={20} color={p.text} accessibilityElementsHidden importantForAccessibility="no" />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="bodyStrong">{t.slot.name(slot.said)}</T>
              <T variant="small" tone="muted">
                {formatPrescription(item.prescription) || t.slot.noPrescription}
              </T>
            </View>
          </View>
          <Tag label={t.slot.label} />
          <T variant="small">{t.slot.noFiche}</T>
          <PillRow>
            <Button
              compact
              variant="secondary"
              icon={Search}
              testID="planner-slot-choose"
              label={t.slot.choose}
              accessibilityLabel={t.slot.chooseFor(slot.said)}
              disabled={busy}
              onPress={() => onPicking({ kind: "slot", slot, create: false })}
            />
            <Button
              compact
              variant="secondary"
              testID="planner-slot-create"
              label={t.slot.create}
              accessibilityLabel={t.slot.createFor(slot.said)}
              disabled={busy}
              onPress={() => onPicking({ kind: "slot", slot, create: true })}
            />
            <Button
              compact
              variant="ghost"
              icon={X}
              testID="planner-slot-remove"
              label={t.slot.remove}
              accessibilityLabel={t.slot.removeFor(slot.said)}
              disabled={busy}
              onPress={() => onSlot(slot, { kind: "remove" })}
            />
          </PillRow>
          <Button
            compact
            variant="ghost"
            label={m.builder.setPrescription}
            accessibilityLabel={`${m.builder.setPrescription} · ${t.slot.name(slot.said)}`}
            disabled={busy}
            onPress={() => openEditor(item.ref!, false)}
          />
        </View>
      );
    },
    note: (item) => {
      const notes = warnings.filter((warning) => warning.itemRef === item.ref);
      if (!notes.length) return null;
      return (
        <View style={{ gap: space.sm }}>
          {notes.map((warning, i) =>
            warning.code === "approximate_exercise" ? (
              <View key={i} style={{ gap: space.sm }}>
                <CheckLine>{warning.said ? t.probable.said(warning.said) : t.probable.unsure}</CheckLine>
                <PillRow>
                  <Button
                    compact
                    variant="secondary"
                    testID="planner-probable-confirm"
                    label={t.probable.confirm}
                    disabled={busy}
                    onPress={() => onProbable(warning, { id: item.exerciseId, name: nameOf(item.exerciseId) })}
                  />
                  {/* Une autre fiche possible : un geste, et la séance la prend. */}
                  {warning.alternatives?.map((other) => (
                    <Button
                      key={other.exerciseId}
                      compact
                      variant="secondary"
                      label={other.name}
                      accessibilityLabel={t.probable.use(other.name)}
                      disabled={busy}
                      onPress={() => onProbable(warning, { id: other.exerciseId, name: other.name })}
                    />
                  ))}
                  <Button
                    compact
                    variant="ghost"
                    icon={Search}
                    label={t.probable.search}
                    disabled={busy}
                    onPress={() => onPicking({ kind: "probable", warning })}
                  />
                </PillRow>
              </View>
            ) : (
              <CheckLine key={i}>{t.warnings[warning.code](warning.detail)}</CheckLine>
            ),
          )}
        </View>
      );
    },
    advanced: (item) =>
      stateOf(item).kind === "slot" ? null : (
        <Button
          compact
          variant="secondary"
          label={t.replace.action}
          accessibilityLabel={`${t.replace.action} · ${itemName(item)}`}
          disabled={busy}
          onPress={() => onPicking({ kind: "replace", ref: item.ref! })}
        />
      ),
  };

  const editingItem = editing ? items.find((item) => item.ref === editing.ref) : undefined;
  const editingSlot = editingItem && stateOf(editingItem).kind === "slot";
  const editingId = editing?.away ? editingItem?.autonomous?.exerciseId : editingItem?.exerciseId;
  const pickingSlot = picking?.kind === "slot" ? picking.slot : null;
  const replacing = picking?.kind === "replace" ? items.find((item) => item.ref === picking.ref) : undefined;
  const library = (exerciseId: string) => context.exercises.find((exercise) => exercise.id === exerciseId);

  return (
    <View style={{ gap: space.lg }}>
      <Divider />
      <View style={{ gap: 2 }}>
        <T variant="title2" heading>
          {session.draft.title}
        </T>
        <T>
          {isoDate.safeParse(session.date).success ? historyDate(session.date) : m.errors.invalid}
          {session.startTime ? ` · ${session.startTime}` : ""} · {m.sessionType[session.draft.type]}
        </T>
        <T tone="muted">{assignNames.join(", ")}</T>
      </View>
      <Fold title={t.editSchedule}>
        <Field
          label={m.builder.title}
          value={session.draft.title}
          editable={!busy}
          error={
            session.draft.title.trim().length > sessionTextLimits.title
              ? m.aiPlanner.textLimit(session.draft.title.trim().length, sessionTextLimits.title)
              : null
          }
          onChangeText={(title) => change({ draft: { ...session.draft, title } })}
        />
        <DateField
          label={m.builder.date}
          value={session.date}
          editable={!busy}
          min={proposal.selection.period.from}
          max={proposal.selection.period.to}
          onChangeText={(date) => reschedule({ date })}
        />
        <Field
          label={m.builder.time}
          hint={t.timeHint}
          value={session.startTime ?? ""}
          editable={!busy}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          error={session.startTime && !clockTime.safeParse(session.startTime).success ? t.timeInvalid : null}
          onChangeText={(startTime) => change({ startTime: startTime.trim() || null })}
        />
        <Field
          label={m.builder.duration}
          value={session.draft.durationMin?.toString() ?? ""}
          editable={!busy}
          keyboardType="number-pad"
          onChangeText={(value) => {
            if (/^\d{0,3}$/.test(value) && Number(value) <= 600)
              change({ draft: { ...session.draft, durationMin: value ? Number(value) : null } });
          }}
        />
        <View style={{ gap: space.xs }}>
          <T variant="smallStrong">{m.builder.type}</T>
          <PillRow>
            {sessionType.options.map((type) => (
              <Pill
                key={type}
                label={m.sessionType[type]}
                pressed={session.draft.type === type}
                disabled={busy}
                onPress={() => change({ draft: { ...session.draft, type } })}
              />
            ))}
          </PillRow>
        </View>
        <View style={{ gap: space.xs }}>
          <T variant="smallStrong">{m.builder.audience}</T>
          <PillRow>
            {proposal.targets.map((target) => {
              const selected = session.assignments.some(
                (a) => a.targetType === target.type && a.targetId === target.id,
              );
              return (
                <Pill
                  key={target.token}
                  label={target.label}
                  pressed={selected}
                  disabled={busy}
                  onPress={() =>
                    reschedule({
                      assignments: selected
                        ? session.assignments.filter((a) => a.targetType !== target.type || a.targetId !== target.id)
                        : [...session.assignments, { targetType: target.type, targetId: target.id }],
                    })
                  }
                />
              );
            })}
          </PillRow>
        </View>
      </Fold>
      {sessionWarnings.map((warning, i) => (
        <CheckLine key={i}>{t.warnings[warning.code](warning.detail)}</CheckLine>
      ))}
      {error ? (
        <T tone="danger" accessibilityLiveRegion="assertive">
          {error}
        </T>
      ) : null}
      {session.draft.blocks.map((block) => (
        <View key={block.ref} style={{ gap: space.sm }}>
          <Field
            label={m.nativeBuilder.blockName}
            value={block.name}
            editable={!busy}
            error={
              block.name.trim().length > sessionTextLimits.blockName
                ? m.aiPlanner.textLimit(block.name.trim().length, sessionTextLimits.blockName)
                : null
            }
            onChangeText={(name) =>
              change({
                draft: {
                  ...session.draft,
                  blocks: session.draft.blocks.map((b) => (b.ref === block.ref ? { ...b, name } : b)),
                },
              })
            }
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
            <Button
              compact
              variant="secondary"
              label={m.builder.duplicateBlock}
              disabled={busy || hasSlot(block) || session.draft.blocks.length >= 12}
              onPress={() => editBlock(block.ref!, "duplicate")}
            />
            <Button
              compact
              variant="secondary"
              label={m.builder.deleteBlock}
              disabled={busy || hasSlot(block) || session.draft.blocks.length === 1}
              onPress={() =>
                Alert.alert(m.nativeBuilder.removeBlock, undefined, [
                  { text: m.common.cancel, style: "cancel" },
                  { text: m.common.delete, style: "destructive", onPress: () => editBlock(block.ref!, "remove") },
                ])
              }
            />
          </View>
          {hasSlot(block) ? <T variant="small">{m.builder.resolveBlockSlots}</T> : null}
          <NativeSequenceEditor
            block={block}
            exercises={context.exercises}
            extras={extras}
            canMove={false}
            onMove={() => undefined}
            onError={setError}
            onEdit={(ref) => openEditor(ref, false)}
            onEditAutonomous={(ref) => openEditor(ref, true)}
            onChange={(next) => {
              setError("");
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
            picker={({ title, onPick, onClose }) => (
              <PlannerExerciseFinder
                orgId={orgId}
                exercises={context.exercises}
                title={title === m.builder.library ? t.add.title : title}
                hint={t.add.hint}
                pickLabel={t.add.pick}
                busy={busy}
                onClose={onClose}
                onPick={(picked, created) => {
                  if (created) onRemember(created);
                  const exercise = created ?? library(picked.id);
                  if (!exercise) return onClose();
                  onPick(exercise);
                  AccessibilityInfo.announceForAccessibility(t.add.done(exercise.name));
                }}
              />
            )}
          />
        </View>
      ))}
      {context.phasesEnabled && (rescheduled || !session.phaseReview) ? (
        <NativePhasePlanning
          key={phasePlanningKey(session.date, groupIds, athleteIds)}
          orgId={orgId}
          date={session.date}
          groupIds={groupIds}
          athleteIds={athleteIds}
          initialChoices={session.phaseReview?.choices ?? []}
          onReady={acceptPhase}
        />
      ) : null}
      <PlannerLoadPreview
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
      {editing && editingItem && editingId ? (
        <PrescriptionEditor
          title={editing.away ? m.builder.sequence.autonomousLine(nameOf(editingId)) : itemName(editingItem)}
          exercise={
            editingSlot
              ? { id: PLANNER_SLOT_EXERCISE_ID, name: itemName(editingItem) }
              : (library(editingId) ?? { id: editingId, name: nameOf(editingId) })
          }
          value={editing.value}
          fields={editing.fields}
          testKeys={editingSlot ? [] : [`exercise:${editingId}`]}
          intensityEnabled
          onFieldsChange={(fields) => setEditing({ ...editing, fields })}
          onClose={() => setEditing(null)}
          onApply={(prescription) => {
            updatePrescription(editing.ref, prescription, editing.away);
            setEditing(null);
          }}
        />
      ) : null}
      {picking ? (
        <PlannerExerciseFinder
          key={picking.kind === "slot" ? `${picking.slot.id}:${picking.create}` : picking.kind}
          orgId={orgId}
          exercises={context.exercises}
          busy={busy}
          title={
            pickingSlot
              ? picking.kind === "slot" && picking.create
                ? t.slot.createTitle(pickingSlot.said)
                : t.slot.title(pickingSlot.said)
              : picking.kind === "probable"
                ? t.probable.searchTitle(picking.warning.said ?? "")
                : t.replace.title(replacing ? itemName(replacing) : "")
          }
          hint={pickingSlot ? t.slot.hint : picking.kind === "probable" ? t.probable.searchHint : t.replace.hint}
          said={pickingSlot?.said ?? (picking.kind === "probable" ? (picking.warning.said ?? undefined) : undefined)}
          suggestion={pickingSlot?.suggestion}
          near={
            pickingSlot
              ? pickingSlot.candidates.map((c) => ({ id: c.exerciseId, name: c.name }))
              : picking.kind === "probable"
                ? picking.warning.alternatives?.map((c) => ({ id: c.exerciseId, name: c.name }))
                : undefined
          }
          startInCreate={picking.kind === "slot" && picking.create}
          pickLabel={pickingSlot ? t.slot.pick : picking.kind === "probable" ? t.probable.pick : t.replace.pick}
          onClose={() => onPicking(null)}
          onPick={(exercise, created) => pick(picking, exercise, created)}
        />
      ) : null}
    </View>
  );
}
