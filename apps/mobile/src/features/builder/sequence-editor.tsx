import type { ExerciseSummary, SequenceNode, SessionDraft } from "@tartan/contracts";
import { sequenceRoles, tokens } from "@tartan/design-tokens";
import {
  editSessionSequence,
  formatPrescription,
  moveSequenceNode,
  prescriptionForGroup,
  sequenceDepth,
  sequenceGroups,
  sequenceNodeRef,
  type SequenceEdit,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { randomUUID } from "expo-crypto";
import { useState, type ReactNode } from "react";
import { ArrowRightLeft } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Button, Field, T } from "../../ui/primitives";
import { Sheet } from "../../ui/sheet";
import { radius, space, usePalette, useWorkTheme } from "../../ui/theme";

type Block = SessionDraft["blocks"][number];
const labels = m.builder.sequence;

type Item = Block["items"][number];

/**
 * Ce qu'un écran ajoute à un exercice, sans que l'éditeur en connaisse le sens : le planificateur y pose l'état
 * de chaque exercice (« À vérifier », emplacement à compléter). `card` remplace l'en-tête de l'exercice et ses
 * options avancées ; `note` se lit sous l'en-tête.
 */
export type SequenceItemExtras = {
  name?: (item: Item) => string | undefined;
  card?: (item: Item) => ReactNode;
  note?: (item: Item) => ReactNode;
  // Des gestes de plus parmi les options avancées d'un exercice (remplacer la fiche, par exemple).
  advanced?: (item: Item) => ReactNode;
};

/** Le sélecteur de fiche d'un écran qui cherche dans toute la bibliothèque, à la place de la liste intégrée. */
export type SequencePicker = (props: {
  title: string;
  onPick: (exercise: ExerciseSummary) => void;
  onClose: () => void;
}) => ReactNode;

type Props = {
  block: Block;
  exercises: ExerciseSummary[];
  onChange: (block: Block) => void;
  onEdit: (ref: string) => void;
  // Réglages par athlète : absents, le bouton n'est pas montré.
  onAdjust?: (ref: string) => void;
  onMove: (ref: string) => void;
  canMove: boolean;
  // La prescription de l'exercice fait en autonomie à la place de celui du club.
  onEditAutonomous: (ref: string) => void;
  onError: (message: string) => void;
  extras?: SequenceItemExtras;
  picker?: SequencePicker;
};

export function NativeSequenceEditor(props: Props) {
  const edit = (parent: string | null, command: SequenceEdit) =>
    props.onChange(editSessionSequence(props.block, parent, command, randomUUID));
  // Un déplacement entre groupes peut dépasser deux niveaux : le domaine refuse, l'écran le dit.
  const apply = (next: () => Block) => {
    try {
      props.onChange(next());
    } catch {
      props.onError(labels.moveError);
    }
  };
  return (
    <Level
      {...props}
      parent={null}
      depth={0}
      nodes={props.block.sequence ?? props.block.items.map((item) => ({ kind: "exercise", itemRef: item.ref! }))}
      edit={edit}
      apply={apply}
    />
  );
}

const descendants = (node: SequenceNode): Set<string> =>
  new Set(
    node.kind === "repeat"
      ? node.children.flatMap((child) => (child.kind === "repeat" ? [child.ref, ...descendants(child)] : []))
      : [],
  );

