"use client";

import type { ExerciseSummary, SequenceNode, SessionDraft } from "@tartan/contracts";
import {
  editSessionSequence,
  formatPrescription,
  sequenceDepth,
  sequenceNodeRef,
  type SequenceEdit,
} from "@tartan/domain";
import { sequenceRoles } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import { ArrowDown, ArrowUp, Copy, Layers, Plus, Repeat2, Timer, Trash2, Ungroup } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ActivityPicto } from "@/components/pictos";

type Block = SessionDraft["blocks"][number];
const labels = m.builder.sequence;
const newRef = () => crypto.randomUUID();

export function SequenceEditor({
  block,
  exercises,
  onChange,
  onEdit,
}: {
  block: Block;
  exercises: ExerciseSummary[];
  onChange: (block: Block) => void;
  onEdit: (ref: string) => void;
}) {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const edit = (parent: string | null, command: SequenceEdit) =>
    onChange(editSessionSequence(block, parent, command, newRef));
  const nodes = block.sequence ?? block.items.map((item) => ({ kind: "exercise" as const, itemRef: item.ref! }));
  return (
    <Level
      nodes={nodes}
      parent={null}
      depth={0}
      block={block}
      exercises={exercises}
      byId={byId}
      edit={edit}
      onEdit={onEdit}
    />
  );
}

