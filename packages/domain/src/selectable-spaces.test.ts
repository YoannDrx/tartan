import type { SpaceSummary } from "@tartan/contracts";
import { describe, expect, it } from "vitest";
import { selectableSpaces } from "./selectable-spaces";

const club = (id: string, role: SpaceSummary["role"]): SpaceSummary => ({
  organizationId: id,
  organizationName: id,
  role,
  athleteId: null,
});
const personal: SpaceSummary = { ...club("carnet", "athlete"), kind: "personal" };
const coaching = club("club coach", "owner");
const training = club("club athlète", "athlete");

describe("espaces accessibles depuis le bandeau", () => {
  it("intègre le carnet dans la journée de l'athlète invité", () => {
    expect(selectableSpaces([personal, training])).toEqual([training]);
  });
  it("conserve les deux véritables clubs et exclut la démonstration", () => {
    expect(selectableSpaces([personal, training, { ...coaching, isDemo: true }, coaching])).toEqual([
      training,
      coaching,
    ]);
  });
  it("garde un carnet autonome accessible, seul ou à côté du club encadré", () => {
    expect(selectableSpaces([personal])).toEqual([personal]);
    expect(selectableSpaces([coaching, personal])).toEqual([coaching, personal]);
    expect(selectableSpaces([])).toEqual([]);
  });
});
