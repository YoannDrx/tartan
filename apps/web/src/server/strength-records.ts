import { detailedSetInput, type StrengthRecordValue } from "@tartan/contracts";
import { createStrengthRecordAccumulator } from "@tartan/domain";
import type { Prisma } from "@/generated/prisma/client";
import { fromDbDate } from "@/lib/dates";

// Interne : appel après contrôle espace/athlète/flag, dans une transaction cohérente.
// On ne sélectionne ni le snapshot complet, ni les notes, ni le feedback santé.
export async function loadStrengthRecords(
  tx: Prisma.TransactionClient,
  organizationId: string,
  athleteId: string,
  exerciseIds: readonly string[],
): Promise<StrengthRecordValue[]> {
  if (!exerciseIds.length) return [];
  type Row = {
    id: string;
    exerciseId: string;
    exerciseName: string;
    convention: string | null;
    sessionId: string;
    logId: string;
    date: Date;
    startTime: string | null;
    createdAt: Date;
    itemRef: string;
    setIndex: number;
    reps: number | null;
    loadKg: number | null;
    repetitionScope: string;
    sideCount: number;
  };
  const accumulator = createStrengthRecordAccumulator();
  let cursor: string | null = null;
  for (;;) {
    const rows: Row[] = await tx.$queryRaw<Row[]>`
      SELECT s.id, s.exercise_id AS "exerciseId", i.item->>'name' AS "exerciseName",
        i.item->>'strengthLoadKind' AS convention,
        ss.id AS "sessionId", l.id AS "logId", ss.date, ss.start_time AS "startTime", l.created_at AS "createdAt",
        s.item_ref AS "itemRef", s.set_index AS "setIndex", s.reps, s.load_kg::float8 AS "loadKg",
        s.repetition_scope AS "repetitionScope", s.side_count AS "sideCount"
      FROM set_logs s
      JOIN session_logs l ON l.id = s.session_log_id
      JOIN scheduled_sessions ss ON ss.id = l.scheduled_session_id
      JOIN LATERAL (
        SELECT item FROM jsonb_path_query(l.prescription_snapshot, '$.blocks[*].items[*]') AS item
        WHERE item->>'ref' = s.item_ref AND item->>'exerciseId' = s.exercise_id::text
        LIMIT 1
      ) i ON true
      WHERE l.athlete_id = ${athleteId}::uuid AND ss.organization_id = ${organizationId}::uuid
        AND s.exercise_id::text IN (SELECT jsonb_array_elements_text(${JSON.stringify(exerciseIds)}::jsonb))
        AND l.status IN ('done', 'partial') AND s.done AND s.set_kind = 'work' AND s.load_kind = 'external'
        AND s.reps > 0 AND s.load_kg >= 0
        AND i.item->>'strengthLoadKind' IN ('external_total', 'added_weight')
        AND (${cursor}::uuid IS NULL OR s.id > ${cursor}::uuid)
      ORDER BY s.id LIMIT 500
    `;
    for (const row of rows) {
      const parsed = detailedSetInput.safeParse({ ...row, done: true, setKind: "work", loadKind: "external" });
      if (!parsed.success || !row.exerciseName) continue;
      const date = fromDbDate(row.date);
      accumulator.add({
        ...row,
        date,
        set: parsed.data,
        order: `${date}/${row.startTime ?? "99:99"}/${row.createdAt.toISOString()}/${row.logId}`,
      });
    }
    if (rows.length < 500) break;
    cursor = rows.at(-1)!.id;
  }
  return accumulator.values();
}
