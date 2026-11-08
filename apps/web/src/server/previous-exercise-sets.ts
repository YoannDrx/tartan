import {
  previousExerciseSets,
  detailedSetInput,
  type PreviousExerciseSets,
  type SessionSnapshot,
} from "@tartan/contracts";
import { setComparisonKey } from "@tartan/domain";
import { prisma } from "@/lib/prisma";
import { fromDbDate } from "@/lib/dates";

// Adaptateur interne à readAthleteSession, appelé après ses contrôles d'accès et uniquement avec le flag actif.
// Le classement SQL évite de charger tout l'historique en mémoire ou de masquer une ancienne réalisation
// comparable derrière un nombre arbitraire de séances récentes. Aucun champ santé ou note n'est sélectionné.
export async function loadPreviousExerciseSets(input: {
  organizationId: string;
  athleteId: string;
  sessionId: string;
  date: Date;
  startTime: string | null;
  items: SessionSnapshot["blocks"][number]["items"];
}): Promise<PreviousExerciseSets[]> {
  const wanted = [
    ...new Map(
      input.items
        .filter((item) => item.exerciseId)
        .map((item) => {
          const row = { exerciseId: item.exerciseId, convention: item.strengthLoadKind ?? null };
          return [JSON.stringify(row), row];
        }),
    ).values(),
  ];
  if (!wanted.length) return [];
  type Row = {
    exerciseId: string;
    convention: string | null;
    date: Date;
    startTime: string | null;
    sessionId: string;
    itemRef: string;
    setIndex: number;
    reps: number | null;
    loadKg: number | null;
    distanceM: number | null;
    timeS: number | null;
    groundContacts: number | null;
    loadKind: string;
    repetitionScope: string;
    sideCount: number;
    totalSets: number;
  };
  const rows = await prisma.$queryRaw<Row[]>`
    WITH wanted AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(wanted)}::jsonb) AS w("exerciseId" text, convention text)
    ), candidates AS (
      SELECT s.exercise_id AS "exerciseId", w.convention, ss.date, ss.start_time AS "startTime",
        ss.id AS "sessionId", s.item_ref AS "itemRef", s.set_index AS "setIndex", s.reps,
        s.load_kg::float8 AS "loadKg", s.distance_m::float8 AS "distanceM", s.time_s::float8 AS "timeS",
        s.ground_contacts AS "groundContacts", s.load_kind AS "loadKind",
        s.repetition_scope AS "repetitionScope", s.side_count AS "sideCount",
        DENSE_RANK() OVER (
          PARTITION BY s.exercise_id, w.convention, s.load_kind, s.repetition_scope, s.side_count
          ORDER BY ss.date DESC, ss.start_time DESC NULLS LAST, l.created_at DESC, l.id DESC
        ) AS rank
      FROM set_logs s
      JOIN session_logs l ON l.id = s.session_log_id
      JOIN scheduled_sessions ss ON ss.id = l.scheduled_session_id
      JOIN wanted w ON s.exercise_id::text = w."exerciseId"
      WHERE l.athlete_id = ${input.athleteId}::uuid AND ss.organization_id = ${input.organizationId}::uuid
        AND ss.id <> ${input.sessionId}::uuid AND l.status IN ('done', 'partial')
        AND (ss.date < ${input.date}::date OR (
          ss.date = ${input.date}::date AND ${input.startTime}::text IS NOT NULL
          AND ss.start_time IS NOT NULL AND ss.start_time < ${input.startTime}::text
        ))
        AND s.done AND s.set_kind = 'work'
        AND s.load_kind IN ('external', 'bodyweight', 'assisted')
        AND s.repetition_scope IN ('total', 'per_side') AND s.side_count IN (1, 2)
        AND (s.repetition_scope <> 'total' OR s.side_count = 1)
        AND EXISTS (
          SELECT 1 FROM jsonb_path_query(l.prescription_snapshot, '$.blocks[*].items[*]') AS frozen(item)
          WHERE frozen.item->>'ref' = s.item_ref AND frozen.item->>'exerciseId' = w."exerciseId"
            AND (frozen.item->>'strengthLoadKind') IS NOT DISTINCT FROM w.convention
        )
    ), latest AS (
      SELECT *,
        (COUNT(*) OVER (PARTITION BY "exerciseId", convention, "loadKind", "repetitionScope", "sideCount"))::int AS "totalSets",
        ROW_NUMBER() OVER (
          PARTITION BY "exerciseId", convention, "loadKind", "repetitionScope", "sideCount"
          ORDER BY "itemRef", "setIndex"
        ) AS "setRank"
      FROM candidates WHERE rank = 1
    )
    SELECT * FROM latest WHERE "setRank" <= 12 ORDER BY date DESC, "sessionId", "itemRef", "setIndex"
  `;
  const groups = new Map<string, PreviousExerciseSets>();
  for (const row of rows) {
    const set = detailedSetInput.safeParse({ ...row, done: true, setKind: "work" });
    if (!set.success) continue;
    const key = JSON.stringify([row.exerciseId, setComparisonKey(set.data, row.convention)]);
    const group =
      groups.get(key) ??
      previousExerciseSets.parse({
        exerciseId: row.exerciseId,
        convention: row.convention,
        date: fromDbDate(row.date),
        startTime: row.startTime,
        sessionId: row.sessionId,
        totalSets: row.totalSets,
        sets: [],
      });
    group.sets.push(set.data);
    groups.set(key, group);
  }
  return [...groups.values()];
}
