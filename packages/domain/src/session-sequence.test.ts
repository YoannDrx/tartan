import { describe, expect, it } from "vitest";
import { sessionDraft, sessionSequence, type SessionDraft, type SessionSnapshot } from "@tartan/contracts";
import { copyDraftWithNewRefs } from "./session-identity";
import { expandSessionSnapshot, validExecutionBudget, validSessionStructure } from "./session-sequence";
import { freezePrescription } from "./prescription-snapshot";

const draft = (): SessionDraft => ({
  structureVersion: 2,
  title: "Superset",
  type: "strength",
  durationMin: 30,
  coachNote: null,
  blocks: [
    {
      ref: "block",
      name: "Force",
      variant: "both",
      items: [
        {
          ref: "a",
          exerciseId: "00000000-0000-4000-8000-000000000001",
          prescription: { sets: 2, reps: 5, rest_s: 30, load: { type: "kg", value: 40 } },
        },
        { ref: "b", exerciseId: "00000000-0000-4000-8000-000000000002", prescription: { sets: 1, reps: 8 } },
      ],
      sequence: [
        {
          kind: "repeat",
          ref: "circuit",
          name: "Circuit",
          rounds: 3,
          restBetweenRoundsS: 90,
          children: [
            { kind: "exercise", itemRef: "a" },
            { kind: "recovery", ref: "pause", durationS: 10 },
            { kind: "exercise", itemRef: "b" },
          ],
        },
      ],
    },
  ],
});
const expand = (d = draft()) =>
  expandSessionSnapshot(
    d,
    {
      ...d,
      blocks: d.blocks.map((block) => ({
        ...block,
        ref: block.ref!,
        items: block.items.map((item) => ({
          ...item,
          ref: item.ref!,
          name: item.ref!,
          category: "strength" as const,
          cues: [],
          media: null,
        })),
      })),
    },
    "Récupération",
  );

