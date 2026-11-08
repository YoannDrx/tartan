import {
  sessionType,
  sessionTextLimits,
  type PlannerReviewedDraft,
  type PlannerProposalResponse,
  type Prescription,
} from "@tartan/contracts";
import { phasePlanningKey, type PhasePlanningReadiness } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import type { api } from "../lib/api";
import { Button, Divider, Field, SectionTitle, T } from "../ui/primitives";
import { space } from "../ui/theme";
import { NativePhasePlanning } from "./phase-planning";
import { BuilderSummary } from "./builder/summary";
import { PrescriptionEditor } from "./builder/prescription-editor";
import { prescriptionFields, type PrescriptionFields } from "./builder/form";
import { PlannerLoadPreview } from "./planner-load-preview";
import { Sheet } from "../ui/sheet";

type Context = Awaited<ReturnType<typeof api.sessionBuilder>>;
type Update = (index: number, update: (session: PlannerReviewedDraft) => PlannerReviewedDraft) => void;

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
  context: Context;
  proposal: PlannerProposalResponse;
  orgId: string;
  busy: boolean;
  onUpdate: Update;
  onPhaseReady: (index: number, state: PhasePlanningReadiness) => void;
  onLoadsReady: (index: number, ready: boolean) => void;
}) {
  const [editing, setEditing] = useState<{
    ref: string;
    exerciseId: string;
    value: Prescription;
    fields: PrescriptionFields;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [replacement, setReplacement] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const acceptLoads = useCallback((ready: boolean) => onLoadsReady(index, ready), [index, onLoadsReady]);
  const acceptPhase = useCallback(
    (state: PhasePlanningReadiness) => {
      onPhaseReady(index, state);
      if (state.ready && state.review)
        onUpdate(index, (current) => {
          const key = phasePlanningKey(
            current.date,
            current.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId),
            current.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId),
          );
          return key !== state.key || JSON.stringify(current.phaseReview) === JSON.stringify(state.review)
            ? current
            : { ...current, phaseReview: state.review };
        });
    },
    [index, onUpdate, onPhaseReady],
  );
  const change = (patch: Partial<PlannerReviewedDraft>) => onUpdate(index, (old) => ({ ...old, ...patch }));
  const exercise = context.exercises.find((e) => e.id === editing?.exerciseId);
  return (
    <View style={{ gap: space.md }}>
      <Divider />
      <BuilderSummary form={session} duration={session.draft.durationMin?.toString() ?? ""} context={context} />
      <Button
        variant="secondary"
        label={m.common.edit}
        expanded={expanded}
        disabled={busy}
        onPress={() => setExpanded(!expanded)}
      />
      {expanded ? (
        <View style={{ gap: space.sm }}>
          <Field
            label={m.builder.title}
            value={session.draft.title}
            editable={!busy}
            hint={
              session.draft.title.trim().length > sessionTextLimits.title
                ? m.aiPlanner.textLimit(session.draft.title.trim().length, sessionTextLimits.title)
                : undefined
            }
            onChangeText={(title) => change({ draft: { ...session.draft, title } })}
          />
          <Field
            label={m.trainingPhases.start}
            value={session.date}
            editable={!busy}
            hint={m.trainingPhases.dateFormat}
            onChangeText={(date) => change({ date, phaseReview: undefined })}
          />
          <Field
            label={m.builder.time}
            value={session.startTime ?? ""}
            editable={!busy}
            onChangeText={(startTime) => change({ startTime: startTime || null })}
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
          <T variant="smallStrong">{m.builder.type}</T>
          {sessionType.options.map((type) => (
            <Button
              key={type}
              label={m.sessionType[type]}
              selected={session.draft.type === type}
              variant="secondary"
              disabled={busy}
              onPress={() => change({ draft: { ...session.draft, type } })}
            />
          ))}
          <SectionTitle>{m.builder.audience}</SectionTitle>
          {proposal.targets.map((target) => {
            const selected = session.assignments.some((a) => a.targetType === target.type && a.targetId === target.id);
            return (
              <Button
                key={target.token}
                label={target.label}
                selected={selected}
                variant="secondary"
                disabled={busy}
                onPress={() =>
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
          {session.draft.blocks.map((block) => (
            <View key={block.ref} style={{ gap: space.sm }}>
              <Field
                label={m.nativeBuilder.blockName}
                value={block.name}
                editable={!busy}
                hint={
                  block.name.trim().length > sessionTextLimits.blockName
                    ? m.aiPlanner.textLimit(block.name.trim().length, sessionTextLimits.blockName)
                    : undefined
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
              {block.items.map((item) => (
                <View key={item.ref} style={{ gap: space.xs }}>
                  {(item.prescription.notes?.length ?? 0) > sessionTextLimits.notes ? (
                    <T tone="danger">
                      {m.builder.notes} :{" "}
                      {m.aiPlanner.textLimit(item.prescription.notes!.length, sessionTextLimits.notes)}
                    </T>
                  ) : null}
                  <Button
                    variant="secondary"
                    disabled={busy}
                    label={`${m.builder.setPrescription} · ${context.exercises.find((e) => e.id === item.exerciseId)?.name ?? m.common.notFound}`}
                    onPress={() =>
                      setEditing({
                        ref: item.ref!,
                        exerciseId: item.exerciseId,
                        value: item.prescription,
                        fields: prescriptionFields(item.prescription),
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    disabled={busy}
                    label={m.aiPlanner.replaceExercise}
                    onPress={() => {
                      setReplacement(item.ref!);
                      setSearch("");
                    }}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}
      {context.phasesEnabled ? (
        <NativePhasePlanning
          key={phasePlanningKey(
            session.date,
            session.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId),
            session.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId),
          )}
          orgId={orgId}
          date={session.date}
          groupIds={session.assignments.filter((a) => a.targetType === "group").map((a) => a.targetId)}
          athleteIds={session.assignments.filter((a) => a.targetType === "athlete").map((a) => a.targetId)}
          initialChoices={session.phaseReview?.choices ?? []}
          onReady={acceptPhase}
        />
      ) : null}
      <PlannerLoadPreview
        key={JSON.stringify(session)}
        orgId={orgId}
        proposalId={proposal.id}
        version={proposal.version}
        session={session}
        disabled={busy}
        onReady={acceptLoads}
        onLoad={(athleteId, itemRef, load) =>
          onUpdate(index, (old) => {
            const existing = old.overrides.find((o) => o.athleteId === athleteId && o.itemRef === itemRef);
            const prescription = { ...existing?.prescription };
            if (load) prescription.load = load;
            else delete prescription.load;
            const remaining = old.overrides.filter((o) => o.athleteId !== athleteId || o.itemRef !== itemRef);
            return {
              ...old,
              overrides: Object.keys(prescription).length
                ? [...remaining, { athleteId, itemRef, prescription }]
                : remaining,
            };
          })
        }
      />
      {editing && exercise ? (
        <PrescriptionEditor
          title={m.builder.setPrescription}
          exercise={exercise}
          value={editing.value}
          fields={editing.fields}
          testKeys={[`exercise:${exercise.id}`]}
          onFieldsChange={(fields) => setEditing({ ...editing, fields })}
          onClose={() => setEditing(null)}
          onApply={(prescription) => {
            onUpdate(index, (old) => ({
              ...old,
              draft: {
                ...old.draft,
                blocks: old.draft.blocks.map((b) => ({
                  ...b,
                  items: b.items.map((i) => (i.ref === editing.ref ? { ...i, prescription } : i)),
                })),
              },
            }));
            setEditing(null);
          }}
        />
      ) : null}
      {replacement ? (
        <Sheet visible title={m.aiPlanner.replaceExercise} onClose={() => setReplacement(null)}>
          <T>{m.aiPlanner.replacementReset}</T>
          <Field label={m.common.search} value={search} onChangeText={setSearch} />
          {context.exercises
            .filter(
              (e) =>
                proposal.exercises.some((known) => known.id === e.id) &&
                e.name.toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr")),
            )
            .slice(0, 50)
            .map((e) => (
              <Button
                key={e.id}
                label={e.name}
                disabled={busy}
                variant="secondary"
                onPress={() =>
                  Alert.alert(m.aiPlanner.replaceExercise, m.aiPlanner.replacementReset, [
                    { text: m.common.cancel, style: "cancel" },
                    {
                      text: m.common.yes,
                      onPress: () => {
                        const prescription = { ...e.defaultPrescription };
                        if (prescription.load?.type === "pct_1rm")
                          prescription.load = { ...prescription.load, test: `exercise:${e.id}` };
                        onUpdate(index, (old) => ({
                          ...old,
                          overrides: old.overrides.filter((o) => o.itemRef !== replacement),
                          draft: {
                            ...old.draft,
                            blocks: old.draft.blocks.map((b) => ({
                              ...b,
                              items: b.items.map((item) =>
                                item.ref === replacement ? { ...item, exerciseId: e.id, prescription } : item,
                              ),
                            })),
                          },
                        }));
                        setReplacement(null);
                      },
                    },
                  ])
                }
              />
            ))}
          <T variant="small" tone="muted">
            {m.aiPlanner.refineSearch}
          </T>
        </Sheet>
      ) : null}
    </View>
  );
}
