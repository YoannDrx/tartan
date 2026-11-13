import { sessionSnapshot } from "@tartan/contracts";
import { addDays } from "@tartan/domain";
import { formatDayMonth } from "@tartan/i18n";
import { fromDbDate, todayIso, toDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireAthleteAccess } from "./access";
import { athleteAssignedWhere } from "./session-audience.service";

export const athleteVideoContext = async (userId: string, organizationId: string) => {
  const access = await requireAthleteAccess(userId, organizationId);
  const today = todayIso();
  const rows = await prisma.scheduledSession.findMany({
    where: {
      ...(await athleteAssignedWhere(access.athleteId)),
      date: { gte: toDbDate(addDays(today, -30)), lte: toDbDate(addDays(today, 7)) },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 100,
    select: { id: true, date: true, snapshot: true },
  });
  return rows.flatMap((row) => {
    const parsed = sessionSnapshot.safeParse(row.snapshot);
    if (!parsed.success) return [];
    const exercises = new Map(
      parsed.data.blocks.flatMap((b) =>
        b.items.flatMap((i) =>
          i.kind !== "recovery" && i.exerciseId ? [[i.exerciseId, { id: i.exerciseId, name: i.name }] as const] : [],
        ),
      ),
    );
    const date = fromDbDate(row.date);
    return [
      {
        id: row.id,
        label: `${formatDayMonth(date)}, ${parsed.data.title}`,
        today: date === today,
        exercises: [...exercises.values()],
      },
    ];
  });
};