/** La ligne « En autonomie : … » sous un exercice remplacé ; elle ouvre la prescription du remplacement. */
const AutonomousLine = ({
  item,
  exercises,
  onPress,
}: {
  item: Item;
  exercises: ExerciseSummary[];
  onPress: () => void;
}) => {
  const p = usePalette();
  const away = exercises.find((exercise) => exercise.id === item.autonomous?.exerciseId);
  const text = labels.autonomousLine(away?.name ?? labels.deletedExercise);
  const prescription =
    (item.autonomous && formatPrescription(item.autonomous.prescription)) || m.builder.setPrescription;
  return (
    <Pressable
      testID={`autonomous-line-${item.ref}`}
      accessibilityRole="button"
      accessibilityLabel={`${text} · ${prescription}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingHorizontal: space.sm,
        borderRadius: radius.thumb,
        backgroundColor: p.raised,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <ArrowRightLeft size={18} color={p.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
      <T variant="small" style={{ flex: 1 }}>
        <T variant="smallStrong">{text}</T> · {prescription}
      </T>
    </Pressable>
  );
};

function Level({
  nodes,
  parent,
  depth,
  edit,
  apply,
  ...props
}: Props & {
  nodes: SequenceNode[];
  parent: string | null;
  depth: number;
  edit: (parent: string | null, command: SequenceEdit) => void;
  apply: (next: () => Block) => void;
}) {
  const theme = useWorkTheme();
  const [choosing, setChoosing] = useState(false);
  // L'exercice du club que le choix remplace en autonomie ; null pour un ajout.
  const [replacing, setReplacing] = useState<string | null>(null);
  const shared = props.block.variant === "both";
  const setAutonomous = (ref: string, autonomous: Item["autonomous"]) =>
    apply(() => ({
      ...props.block,
      items: props.block.items.map((entry) => {
        if (entry.ref !== ref) return entry;
        const { autonomous: _previous, ...rest } = entry;
        return autonomous ? { ...rest, autonomous } : rest;
      }),
    }));
  const groups = sequenceGroups(props.block);
  // Les groupes où l'élément peut aller : ni le sien, ni lui-même, ni l'un de ses sous-groupes.
  const targetsFor = (node: SequenceNode, ref: string) => {
    const own = descendants(node);
    return groups.filter((group) => group.ref !== parent && group.ref !== ref && !own.has(group.ref));
  };
  const nameOf = (ref: string) => {
    const item = props.block.items.find((entry) => entry.ref === ref);
    return (
      (item && props.extras?.name?.(item)) ??
      props.exercises.find((exercise) => exercise.id === item?.exerciseId)?.name ??
      labels.deletedExercise
    );
  };
  const pick = (exercise: ExerciseSummary) => {
    if (replacing) {
      // Dans un groupe, le remplacement compte aussi une série par tour.
      const prescription =
        parent !== null ? prescriptionForGroup(exercise.defaultPrescription) : exercise.defaultPrescription;
      setAutonomous(replacing, { exerciseId: exercise.id, prescription });
      setReplacing(null);
      setChoosing(false);
      return;
    }
    const ref = randomUUID();
    edit(parent, {
      kind: "append",
      node: { kind: "exercise", itemRef: ref },
      item: { ref, exerciseId: exercise.id, prescription: exercise.defaultPrescription },
    });
    setChoosing(false);
  };
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
              : ((item && props.extras?.name?.(item)) ?? exercise?.name ?? labels.deletedExercise);
        const update = (next: SequenceNode) => edit(parent, { kind: "update", ref, node: next });
        // L'écran prend la place de l'exercice : ses gestes sont les siens, l'éditeur n'y ajoute rien.
        const card = item ? props.extras?.card?.(item) : null;
        if (card) return <View key={ref}>{card}</View>;
        const note = item ? props.extras?.note?.(item) : null;
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
            <View
              testID={`sequence-heading-${ref}`}
              style={{ padding: space.sm, borderRadius: radius.thumb, backgroundColor: tone.background }}
            >
              <T variant="bodyStrong" style={{ color: tone.text }}>
                {name}
              </T>
              {item ? (
                <T variant="small" style={{ color: tone.text }}>
                  {formatPrescription(item.prescription) || m.builder.setPrescription}
                </T>
              ) : null}
            </View>
            {note}
            {item ? (
              <>
                <Button
                  compact
                  variant="secondary"
                  label={m.builder.setPrescription}
                  accessibilityLabel={`${m.builder.setPrescription} · ${name}`}
                  testID={`sequence-edit-${ref}`}
                  onPress={() => props.onEdit(ref)}
                />
                {shared && item.autonomous ? (
                  <AutonomousLine item={item} exercises={props.exercises} onPress={() => props.onEditAutonomous(ref)} />
                ) : null}
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
                <Level {...props} nodes={node.children} parent={node.ref} depth={depth + 1} edit={edit} apply={apply} />
              </>
            ) : null}
            <Button
              compact
              variant="secondary"
              label={expanded.includes(ref) ? m.nativeBuilder.hideAdvanced : m.nativeBuilder.advanced}
              accessibilityLabel={`${m.nativeBuilder.advanced} · ${name}`}
              testID={`sequence-advanced-${ref}`}
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
                    {props.onAdjust ? (
                      <Button
                        compact
                        variant="secondary"
                        label={m.builder.adjustments}
                        onPress={() => props.onAdjust?.(ref)}
                      />
                    ) : null}
                    {props.extras?.advanced?.(item)}
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
                {/* Dans un groupe, hors d'un groupe, d'un groupe à l'autre : le menu du téléphone remplace le glisser. */}
                {parent !== null || targetsFor(node, ref).length ? (
                  <View style={{ gap: space.xs }}>
                    <T variant="smallStrong">{labels.moveTo}</T>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                      {parent !== null ? (
                        <Button
                          compact
                          variant="secondary"
                          label={labels.moveOut}
                          accessibilityLabel={`${labels.moveTo} · ${labels.moveOut} · ${name}`}
                          testID={`sequence-move-out-${ref}`}
                          onPress={() => apply(() => moveSequenceNode(props.block, ref, null))}
                        />
                      ) : null}
                      {targetsFor(node, ref).map((group) => (
                        <Button
                          key={group.ref}
                          compact
                          variant="secondary"
                          label={labels.moveInto(group.name)}
                          accessibilityLabel={`${labels.moveTo} · ${labels.moveInto(group.name)} · ${name}`}
                          testID={`sequence-move-into-${group.ref}-${ref}`}
                          onPress={() => apply(() => moveSequenceNode(props.block, ref, group.ref))}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}
                <Button
                  compact
                  variant="secondary"
                  label={labels.duplicate(name)}
                  onPress={() => edit(parent, { kind: "duplicate", ref })}
                />
                {/* Dans un bloc commun, un exercice peut changer pour les athlètes en autonomie. */}
                {item && shared ? (
                  <>
                    <Button
                      compact
                      variant="secondary"
                      testID={`replace-autonomous-${ref}`}
                      label={item.autonomous ? labels.changeAutonomous : labels.replaceAutonomous}
                      accessibilityLabel={`${item.autonomous ? labels.changeAutonomous : labels.replaceAutonomous} · ${name}`}
                      onPress={() => {
                        setSearch("");
                        setReplacing(ref);
                        setChoosing(true);
                      }}
                    />
                    {item.autonomous ? (
                      <Button
                        compact
                        variant="secondary"
                        label={labels.keepAutonomous}
                        accessibilityLabel={`${labels.keepAutonomous} · ${name}`}
                        onPress={() => setAutonomous(ref, undefined)}
                      />
                    ) : null}
                  </>
                ) : null}
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
          setReplacing(null);
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
      {choosing && props.picker ? (
        props.picker({
          title: replacing ? labels.replaceTitle(nameOf(replacing)) : m.builder.library,
          onPick: pick,
          onClose: () => setChoosing(false),
        })
      ) : choosing ? (
        <Sheet
          visible
          title={replacing ? labels.replaceTitle(nameOf(replacing)) : m.builder.library}
          onClose={() => setChoosing(false)}
        >
          <Field label={m.common.search} testID="exercise-search" value={search} onChangeText={setSearch} />
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
                testID={`exercise-option-${exercise.id}`}
                label={exercise.name}
                onPress={() => pick(exercise)}
              />
            ))}
        </Sheet>
      ) : null}
    </View>
  );
}
