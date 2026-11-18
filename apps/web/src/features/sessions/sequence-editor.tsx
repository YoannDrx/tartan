"use client";

import type { ExerciseSummary, SequenceNode, SessionDraft } from "@tartan/contracts";
import {
  editSessionSequence,
  formatPrescription,
  groupSequenceSelection,
  moveSequenceNode,
  prescriptionForGroup,
  sequenceDepth,
  sequenceGroupSummary,
  sequenceGroups,
  sequenceNodeRef,
  type SequenceEdit,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  GripVertical,
  Layers,
  MoreHorizontal,
  Plus,
  Repeat2,
  Timer,
  Trash2,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { ActivityPicto } from "@/components/pictos";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { categoryColors, activityColors } from "@/lib/activity-colors";
import { cn } from "@/lib/cn";
import { usePointerDrag, type DragPoint } from "@/lib/use-pointer-drag";
import { ExercisePicker } from "./exercise-picker";

type Block = SessionDraft["blocks"][number];
type Repeat = Extract<SequenceNode, { kind: "repeat" }>;
const labels = m.builder.sequence;
const newRef = () => crypto.randomUUID();
const groupTone = activityColors("cones");
const menuItem =
  "flex min-h-11 cursor-pointer items-center rounded-button px-3 outline-none data-[highlighted]:bg-card-raised data-[disabled]:cursor-default data-[disabled]:opacity-50";

export type SequenceDestination = { parent: string | null; label: string };

export function SequenceEditor({
  block,
  exercises,
  onChange,
  onEdit,
  onEditAutonomous,
  onDestination,
}: {
  block: Block;
  exercises: ExerciseSummary[];
  onChange: (block: Block) => void;
  onEdit: (ref: string) => void;
  /** Ouvre la prescription de l'exercice fait à la place en autonomie. */
  onEditAutonomous?: (ref: string) => void;
  onDestination?: (destination: SequenceDestination) => void;
}) {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  // Une opération qui dépasserait deux niveaux est refusée par le domaine : le coach le lit, rien n'est perdu.
  const apply = (next: () => Block) => {
    try {
      onChange(next());
    } catch {
      toast.error(labels.moveError);
    }
  };
  const edit = (parent: string | null, command: SequenceEdit) =>
    apply(() => editSessionSequence(block, parent, command, newRef));
  const nodes = block.sequence ?? block.items.map((item) => ({ kind: "exercise" as const, itemRef: item.ref! }));
  const dragging = useSequenceDrag((ref, drop) => apply(() => moveSequenceNode(block, ref, drop.parent, drop.before)));
  return (
    <>
      <Level
        nodes={nodes}
        parent={null}
        parentName={block.name}
        depth={0}
        block={block}
        exercises={exercises}
        byId={byId}
        edit={edit}
        apply={apply}
        onEdit={onEdit}
        onEditAutonomous={onEditAutonomous}
        onDestination={onDestination}
        dragging={dragging}
      />
      {dragging.drag ? (
        <div
          aria-hidden
          className="on-card pointer-events-none fixed left-0 top-0 z-50 max-w-60 truncate rounded-button border border-card-line bg-card px-3 py-2 font-semibold shadow-float-strong"
          style={{ transform: `translate(${dragging.drag.x + 14}px, ${dragging.drag.y + 14}px)` }}
        >
          {dragging.drag.name}
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {dragging.announce}
      </p>
    </>
  );
}

type Drop = { parent: string | null; before: string | null };
type Grabbed = { ref: string; name: string; inside: Set<string> };
type Dragging = ReturnType<typeof useSequenceDrag>;

// La destination sous le pointeur : avant la carte survolée, ou en fin de niveau.
const locate = ({ x, y }: DragPoint, { inside }: Grabbed): Drop | null => {
  const target = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-seq-node],[data-seq-level]");
  if (!target) return null;
  let drop: Drop;
  if (target.dataset.seqLevel !== undefined) drop = { parent: target.dataset.seqLevel || null, before: null };
  else {
    const rect = target.getBoundingClientRect();
    const next = target.nextElementSibling as HTMLElement | null;
    drop = {
      parent: target.dataset.seqParent || null,
      before: y < rect.top + rect.height / 2 ? target.dataset.seqNode! : (next?.dataset.seqNode ?? null),
    };
  }
  return drop.parent !== null && inside.has(drop.parent) ? null : drop;
};

/**
 * Glisser-déposer au doigt comme à la souris : la poignée capture le pointeur (mécanique partagée avec le
 * planning, `usePointerDrag`). Les flèches et « Déplacer vers… » restent l'alternative.
 */
function useSequenceDrag(onDrop: (ref: string, drop: Drop) => void) {
  const [announce, setAnnounce] = useState("");
  const { drag, handle } = usePointerDrag<Grabbed, Drop>({
    locate,
    onStart: ({ name }) => setAnnounce(labels.dragging(name)),
    onEnd: ({ ref, name }, drop) => {
      if (drop && drop.before !== ref) {
        onDrop(ref, drop);
        setAnnounce(labels.dropped(name));
      } else setAnnounce(labels.dragCancelled);
    },
    onCancel: () => setAnnounce(labels.dragCancelled),
  });
  // La poignée n'ouvre rien au clic : seul l'appui la concerne.
  const grip = (node: SequenceNode, name: string) => {
    const ref = sequenceNodeRef(node);
    const inside = new Set([ref, ...(node.kind === "repeat" ? descendants(node) : [])]);
    return { onPointerDown: handle({ ref, name, inside }).onPointerDown };
  };
  return {
    drag: drag ? { ref: drag.item.ref, name: drag.item.name, x: drag.x, y: drag.y, drop: drag.drop } : null,
    announce,
    grip,
  };
}

/** Le trait qui montre où l'élément glissé va se poser. */
const DropLine = ({ show, end }: { show: boolean; end?: boolean }) =>
  show ? (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 h-1 rounded-full bg-accent",
        end ? "-bottom-1.5" : "-top-1.5",
      )}
    />
  ) : null;

