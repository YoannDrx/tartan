import { describe, expect, it } from "vitest";
import { attachItemKeys, overridesForSubmit } from "@/features/sessions/overrides";

const blocks = (...items: string[][]) => items.map((keys) => ({ items: keys.map((key) => ({ key })) }));
const load = { load: 80 };

describe("adaptations d'un athlète", () => {
  it("déplacer un exercice garde la charge sur le bon exercice", () => {
    const keyed = attachItemKeys(
      [{ athleteId: "a", itemRef: "fente", prescription: load }],
      blocks(["squat", "fente"]),
    );
    expect(keyed).toEqual([{ athleteId: "a", itemKey: "fente", prescription: load }]);
    expect(overridesForSubmit(keyed, blocks(["fente", "squat"]))).toEqual([
      { athleteId: "a", itemRef: "fente", prescription: load },
    ]);
  });
  it("retirer l'exercice retire son adaptation", () => {
    const keyed = [{ athleteId: "a", itemKey: "fente", prescription: load }];
    expect(overridesForSubmit(keyed, blocks(["squat"]))).toEqual([]);
  });
  it("un bloc vide ne décale pas les références", () => {
    const keyed = [{ athleteId: "a", itemKey: "squat", prescription: load }];
    expect(overridesForSubmit(keyed, blocks([], ["squat"]))).toEqual([
      { athleteId: "a", itemRef: "squat", prescription: load },
    ]);
  });
  it("une référence ancienne sans exercice est ignorée", () => {
    expect(attachItemKeys([{ athleteId: "a", itemRef: "b9-i9", prescription: load }], blocks(["squat"]))).toEqual([]);
  });
});

it("préserve les adaptations par occurrence et retire seulement les tours supprimés", () => {
  const blocks = [
    {
      items: [{ key: "a" }],
      sequence: [
        {
          kind: "repeat" as const,
          ref: "g",
          name: "Circuit",
          rounds: 2,
          restBetweenRoundsS: 0,
          children: [{ kind: "exercise" as const, itemRef: "a" }],
        },
      ],
    },
  ];
  const overrides = [{ athleteId: "athlete", itemRef: "seq:a:2", prescription: { reps: 6 } }];
  const attached = attachItemKeys(overrides, blocks);
  expect(overridesForSubmit(attached, blocks)).toEqual(overrides);
  expect(overridesForSubmit(attached, [{ ...blocks[0]!, sequence: [{ kind: "exercise", itemRef: "a" }] }])).toEqual([]);
});