function Level({
  nodes,
  parent,
  depth,
  block,
  exercises,
  byId,
  edit,
  onEdit,
}: {
  nodes: SequenceNode[];
  parent: string | null;
  depth: number;
  block: Block;
  exercises: ExerciseSummary[];
  byId: Map<string, ExerciseSummary>;
  edit: (parent: string | null, command: SequenceEdit) => void;
  onEdit: (ref: string) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const items = new Map(block.items.map((item) => [item.ref, item]));
  const append = (node: SequenceNode) => edit(parent, { kind: "append", node });
  return (
    <div className="min-w-0 space-y-2 p-2">
      <ol className="space-y-2">
        {nodes.map((node, index) => {
          const ref = sequenceNodeRef(node);
          const item = node.kind === "exercise" ? items.get(node.itemRef) : undefined;
          const exercise = item ? byId.get(item.exerciseId) : undefined;
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
          const tone = sequenceRoles[role];
          const name =
            node.kind === "repeat"
              ? node.name
              : node.kind === "recovery"
                ? m.builder.sequenceRecovery
                : (exercise?.name ?? labels.deletedExercise);
          return (
            <li key={ref} className="min-w-0 overflow-hidden rounded-button border border-control-line">
              <div
                className="flex min-w-0 flex-wrap items-center gap-1 p-2"
                style={{ backgroundColor: `var(--activity-${tone}-bg)`, color: `var(--activity-${tone}-text)` }}
              >
                {node.kind === "exercise" && item ? (
                  <button
                    type="button"
                    className="flex min-h-11 w-full min-w-0 items-center gap-2 text-left tablet:flex-1"
                    onClick={() => onEdit(item.ref!)}
                  >
                    <ActivityPicto kind={exercise?.category ?? "strength"} className="size-5 shrink-0" />
                    <span className="min-w-0 break-words">
                      <span className="block font-semibold">{name}</span>
                      <span className="t-caption block font-normal">
                        {formatPrescription(item.prescription) || m.builder.setPrescription}
                      </span>
                    </span>
                  </button>
                ) : (
                  <span className="flex min-h-11 w-full min-w-0 items-center gap-2 font-semibold tablet:flex-1">
                    {node.kind === "repeat" ? (
                      <Repeat2 aria-hidden className="size-5 shrink-0" />
                    ) : (
                      <Timer aria-hidden className="size-5 shrink-0" />
                    )}
                    <span className="break-words">{name}</span>
                  </span>
                )}
                <div className="ml-auto flex flex-wrap items-center">
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
                  <IconButton label={labels.duplicate(name)} onClick={() => edit(parent, { kind: "duplicate", ref })}>
                    <Copy aria-hidden className="size-4" />
                  </IconButton>
                  {node.kind === "repeat" ? (
                    <IconButton label={labels.ungroup} onClick={() => edit(parent, { kind: "unwrap", ref })}>
                      <Ungroup aria-hidden className="size-4" />
                    </IconButton>
                  ) : null}
                  <IconButton label={labels.remove(name)} onClick={() => edit(parent, { kind: "remove", ref })}>
                    <Trash2 aria-hidden className="size-4" />
                  </IconButton>
                </div>
              </div>
              {node.kind === "recovery" ? (
                <div className="p-2">
                  <Field label={labels.recoverySeconds}>
                    {(a) => (
                      <Input
                        {...a}
                        type="number"
                        min={1}
                        max={3600}
                        value={node.durationS}
                        onChange={(e) =>
                          edit(parent, { kind: "update", ref, node: { ...node, durationS: Number(e.target.value) } })
                        }
                      />
                    )}
                  </Field>
                </div>
              ) : null}
              {node.kind === "repeat" ? (
                <>
                  <div className="grid grid-cols-2 gap-2 p-2">
                    <Field label={labels.groupName} className="col-span-2">
                      {(a) => (
                        <Input
                          {...a}
                          value={node.name}
                          maxLength={80}
                          onChange={(e) =>
                            edit(parent, { kind: "update", ref, node: { ...node, name: e.target.value } })
                          }
                        />
                      )}
                    </Field>
                    <Field label={labels.rounds}>
                      {(a) => (
                        <Input
                          {...a}
                          type="number"
                          min={2}
                          max={50}
                          value={node.rounds}
                          onChange={(e) =>
                            edit(parent, { kind: "update", ref, node: { ...node, rounds: Number(e.target.value) } })
                          }
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
                            edit(parent, {
                              kind: "update",
                              ref,
                              node: { ...node, restBetweenRoundsS: Number(e.target.value) },
                            })
                          }
                        />
                      )}
                    </Field>
                  </div>
                  <p className="px-2 text-sm text-soft">{labels.noFinalRest}</p>
                  <Level
                    nodes={node.children}
                    parent={node.ref}
                    depth={depth + 1}
                    block={block}
                    exercises={exercises}
                    byId={byId}
                    edit={edit}
                    onEdit={onEdit}
                  />
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="quiet" onClick={() => setChoosing(!choosing)}>
          <Plus aria-hidden className="size-4" />
          {labels.addExercise}
        </Button>
        <Button size="sm" variant="quiet" onClick={() => append({ kind: "recovery", ref: newRef(), durationS: 60 })}>
          <Timer aria-hidden className="size-4" />
          {m.builder.sequenceRecovery}
        </Button>
        {depth < 2 ? (
          <Button
            size="sm"
            variant="quiet"
            onClick={() =>
              append({
                kind: "repeat",
                ref: newRef(),
                name: labels.groupDefault,
                rounds: 3,
                restBetweenRoundsS: 0,
                children: [],
              })
            }
          >
            <Repeat2 aria-hidden className="size-4" />
            {labels.addGroup}
          </Button>
        ) : null}
        {nodes.length > 0 && depth + sequenceDepth(nodes) < 2 ? (
          <Button
            size="sm"
            variant="quiet"
            onClick={() => edit(parent, { kind: "repeatAll", ref: newRef(), name: labels.groupDefault })}
          >
            <Layers aria-hidden className="size-4" />
            {labels.groupAll}
          </Button>
        ) : null}
      </div>
      {choosing ? (
        <Field label={labels.chooseExercise}>
          {(a) => (
            <Select
              {...a}
              value=""
              onChange={(e) => {
                const exercise = byId.get(e.target.value);
                if (!exercise) return;
                const ref = newRef();
                edit(parent, {
                  kind: "append",
                  node: { kind: "exercise", itemRef: ref },
                  item: { ref, exerciseId: exercise.id, prescription: exercise.defaultPrescription },
                });
                setChoosing(false);
              }}
            >
              <option value="">{labels.choose}</option>
              {exercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
    </div>
  );
}