describe("séquences de séance", () => {
  it("exécute A/B à chaque tour, sans récupération implicite après le dernier tour", () => {
    const items = expand().blocks[0]!.items;
    expect(items.map((item) => item.sourceRef)).toEqual([
      "a",
      "pause",
      "b",
      "circuit",
      "a",
      "pause",
      "b",
      "circuit",
      "a",
      "pause",
      "b",
    ]);
    expect(items.filter((item) => item.kind === "recovery").map((item) => item.prescription.duration_s)).toEqual([
      10, 90, 10, 90, 10,
    ]);
    expect(items.filter((item) => item.sourceRef === "a").map((item) => item.prescription.sets)).toEqual([2, 2, 2]);
    expect(items.at(-1)?.restAfterLastSetS).toBe(0);
    expect(new Set(items.map((item) => item.ref)).size).toBe(items.length);
    expect(items.every((item) => item.ref.length <= 100)).toBe(true);
  });

  it("conserve les références d'occurrences après déplacement dans le circuit", () => {
    const d = draft();
    const before = expand(d)
      .blocks[0]!.items.filter((i) => i.sourceRef === "a")
      .map((i) => i.ref);
    const circuit = d.blocks[0]!.sequence![0]!;
    if (circuit.kind !== "repeat") throw new Error();
    circuit.children.reverse();
    expect(
      expand(d)
        .blocks[0]!.items.filter((i) => i.sourceRef === "a")
        .map((i) => i.ref),
    ).toEqual(before);
  });

  it("accepte deux niveaux et refuse le troisième avant expansion", () => {
    const d = draft();
    const circuit = d.blocks[0]!.sequence![0]!;
    d.blocks[0]!.sequence = sessionSequence.parse([
      { kind: "repeat", ref: "outer", name: "Série", rounds: 2, restBetweenRoundsS: 0, children: [circuit] },
    ]);
    expect(validSessionStructure(d)).toBe(true);
    expect(expand(d).blocks[0]!.items.filter((i) => i.sourceRef === "a")).toHaveLength(6);
    const third = {
      ...d,
      blocks: [
        {
          ...d.blocks[0],
          sequence: [
            {
              kind: "repeat",
              ref: "third",
              name: "Trop",
              rounds: 2,
              restBetweenRoundsS: 0,
              children: d.blocks[0]!.sequence,
            },
          ],
        },
      ],
    };
    expect(sessionDraft.safeParse(third).success).toBe(false);
  });

  it("refuse les références absentes, dupliquées, orphelines et les répétitions trop volumineuses", () => {
    for (const mutate of [
      (d: SessionDraft) => {
        d.structureVersion = undefined;
      },
      (d: SessionDraft) => {
        d.blocks[0]!.sequence = undefined;
      },
      (d: SessionDraft) => {
        d.blocks[0]!.items[0]!.ref = "b";
      },
      (d: SessionDraft) => {
        d.blocks[0]!.sequence = [{ kind: "exercise", itemRef: "absent" }];
      },
      (d: SessionDraft) => {
        d.blocks[0]!.sequence = [
          { kind: "exercise", itemRef: "a" },
          { kind: "exercise", itemRef: "a" },
        ];
      },
      (d: SessionDraft) => {
        d.blocks[0]!.items[0]!.prescription.sets = 50;
        const n = d.blocks[0]!.sequence![0]!;
        if (n.kind === "repeat") n.rounds = 50;
      },
    ]) {
      const d = draft();
      mutate(d);
      expect(validSessionStructure(d)).toBe(false);
      expect(() => expand(d)).toThrow();
    }
  });

  it("copie les identités et leurs liens ensemble, sans modifier la source", () => {
    const source = draft();
    let i = 0;
    const copied = copyDraftWithNewRefs(source, () => `new-${++i}`);
    expect(validSessionStructure(copied)).toBe(true);
    expect(expand(copied).blocks[0]!.items.map((item) => item.ref)).not.toEqual(
      expand(source).blocks[0]!.items.map((item) => item.ref),
    );
    expect(source).toEqual(draft());
  });

  it("applique l'adaptation à chaque tour et garde la charge historique", () => {
    const source = expand();
    const overrides = [{ itemRef: "a", prescription: { reps: 6, sets: 3 } }];
    const frozen = freezePrescription(source, [], overrides);
    expect(
      frozen.blocks[0]!.items.filter((i) => i.sourceRef === "a").every(
        (i) => i.prescription.reps === 6 && i.prescription.sets === 3 && i.resolvedLoadKg === 40,
      ),
    ).toBe(true);
    const changedHistory: SessionSnapshot = structuredClone(frozen);
    for (const item of changedHistory.blocks[0]!.items) if (item.sourceRef === "a") item.resolvedLoadKg = 35;
    expect(freezePrescription(source, [], overrides, changedHistory).blocks[0]!.items[0]?.resolvedLoadKg).toBe(35);
    expect(validExecutionBudget(source, [{ itemRef: "a", prescription: { sets: 500 } }])).toBe(false);
  });

  it("laisse une ancienne copie absolument inchangée", () => {
    const d = draft();
    delete d.structureVersion;
    delete d.blocks[0]!.sequence;
    const snapshot: SessionSnapshot = { title: d.title, type: d.type, coachNote: null, durationMin: 30, blocks: [] };
    expect(expandSessionSnapshot(d, snapshot, "Récupération")).toBe(snapshot);
    // Brouillons historiques internes sans bloc : aucune nouvelle contrainte rétroactive.
    expect(validSessionStructure({ ...d, blocks: [] })).toBe(true);
  });

  it("préserve la charge lors du passage d'une ancienne séance à une séquence", () => {
    const next = expand();
    const old: SessionSnapshot = {
      ...next,
      structureVersion: undefined,
      blocks: [
        {
          ...next.blocks[0]!,
          items: [{ ...next.blocks[0]!.items[0]!, ref: "a", sourceRef: undefined, resolvedLoadKg: 32.5 }],
        },
      ],
    };
    const frozen = freezePrescription(next, [], [], old);
    expect(frozen.blocks[0]!.items.filter((item) => item.sourceRef === "a").map((item) => item.resolvedLoadKg)).toEqual(
      [32.5, 32.5, 32.5],
    );
  });
});
