import type { CoachAlert } from "@tartan/contracts";
import { describe, expect, it } from "vitest";
import { groupAlerts } from "./alerts";

const alert = (athleteId: string, kind: CoachAlert["kind"]): CoachAlert => ({
  id: `${athleteId}-${kind}`,
  kind,
  athleteId,
  athleteName: athleteId,
  title: kind,
  detail: "",
  severity: kind === "pain" ? "high" : "medium",
});

describe("groupAlerts", () => {
  it("fait une ligne par athlète en gardant l'ordre de gravité", () => {
    const groups = groupAlerts([
      alert("lea", "pain"),
      alert("hugo", "active_injury"),
      alert("lea", "abnormal_rpe"),
      alert("hugo", "missed_streak"),
    ]);
    expect(groups.map((g) => g.athleteId)).toEqual(["lea", "hugo"]);
    expect(groups[0]?.main.kind).toBe("pain");
    expect(groups[0]?.others.map((o) => o.kind)).toEqual(["abnormal_rpe"]);
  });

  it("gère une liste vide", () => {
    expect(groupAlerts([])).toEqual([]);
  });
});
