import type { ExerciseSummary, SequenceNode, SessionDraft } from "@tartan/contracts";
import { sequenceRoles, tokens } from "@tartan/design-tokens";
import {
  editSessionSequence,
  formatPrescription,
  sequenceDepth,
  sequenceNodeRef,
  type SequenceEdit,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { randomUUID } from "expo-crypto";
import { useState } from "react";
import { View } from "react-native";
import { Button, Field, T } from "../../ui/primitives";
import { Sheet } from "../../ui/sheet";
import { radius, space, useWorkTheme } from "../../ui/theme";

type Block = SessionDraft["blocks"][number];
const labels = m.builder.sequence;

type Props = {
  block: Block;
  exercises: ExerciseSummary[];
  onChange: (block: Block) => void;
  onEdit: (ref: string) => void;
  onAdjust: (ref: string) => void;
  onMove: (ref: string) => void;
  canMove: boolean;
};

export function NativeSequenceEditor(props: Props) {
  const edit = (parent: string | null, command: SequenceEdit) =>
    props.onChange(editSessionSequence(props.block, parent, command, randomUUID));
  return (
    <Level
      {...props}
      parent={null}
      depth={0}
      nodes={props.block.sequence ?? props.block.items.map((item) => ({ kind: "exercise", itemRef: item.ref! }))}
      edit={edit}
    />
  );
}

function Level({
  nodes,
  parent,
  depth,
  edit,
  ...props
}: Props & {
  nodes: SequenceNode[];
  parent: string | null;
  depth: number;
  edit: (parent: string | null, command: SequenceEdit) => void;
}) {
  const theme = useWorkTheme();
  const [choosing, setChoosing] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const append = (node: SequenceNode) => edit(parent, { kind: "append", node });
  return (
    <View style={{ gap: space.sm }}>
      {nodes.map((node, index) => {
        const ref = sequenceNodeRef(node);
        const item = node.kind === "exercise" ? props.block.items.find((item) => item.ref === node.itemRef) : undefined;
        const exercise = item ? props.exercises.find((exercise) => exercise.id === item.exerciseId) : undefined;
        const role =
          node.kind === "repeat"
            ? "repeat"
            : node.kind === "recovery"
              ? "recovery"
              : exercise?.category === "strength"
                ? "force"
                : ["plyo", "running_drill", "jump"].includes(exercise?.category ?? "")
                  ? "speed"
                  : "preparation";
        const tone = (theme === "light" ? tokens.activity : tokens.activityDark)[sequenceRoles[role]];
        const name =
          node.kind === "repeat"
            ? node.name
            : node.kind === "recovery"
              ? m.builder.sequenceRecovery
              : (exercise?.name ?? labels.deletedExercise);
        const update = (next: SequenceNode) => edit(parent, { kind: "update", ref, node: next });
        return (
          <View
            key={ref}
            testID={`sequence-node-${ref}`}
            style={{
              gap: space.sm,
              padding: space.sm,
              borderRadius: radius.button,
              borderWidth: 1,
              borderColor: tone.background,
            }}
          >
            <View testID={`sequence-heading-${ref}`} style={{ padding: space.sm, borderRadius: radius.thumb, backgroundColor: tone.background }}>
              <T variant="bodyStrong" style={{ color: tone.text }}>
                {name}
              </T>
              {item ? (
                <T variant="small" style={{ color: tone.text }}>
                  {formatPrescription(item.prescription) || m.builder.setPrescription}
                </T>
              ) : null}
            </View>
            {item ? (
              <>
                <Button
                  compact
                  variant="secondary"
                  label={m.builder.setPrescription}
                  accessibilityLabel={`${m.builder.setPrescription} · ${name}`}
                  onPress={() => props.onEdit(ref)}
                />
              </>
            ) : null}
            {node.kind === "recovery" ? (
              <Field
                label={labels.recoverySeconds}
                keyboardType="number-pad"
                value={String(node.durationS)}
                onChangeText={(text) => update({ ...node, durationS: Number(text) })}
              />
            ) : null}
            {node.kind === "repeat" ? (
              <>
                <Field
                  label={labels.groupName}
                  value={node.name}
                  maxLength={80}
                  onChangeText={(name) => update({ ...node, name })}
                />
                <Field
                  label={labels.rounds}
                  testID={`sequence-rounds-${ref}`}
                  keyboardType="number-pad"
                  value={String(node.rounds)}
                  onChangeText={(text) => update({ ...node, rounds: Number(text) })}
                />
                <Field
                  label={labels.betweenRounds}
                  keyboardType="number-pad"
                  value={String(node.restBetweenRoundsS)}
                  onChangeText={(text) => update({ ...node, restBetweenRoundsS: Number(text) })}
                />
                <T variant="caption" tone="muted">
                  {labels.noFinalRest}
                </T>
                <Level {...props} nodes={node.children} parent={node.ref} depth={depth + 1} edit={edit} />
              </>
            ) : null}
            <Button
              compact
              variant="secondary"
              label={expanded.includes(ref) ? m.nativeBuilder.hideAdvanced : m.nativeBuilder.advanced}
              accessibilityLabel={`${m.nativeBuilder.advanced} · ${name}`}
              onPress={() =>
                setExpanded((current) =>
                  current.includes(ref) ? current.filter((value) => value !== ref) : [...current, ref],
                )
              }
            />
            {expanded.includes(ref) ? (
              <>
                {item ? (
                  <>
                    {" "}
                    <Button
                      compact
                      variant="secondary"
                      label={m.builder.adjustments}
                      onPress={() => props.onAdjust(ref)}
                    />
                    {props.canMove ? (
                      <Button
                        compact
                        variant="secondary"
                        label={m.nativeBuilder.moveTo}
                        onPress={() => props.onMove(ref)}
                      />
                    ) : null}
                  </>
                ) : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                  <Button
                    compact
                    variant="secondary"
                    label={labels.up}
                    accessibilityLabel={`${labels.up} · ${name}`}
                    disabled={index === 0}
                    onPress={() => edit(parent, { kind: "move", ref, delta: -1 })}
                  />
                  <Button
                    compact
                    variant="secondary"
                    label={labels.down}
                    accessibilityLabel={`${labels.down} · ${name}`}
                    disabled={index === nodes.length - 1}
                    onPress={() => edit(parent, { kind: "move", ref, delta: 1 })}
                  />
                </View>
                <Button
                  compact
                  variant="secondary"
                  label={labels.duplicate(name)}
                  onPress={() => edit(parent, { kind: "duplicate", ref })}
                />
                {node.kind === "repeat" ? (
                  <Button
                    compact
                    variant="secondary"
                    label={labels.ungroup}
                    onPress={() => edit(parent, { kind: "unwrap", ref })}
                  />
                ) : null}
                <Button
                  compact
                  variant="secondary"
                  label={m.common.delete}
                  accessibilityLabel={labels.remove(name)}
                  onPress={() => edit(parent, { kind: "remove", ref })}
                />
              </>
            ) : null}
          </View>
        );
      })}
      <Button
        variant="secondary"
        label={m.nativeBuilder.addExercise}
        disabled={props.block.items.length >= 60}
        onPress={() => {
          setSearch("");
          setChoosing(true);
        }}
      />
      <Button
        variant="secondary"
        label={m.builder.sequenceRecovery}
        onPress={() => append({ kind: "recovery", ref: randomUUID(), durationS: 60 })}
      />
      {depth < 2 ? (
        <Button
          variant="secondary"
          label={labels.addGroup}
          onPress={() =>
            append({
              kind: "repeat",
              ref: randomUUID(),
              name: labels.groupDefault,
              rounds: 3,
              restBetweenRoundsS: 0,
              children: [],
            })
          }
        />
      ) : null}
      {nodes.length > 0 && depth + sequenceDepth(nodes) < 2 ? (
        <Button
          variant="secondary"
          label={labels.groupAll}
          testID={`sequence-group-all-${parent ?? props.block.ref}`}
          onPress={() => edit(parent, { kind: "repeatAll", ref: randomUUID(), name: labels.groupDefault })}
        />
      ) : null}
      {choosing ? (
        <Sheet visible title={m.builder.library} onClose={() => setChoosing(false)}>
          <Field label={m.common.search} value={search} onChangeText={setSearch} />
          {props.exercises
            .filter((exercise) =>
              `${exercise.name} ${exercise.aliases?.join(" ") ?? ""} ${exercise.tags.join(" ")}`
                .toLocaleLowerCase("fr")
                .includes(search.toLocaleLowerCase("fr")),
            )
            .map((exercise) => (
              <Button
                key={exercise.id}
                variant="secondary"
                label={exercise.name}
                onPress={() => {
                  const ref = randomUUID();
                  edit(parent, {
                    kind: "append",
                    node: { kind: "exercise", itemRef: ref },
                    item: { ref, exerciseId: exercise.id, prescription: exercise.defaultPrescription },
                  });
                  setChoosing(false);
                }}
              />
            ))}
        </Sheet>
      ) : null}
    </View>
  );
}