/** La poignée : une cible de 44 px, pour le pointeur seulement (le clavier passe par les flèches et le menu). */
const Grip = ({ dragging, node, name }: { dragging: Dragging; node: SequenceNode; name: string }) => (
  <span
    aria-hidden
    title={labels.drag(name)}
    data-testid={`grip-${sequenceNodeRef(node)}`}
    className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-button text-soft active:cursor-grabbing"
    {...dragging.grip(node, name)}
  >
    <GripVertical className="size-5" />
  </span>
);

type LevelProps = {
  nodes: SequenceNode[];
  parent: string | null;
  parentName: string;
  depth: number;
  block: Block;
  exercises: ExerciseSummary[];
  byId: Map<string, ExerciseSummary>;
  edit: (parent: string | null, command: SequenceEdit) => void;
  apply: (next: () => Block) => void;
  onEdit: (ref: string) => void;
  onEditAutonomous?: (ref: string) => void;
  onDestination?: (destination: SequenceDestination) => void;
  dragging: Dragging;
  /** Ouvre le sélecteur pour choisir l'exercice fait à la place en autonomie. */
  onReplace?: (ref: string) => void;
};

function Level(props: LevelProps) {
  const { nodes, parent, parentName, depth, block, exercises, byId, edit, apply, onDestination, dragging } = props;
  const drop = dragging.drag?.drop;
  const here = drop !== undefined && drop !== null && drop.parent === parent;
  const [picking, setPicking] = useState<number | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const inGroup = parent !== null;
  const pick = (exercise: ExerciseSummary) => {
    if (replacing) {
      const prescription = inGroup ? prescriptionForGroup(exercise.defaultPrescription) : exercise.defaultPrescription;
      apply(() => ({
        ...block,
        items: block.items.map((item) =>
          item.ref === replacing ? { ...item, autonomous: { exerciseId: exercise.id, prescription } } : item,
        ),
      }));
      setReplacing(null);
      return;
    }
    const ref = newRef();
    edit(parent, {
      kind: "insert",
      at: picking ?? nodes.length,
      node: { kind: "exercise", itemRef: ref },
      item: {
        ref,
        exerciseId: exercise.id,
        prescription: inGroup ? prescriptionForGroup(exercise.defaultPrescription) : exercise.defaultPrescription,
      },
    });
    setPicking(null);
  };
  const openPicker = (at: number) => {
    setPicking(at);
    onDestination?.({ parent, label: parentName });
  };
  const toggle = (ref: string) =>
    setSelected((current) => (current.includes(ref) ? current.filter((r) => r !== ref) : [...current, ref]));
  return (
    <div className={cn("min-w-0 space-y-2", depth === 0 ? "p-3" : "p-2")} data-seq-level={parent ?? ""}>
      <ol className={cn("relative space-y-2", nodes.length === 0 && dragging.drag && "min-h-11")}>
        {nodes.map((node, index) => {
          const ref = sequenceNodeRef(node);
          return (
            <li
              key={ref}
              className={cn("relative min-w-0", dragging.drag?.ref === ref && "opacity-40")}
              data-seq-node={ref}
              data-seq-parent={parent ?? ""}
            >
              <DropLine show={here && drop.before === ref} />
              {selecting ? (
                <label className="mb-1 flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--color-accent)]"
                    checked={selected.includes(ref)}
                    onChange={() => toggle(ref)}
                  />
                  {labels.select(nodeName(node, block, byId))}
                </label>
              ) : null}
              <NodeCard {...props} node={node} index={index} onReplace={setReplacing} />
            </li>
          );
        })}
        <DropLine show={here && drop.before === null} end />
      </ol>
      {selecting ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={selected.length < 1}
            onClick={() => {
              apply(() =>
                groupSequenceSelection(block, parent, selected, {
                  ref: newRef(),
                  name: selected.length === 2 ? labels.groupKinds.superset : labels.groupKinds.circuit,
                }),
              );
              setSelected([]);
              setSelecting(false);
            }}
          >
            <Layers aria-hidden className="size-4" />
            {labels.groupSelection(selected.length)}
          </Button>
          <Button size="sm" variant="quiet" onClick={() => (setSelecting(false), setSelected([]))}>
            {m.common.cancel}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="quiet"
            className="min-h-11 flex-1 justify-center border border-dashed border-control-line tablet:flex-none"
            onClick={() => openPicker(nodes.length)}
          >
            <Plus aria-hidden className="size-4 text-accent" />
            {inGroup ? labels.addInto(parentName) : labels.addHere}
          </Button>
          <Button
            size="sm"
            variant="quiet"
            onClick={() => edit(parent, { kind: "append", node: { kind: "recovery", ref: newRef(), durationS: 60 } })}
          >
            <Timer aria-hidden className="size-4" />
            {labels.addRecovery}
          </Button>
          {depth < 2 ? (
            <Button
              size="sm"
              variant="quiet"
              onClick={() =>
                edit(parent, {
                  kind: "append",
                  node: {
                    kind: "repeat",
                    ref: newRef(),
                    name: labels.groupKinds.superset,
                    rounds: 3,
                    restBetweenRoundsS: 0,
                    children: [],
                  },
                })
              }
            >
              <Repeat2 aria-hidden className="size-4" />
              {labels.addGroup}
            </Button>
          ) : null}
          {nodes.length > 0 && depth + sequenceDepth(nodes) < 2 ? (
            <Button size="sm" variant="quiet" onClick={() => setSelecting(true)}>
              <Layers aria-hidden className="size-4" />
              {labels.groupAll}
            </Button>
          ) : null}
        </div>
      )}
      <ExercisePicker
        open={picking !== null || replacing !== null}
        onOpenChange={(open) => (open ? null : (setPicking(null), setReplacing(null)))}
        destination={parentName}
        title={
          replacing ? labels.replaceTitle(nodeName({ kind: "exercise", itemRef: replacing }, block, byId)) : undefined
        }
        inGroup={inGroup}
        exercises={exercises}
        onPick={pick}
      />
    </div>
  );
}

