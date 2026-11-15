import { expect, it } from "vitest";
import type { SessionDraft } from "@tartan/contracts";
import { autonomousRef, withAutonomousReplacements } from "./autonomous-replacements";
import { validSessionStructure } from "./session-sequence";
import { hasUniqueSessionRefs } from "./session-identity";
import { moveSequenceNode } from "./session-sequence-edit";
import { blocksForVariant } from "./variants";

const squat = "00000000-0000-4000-8000-000000000001";
const goblet = "00000000-0000-4000-8000-000000000002";
const jump = "00000000-0000-4000-8000-000000000003";

const draft = (): SessionDraft => ({
  structureVersion: 2,
  title: "Force",
  type: "strength",
  durationMin: 60,
  coachNote: null,
  blocks: [
    {
      ref: "warmup",
      name: "Échauffement",
      variant: "both",
      items: [{ ref: "skip", exerciseId: jump, prescription: { sets: 2 } }],
      sequence: [{ kind: "exercise", itemRef: "skip" }],
    },
    {
      ref: "main",
      name: "Corps de séance",
      variant: "both",
      items: [
        {
          ref: "squat",
          exerciseId: squat,
          prescription: { sets: 1, reps: 5, load: { type: "kg", value: 80 } },
          autonomous: { exerciseId: goblet, prescription: { sets: 1, reps: 10, load: { type: "kg", value: 24 } } },
        },
        { ref: "jump", exerciseId: jump, prescription: { sets: 1, reps: 5 } },
      ],
      sequence: [
        {
          kind: "repeat",
          ref: "circuit",
          name: "Superset",
          rounds: 3,
          restBetweenRoundsS: 90,
          children: [
            { kind: "exercise", itemRef: "squat" },
            { kind: "recovery", ref: "pause", durationS: 20 },
            { kind: "exercise", itemRef: "jump" },
          ],
        },
      ],
    },
  ],
});

it("dédouble le bloc commun qui remplace un exercice en autonomie, sans toucher aux autres", () => {
  const out = withAutonomousReplacements(draft());
  expect(out.blocks.map((b) => [b.ref, b.variant])).toEqual([
    ["warmup", "both"],
    ["main", "club"],
    [autonomousRef("main"), "autonomous"],
  ]);
  const club = blocksForVariant(out.blocks, "club");
  const away = blocksForVariant(out.blocks, "autonomous");
  expect(club.flatMap((b) => b.items.map((i) => i.exerciseId))).toEqual([jump, squat, jump]);
  expect(away.flatMap((b) => b.items.map((i) => i.exerciseId))).toEqual([jump, goblet, jump]);
  expect(away[1]!.items[0]!.prescription.reps).toBe(10);
  // Le circuit garde sa forme ; chaque élément de la copie a sa propre référence.
  const circuit = away[1]!.sequence![0]!;
  expect(circuit).toMatchObject({ kind: "repeat", ref: "circuit-auto", rounds: 3, restBetweenRoundsS: 90 });
  expect(hasUniqueSessionRefs(out)).toBe(true);
  expect(validSessionStructure(out)).toBe(true);
  expect(out.blocks.flatMap((b) => b.items).some((i) => "autonomous" in i)).toBe(false);
});

it("laisse une séance sans remplacement telle quelle, et ignore un remplacement hors d'un bloc commun", () => {
  const plain = draft();
  delete plain.blocks[1]!.items[0]!.autonomous;
  expect(withAutonomousReplacements(plain)).toEqual(plain);
  const clubOnly = draft();
  clubOnly.blocks[1]!.variant = "club";
  const out = withAutonomousReplacements(clubOnly);
  expect(out.blocks).toHaveLength(2);
  expect(out.blocks[1]!.items[0]).not.toHaveProperty("autonomous");
});

it("borne la référence de la copie à 64 signes", () => {
  expect(autonomousRef("a".repeat(64))).toHaveLength(64);
  expect(autonomousRef("squat")).toBe("squat-auto");
});

it("le remplacement entre dans un groupe à une série par tour, comme l'exercice qu'il remplace", () => {
  const source = draft();
  const block = {
    ...source.blocks[1]!,
    sequence: [{ kind: "exercise" as const, itemRef: "squat" }, source.blocks[1]!.sequence![0]!],
  };
  block.sequence[1] = {
    ...block.sequence[1]!,
    children: [{ kind: "exercise", itemRef: "jump" }],
  } as (typeof block.sequence)[1];
  block.items[0] = {
    ...block.items[0]!,
    prescription: { sets: 4, reps: 5, rest_s: 120 },
    autonomous: { exerciseId: goblet, prescription: { sets: 3, reps: 10, rest_s: 90 } },
  };
  const moved = moveSequenceNode(block, "squat", "circuit");
  expect(moved.items[0]!.prescription).toEqual({ sets: 1, reps: 5 });
  expect(moved.items[0]!.autonomous!.prescription).toEqual({ sets: 1, reps: 10 });
});
