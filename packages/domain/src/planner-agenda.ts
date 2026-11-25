import type { ExerciseSummary, PlannerProposalResponse, PlannerReviewedDraft } from "@tartan/contracts";
import { isoDate } from "@tartan/contracts";
import { plannerEquipmentAvailable, plannerRequiredEquipment } from "./planner-equipment";
import { addDays } from "./status";

export function plannerTimesOverlap(
  a: string | null | undefined,
  minutesA: number | null | undefined,
  b: string | null,
  minutesB?: number | null,
) {
  if (!a || !b) return false;
  const minuteOfDay = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const first = minuteOfDay(a);
  const second = minuteOfDay(b);
  // Une durée absente permet de vérifier le début connu seulement.
  return first < second + (minutesB ?? 1) && second < first + (minutesA ?? 1);
}

// Le calendrier est relu par le serveur avec les droits de l’espace. Ce résumé reste dans l’interface.
export function plannerAgenda(
  proposal: PlannerProposalResponse,
  drafts: PlannerReviewedDraft[],
  exercises: Pick<ExerciseSummary, "id" | "category" | "classification" | "motionKey">[],
) {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const range = proposal.selection.period;
  let previousJumpDay: string | null = null;
  return Array.from({ length: 1 + (Date.parse(range.to) - Date.parse(range.from)) / 86400000 }, (_, offset) => {
    const date = addDays(range.from, offset);
    const calendar = (proposal.calendar ?? []).filter((row) => row.date === date);
    const sessions = drafts
      .filter((d) => d.date === date)
      .map((d) => {
        const items = d.draft.blocks.flatMap((b) => b.items);
        const equipment = [
          ...new Set(
            items.flatMap((i) => {
              const e = byId.get(i.exerciseId);
              return plannerRequiredEquipment(e?.motionKey, e?.classification?.equipment) ?? [];
            }),
          ),
        ];
        const available = proposal.availableEquipment;
        const jump = items.some(
          (i) =>
            byId.get(i.exerciseId)?.classification?.movement === "jump" || (i.prescription.ground_contacts ?? 0) > 0,
        );
        const consecutiveJumps = jump && (previousJumpDay === date || previousJumpDay === addDays(date, -1));
        if (jump) previousJumpDay = date;
        return {
          consecutiveJumps,
          title: d.draft.title,
          estimated: d.draft.durationMin,
          blocks: d.draft.blocks.map((b) => b.name),
          equipment,
          missingRest: items.some(
            (i) =>
              (i.prescription.setPlan?.length ?? i.prescription.sets ?? 1) > 1 && i.prescription.rest_s === undefined,
          ),
          missingEquipment: available
            ? equipment.filter((e) => !plannerEquipmentAvailable({ movement: null, equipment: [e] }, available))
            : [],
          collision: calendar.some((s) =>
            plannerTimesOverlap(d.startTime, d.draft.durationMin, s.startTime, s.durationMin),
          ),
        };
      });
    return { date, calendar, sessions };
  });
}

export const plannerWeekDays = (from: string) =>
  isoDate.safeParse(from).success ? Array.from({ length: 7 }, (_, i) => addDays(from, i)) : [];