const nodeName = (node: SequenceNode, block: Block, byId: Map<string, ExerciseSummary>) => {
  if (node.kind === "repeat") return node.name;
  if (node.kind === "recovery") return labels.recoveryLine(node.durationS);
  const item = block.items.find((entry) => entry.ref === node.itemRef);
  return (item && byId.get(item.exerciseId)?.name) ?? labels.deletedExercise;
};

function NodeCard(props: LevelProps & { node: SequenceNode; index: number }) {
  const { node, index, nodes, parent, block, byId, edit, apply, onEdit } = props;
  const ref = sequenceNodeRef(node);
  const name = nodeName(node, block, byId);
  // Sur téléphone, monter et descendre passent dans « Autres actions » : la poignée suffit à la carte.
  const actions = (
    <div className="ml-auto flex shrink-0 items-center">
      <span className="hidden tablet:contents">
        <IconButton
          label={labels.up}
          disabled={index === 0}
          onClick={() => edit(parent, { kind: "move", ref, delta: -1 })}
        >
          <ArrowUp aria-hidden className="size-4" />
        </IconButton>
        <IconButton
          label={labels.down}
          disabled={index === nodes.length - 1}
          onClick={() => edit(parent, { kind: "move", ref, delta: 1 })}
        >
          <ArrowDown aria-hidden className="size-4" />
        </IconButton>
      </span>
      <MoreActions {...props} name={name} />
    </div>
  );
  const grip = <Grip dragging={props.dragging} node={node} name={name} />;

  if (node.kind === "recovery")
    return (
      <div className="flex min-w-0 items-center gap-1 text-soft">
        {grip}
        <Timer aria-hidden className="size-4 shrink-0" />
        <span aria-hidden className="h-px min-w-4 flex-1 border-t border-dashed border-control-line" />
        <label className="flex items-center gap-1 text-sm">
          <span className="sr-only">{labels.recoverySeconds}</span>
          <input
            type="number"
            min={1}
            max={3600}
            value={node.durationS}
            onChange={(e) =>
              edit(parent, { kind: "update", ref, node: { ...node, durationS: Number(e.target.value) } })
            }
            className="min-h-11 w-16 rounded-button border border-control-line bg-transparent px-2 text-right"
          />
          {labels.secondsUnit}
        </label>
        <span aria-hidden className="h-px min-w-4 flex-1 border-t border-dashed border-control-line" />
        <IconButton label={labels.remove(name)} onClick={() => edit(parent, { kind: "remove", ref })}>
          <Trash2 aria-hidden className="size-4" />
        </IconButton>
      </div>
    );

  if (node.kind === "exercise") {
    const item = block.items.find((entry) => entry.ref === node.itemRef);
    const exercise = item ? byId.get(item.exerciseId) : undefined;
    const tone = categoryColors(exercise?.category);
    const replacement = block.variant === "both" && item?.autonomous ? item.autonomous : null;
    const away = replacement ? byId.get(replacement.exerciseId) : undefined;
    return (
      <div className="min-w-0 rounded-button bg-card-raised">
        <div className="flex min-w-0 items-center gap-1 py-1 pr-1">
          {grip}
          <button
            type="button"
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1 text-left"
            onClick={() => item && onEdit(item.ref!)}
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-button"
              style={{ backgroundColor: tone.background, color: tone.text }}
            >
              <ActivityPicto kind={exercise?.category ?? "strength"} className="size-5" />
            </span>
            <span className="min-w-0 break-words leading-snug">
              <span className="block font-semibold">{name}</span>
              <span className="t-caption block font-normal text-soft">
                {exercise ? `${m.exerciseCategory[exercise.category as keyof typeof m.exerciseCategory]} · ` : ""}
                {(item && formatPrescription(item.prescription)) || m.builder.setPrescription}
              </span>
            </span>
          </button>
          {actions}
        </div>
        {replacement ? (
          // Ce que font les athlètes en autonomie à la place : la ligne ouvre sa prescription.
          <button
            type="button"
            className="flex min-h-11 w-full min-w-0 items-center gap-2 border-t border-card-line px-3 py-1.5 text-left text-sm"
            onClick={() => item && props.onEditAutonomous?.(item.ref!)}
          >
            <ArrowRightLeft aria-hidden className="size-4 shrink-0 text-soft" />
            <span className="min-w-0 break-words">
              <span className="font-semibold">{labels.autonomousLine(away?.name ?? labels.deletedExercise)}</span>
              <span className="text-soft">
                {" "}
                · {formatPrescription(replacement.prescription) || m.builder.setPrescription}
              </span>
            </span>
          </button>
        ) : null}
      </div>
    );
  }

  const summary = sequenceGroupSummary(node, block.items);
  return (
    <div
      role="group"
      aria-label={`${node.name}, ${labels.roundsLabel(node.rounds)}`}
      className="min-w-0 overflow-hidden rounded-card border-2"
      style={{ borderColor: groupTone.text }}
    >
      <div
        className="flex min-w-0 flex-wrap items-center gap-2 py-2 pl-1 pr-3"
        style={{ backgroundColor: groupTone.background, color: groupTone.text }}
      >
        {grip}
        <Repeat2 aria-hidden className="size-5 shrink-0" />
        <label className="min-w-0 flex-1">
          <span className="sr-only">{labels.groupName}</span>
          <input
            value={node.name}
            maxLength={80}
            onChange={(e) => edit(parent, { kind: "update", ref, node: { ...node, name: e.target.value } })}
            className="t-h2 min-h-11 w-full min-w-0 bg-transparent font-display"
          />
        </label>
        <span
          className="rounded-button px-2 py-0.5 font-display text-2xl font-bold"
          style={{ backgroundColor: groupTone.text, color: groupTone.background }}
        >
          {labels.roundsBadge(node.rounds)}
        </span>
        {actions}
      </div>
      <div className="grid grid-cols-2 gap-2 px-3 pt-2 tablet:grid-cols-3">
        <Field label={labels.rounds}>
          {(a) => (
            <Input
              {...a}
              type="number"
              min={2}
              max={50}
              value={node.rounds}
              onChange={(e) => edit(parent, { kind: "update", ref, node: { ...node, rounds: Number(e.target.value) } })}
            />
          )}
        </Field>
        <Field label={labels.betweenRounds}>
          {(a) => (
            <Input
              {...a}
              type="number"
              min={0}
              max={3600}
              value={node.restBetweenRoundsS}
              onChange={(e) =>
                edit(parent, { kind: "update", ref, node: { ...node, restBetweenRoundsS: Number(e.target.value) } })
              }
            />
          )}
        </Field>
        <Field label={labels.groupType} className="col-span-2 tablet:col-span-1">
          {(a) => (
            <Select
              {...a}
              value={(Object.values(labels.groupKinds) as string[]).includes(node.name) ? node.name : ""}
              onChange={(e) =>
                e.target.value && edit(parent, { kind: "update", ref, node: { ...node, name: e.target.value } })
              }
            >
              <option value="">{labels.choose}</option>
              {Object.values(labels.groupKinds).map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Level
        {...props}
        nodes={node.children}
        parent={node.ref}
        parentName={node.name}
        depth={props.depth + 1}
        edit={edit}
        apply={apply}
      />
      <p className="border-t px-3 py-2 text-sm" style={{ borderColor: groupTone.background, color: groupTone.text }}>
        {summary.totalSets === 0
          ? labels.groupEmpty
          : `${labels.groupSummary(summary.rounds, summary.setsPerRound)} · ${labels.noFinalRest}`}
      </p>
    </div>
  );
}

function MoreActions(props: LevelProps & { node: SequenceNode; name: string; index: number }) {
  const { node, name, index, nodes, parent, block, edit, apply } = props;
  const ref = sequenceNodeRef(node);
  const own = node.kind === "repeat" ? descendants(node) : new Set<string>();
  const replaced = node.kind === "exercise" && block.items.some((item) => item.ref === ref && item.autonomous);
  const targets = sequenceGroups(block).filter(
    (group) => group.ref !== parent && group.ref !== ref && !own.has(group.ref),
  );
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <IconButton label={labels.moreActions(name)}>
          <MoreHorizontal aria-hidden className="size-4" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="menu-enter on-card z-50 w-64 max-w-[calc(100vw-16px)] rounded-card border border-card-line bg-card p-1.5 shadow-float-strong"
        >
          <DropdownMenu.Item
            className={cn(menuItem, "tablet:hidden")}
            disabled={index === 0}
            onSelect={() => edit(parent, { kind: "move", ref, delta: -1 })}
          >
            {labels.up}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={cn(menuItem, "tablet:hidden")}
            disabled={index === nodes.length - 1}
            onSelect={() => edit(parent, { kind: "move", ref, delta: 1 })}
          >
            {labels.down}
          </DropdownMenu.Item>
          <DropdownMenu.Item className={menuItem} onSelect={() => edit(parent, { kind: "duplicate", ref })}>
            {labels.duplicate(name)}
          </DropdownMenu.Item>
          {parent !== null || targets.length ? (
            <>
              <DropdownMenu.Label className="t-caption px-3 pt-2 text-soft">{labels.moveTo}</DropdownMenu.Label>
              {parent !== null ? (
                <DropdownMenu.Item
                  className={menuItem}
                  onSelect={() => apply(() => moveSequenceNode(block, ref, null))}
                >
                  {labels.moveOut}
                </DropdownMenu.Item>
              ) : null}
              {targets.map((group) => (
                <DropdownMenu.Item
                  key={group.ref}
                  className={menuItem}
                  onSelect={() => apply(() => moveSequenceNode(block, ref, group.ref))}
                >
                  {labels.moveInto(group.name)}
                </DropdownMenu.Item>
              ))}
            </>
          ) : null}
          {node.kind === "repeat" ? (
            <DropdownMenu.Item className={menuItem} onSelect={() => edit(parent, { kind: "unwrap", ref })}>
              {labels.ungroup}
            </DropdownMenu.Item>
          ) : null}
          {/* Dans un bloc commun, un exercice peut changer pour les athlètes en autonomie. */}
          {node.kind === "exercise" && block.variant === "both" ? (
            <>
              <DropdownMenu.Item className={menuItem} onSelect={() => props.onReplace?.(ref)}>
                {replaced ? labels.changeAutonomous : labels.replaceAutonomous}
              </DropdownMenu.Item>
              {replaced ? (
                <DropdownMenu.Item
                  className={menuItem}
                  onSelect={() =>
                    apply(() => ({
                      ...block,
                      items: block.items.map((item) => {
                        if (item.ref !== ref) return item;
                        const { autonomous: _replacement, ...rest } = item;
                        return rest;
                      }),
                    }))
                  }
                >
                  {labels.keepAutonomous}
                </DropdownMenu.Item>
              ) : null}
            </>
          ) : null}
          <DropdownMenu.Separator className="my-1 h-px bg-card-line" />
          <DropdownMenu.Item className={menuItem} onSelect={() => edit(parent, { kind: "remove", ref })}>
            {labels.remove(name)}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const descendants = (node: Repeat): Set<string> =>
  new Set(
    node.children.flatMap((child) =>
      child.kind === "repeat" ? [child.ref, ...descendants(child)] : [sequenceNodeRef(child)],
    ),
  );
