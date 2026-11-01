import { sessionSnapshot, attendanceStatus, cellStatus, sessionType, sessionVariant } from "@tartan/contracts";
import { z } from "zod";

// L'API client type ces deux réponses en « any » : on les valide ici pour garder un code typé.
export const coachSessionDetail = z.object({
  id: z.string(),
  title: z.string(),
  type: sessionType,
  date: z.string(),
  startTime: z.string().nullable(),
  location: z.string().nullable(),
  publishedAt: z.string().nullable(),
  hasAutonomous: z.boolean(),
  canEdit: z.boolean(),
  snapshot: sessionSnapshot.nullable(),
  athletes: z.array(
    z.object({
      athleteId: z.string(),
      name: z.string(),
      status: cellStatus,
      attendance: attendanceStatus,
      variant: sessionVariant.nullable(),
      rpe: z.number().nullable(),
      durationMin: z.number().nullable(),
      comment: z.string().nullable(),
      pain: z.object({ bodyArea: z.string(), side: z.string(), intensity: z.number() }).nullable(),
      sets: z.array(
        z.object({
          itemRef: z.string(),
          setIndex: z.number(),
          reps: z.number().nullable(),
          loadKg: z.number().nullable(),
          done: z.boolean(),
        }),
      ),
    }),
  ),
});
export type CoachSessionDetail = z.infer<typeof coachSessionDetail>;

export const athleteFile = z.object({
  id: z.string(),
  firstName: z.string(),
  tests: z.array(z.object({ exerciseKey: z.string(), value: z.number(), kind: z.string(), date: z.string() })),
  performances: z.array(
    z.object({
      discipline: z.string(),
      mark: z.number(),
      unit: z.string(),
      date: z.string(),
      location: z.string().nullable(),
      isPb: z.boolean(),
    }),
  ),
});
export type AthleteFile = z.infer<typeof athleteFile>;

// Charge par semaine : route `/athletes/:id/stats`, que l'API client type en « any ».
export const athleteStats = z.object({
  weeks: z.array(
    z.object({ weekStart: z.string(), load: z.number().nullable(), sessions: z.number(), done: z.number() }),
  ),
  loadTrendPct: z.number().nullable(),
  healthVisible: z.boolean(),
});
export type AthleteStats = z.infer<typeof athleteStats>;

// Fiche vue par le staff : même forme que `getAthleteFile` côté serveur. Les notes privées restent sur le web.
export const coachAthleteFile = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  birthDate: z.string().nullable(),
  hasAccount: z.boolean(),
  groups: z.array(z.object({ id: z.string(), name: z.string() })),
  level: z.string().nullable(),
  takeoffFoot: z.enum(["left", "right", "both", "none"]).nullable(),
  approachSteps: z.number().nullable(),
  goals: z.string().nullable(),
  particularities: z.string().nullable(),
  tests: z.array(
    z.object({ id: z.string(), exerciseKey: z.string(), value: z.number(), kind: z.string(), date: z.string() }),
  ),
  performances: z.array(
    z.object({
      id: z.string(),
      discipline: z.string(),
      mark: z.number(),
      unit: z.string(),
      date: z.string(),
      location: z.string().nullable(),
      isPb: z.boolean(),
    }),
  ),
  healthVisible: z.boolean(),
  injuries: z.array(
    z.object({
      id: z.string(),
      bodyArea: z.string(),
      side: z.enum(["left", "right", "both", "none"]),
      startDate: z.string(),
      endDate: z.string().nullable(),
      status: z.enum(["active", "recovering", "resolved"]),
      restrictions: z.string().nullable(),
    }),
  ),
  history: z.array(
    z.object({ id: z.string(), status: z.string(), sessionId: z.string(), title: z.string(), date: z.string() }),
  ),
});
export type CoachAthleteFile = z.infer<typeof coachAthleteFile>;
