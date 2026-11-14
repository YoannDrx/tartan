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
import { ArrowDown, ArrowUp, Layers, MoreHorizontal, Plus, Repeat2, Timer, Trash2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { ActivityPicto } from "@/components/pictos";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { categoryColors, activityColors } from "@/lib/activity-colors";
import { cn } from "@/lib/cn";
import { ExercisePicker } from "./exercise-picker";

type Block = SessionDraft["blocks"][number];
type Repeat = Extract<SequenceNode, { kind: "repeat" }>;
const labels = m.builder.sequence;
const newRef = () => crypto.randomUUID();
const groupTone = activityColors("cones");
const menuItem =
  "flex min-h-11 cursor-pointer items-center rounded-button px-3 outline-none data-[highlighted]:bg-card-raised";

export type SequenceDestination = { parent: string | null; label: string };

export function SequenceEditor({
  block,
  exercises,
  onChange,
  onEdit,
  onDestination,
}: {
  block: Block;
  exercises: ExerciseSummary[];
  onChange: (block: Block) => void;
  onEdit: (ref: string) => void;
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
  return (
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
      onDestination={onDestination}
    />
  );
}

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
  onDestination?: (destination: SequenceDestination) => void;
};

function Level(props: LevelProps) {
  const { nodes, parent, parentName, depth, block, exercises, byId, edit, apply, onDestination } = props;
  const [picking, setPicking] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const inGroup = parent !== null;
  const pick = (exercise: ExerciseSummary) => {
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
    <div className={cn("min-w-0 space-y-2", depth === 0 ? "p-3" : "p-2")}>
      <ol className="space-y-2">
        {nodes.map((node, index) => {
          const ref = sequenceNodeRef(node);
          return (
            <li key={ref} className="min-w-0">
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
              <NodeCard {...props} node={node} index={index} />
            </li>
          );
        })}
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
        open={picking !== null}
        onOpenChange={(open) => (open ? null : setPicking(null))}
        destination={parentName}
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
  const actions = (
    <div className="ml-auto flex shrink-0 items-center">
      <IconButton label={labels.up} disabled={index === 0} onClick={() => edit(parent, { kind: "move", ref, delta: -1 })}>
        <ArrowUp aria-hidden className="size-4" />
      </IconButton>
      <IconButton
        label={labels.down}
        disabled={index === nodes.length - 1}
        onClick={() => edit(parent, { kind: "move", ref, delta: 1 })}
      >
        <ArrowDown aria-hidden className="size-4" />
      </IconButton>
      <MoreActions {...props} name={name} />
    </div>
  );

  if (node.kind === "recovery")
    return (
      <div className="flex min-w-0 items-center gap-2 px-1 text-soft">
        <Timer aria-hidden className="size-4 shrink-0" />
        <span aria-hidden className="h-px min-w-4 flex-1 border-t border-dashed border-control-line" />
        <label className="flex items-center gap-1 text-sm">
          <span className="sr-only">{labels.recoverySeconds}</span>
          <input
            type="number"
            min={1}
            max={3600}
            value={node.durationS}
            onChange={(e) => edit(parent, { kind: "update", ref, node: { ...node, durationS: Number(e.target.value) } })}
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
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-button bg-card-raised py-1 pl-1.5 pr-1">
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
        className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-2"
        style={{ backgroundColor: groupTone.background, color: groupTone.text }}
      >
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

function MoreActions(props: LevelProps & { node: SequenceNode; name: string }) {
  const { node, name, parent, block, edit, apply } = props;
  const ref = sequenceNodeRef(node);
  const own = node.kind === "repeat" ? descendants(node) : new Set<string>();
  const targets = sequenceGroups(block).filter((group) => group.ref !== parent && group.ref !== ref && !own.has(group.ref));
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
          <DropdownMenu.Item className={menuItem} onSelect={() => edit(parent, { kind: "duplicate", ref })}>
            {labels.duplicate(name)}
          </DropdownMenu.Item>
          {parent !== null || targets.length ? (
            <>
              <DropdownMenu.Label className="t-caption px-3 pt-2 text-soft">{labels.moveTo}</DropdownMenu.Label>
              {parent !== null ? (
                <DropdownMenu.Item className={menuItem} onSelect={() => apply(() => moveSequenceNode(block, ref, null))}>
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
