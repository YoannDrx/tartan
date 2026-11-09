// Jeu de données fictif de préparation physique, pour produire les vraies captures de l'app et du site.
// Refusé hors base locale : aucun compte, e-mail ni notification ne part ailleurs.
//   pnpm --filter @tartan/web demo:preparation
process.env.COACH_SIGNUP_MODE = "public";

import { randomUUID } from "node:crypto";
import type { Prescription, SessionDraft, SessionType } from "@tartan/contracts";
import { addDays, startOfWeek } from "@tartan/domain";
import { auth } from "@/lib/auth";
import { todayIso, toDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { syncEntitlements } from "@/server/billing.service";
import { setConsent } from "@/server/consent.service";
import { createOrganization } from "@/server/org.service";
import { publishRow, saveScheduledSession } from "@/server/session.service";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl)) {
  throw new Error("demo-preparation refuse toute base qui n'est pas locale.");
}

const PASSWORD = "capture-locale-tartan";
export const COACH_EMAIL = "coach@capture.tartan.test";
export const ATHLETE_EMAIL = "athlete@capture.tartan.test";

const ATHLETES = [
  ["Léa", "Moreau"],
  ["Tom", "Girard"],
  ["Inès", "Benali"],
  ["Noah", "Petit"],
  ["Camille", "Roux"],
  ["Yanis", "Haddad"],
  ["Hugo", "Lefèvre"],
  ["Manon", "Dubois"],
  ["Sacha", "Lambert"],
  ["Emma", "Faure"],
  ["Lucas", "Martin"],
] as const;

let state = 20261109;
const random = () => {
  state = (state * 1664525 + 1013904223) % 2 ** 32;
  return state / 2 ** 32;
};

const account = async (email: string, firstName: string, lastName: string) => {
  const created = await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: firstName } });
  await prisma.user.update({ where: { id: created.user.id }, data: { emailVerified: true } });
  await prisma.profile.upsert({
    where: { id: created.user.id },
    create: { id: created.user.id, firstName, lastName, birthDate: new Date("1996-04-12T00:00:00Z") },
    update: { firstName, lastName, birthDate: new Date("1996-04-12T00:00:00Z") },
  });
  return created.user.id;
};

const person = async (first: string, last: string) => {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      name: first,
      email: `${first
        .normalize("NFD")
        .replace(/[^A-Za-z]/g, "")
        .toLowerCase()}@capture.tartan.test`,
      emailVerified: true,
      profile: { create: { firstName: first, lastName: last, birthDate: new Date("2003-03-03T00:00:00Z") } },
    },
  });
  return id;
};

const main = async () => {
  const owned = { owner: { email: { endsWith: "@capture.tartan.test" } } };
  await prisma.sessionTemplate.deleteMany({ where: { organization: owned } });
  await prisma.organization.deleteMany({ where: owned });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@capture.tartan.test" } } });
  const coachId = await account(COACH_EMAIL, "Cédric", "Coach");
  const org = await createOrganization(coachId, {
    name: "Prépa physique du stade",
    type: "independent",
    disciplines: ["sprint", "long_jump"],
    firstGroupName: "Groupe prépa",
    firstGroupGoal: "Préparation hivernale",
  });
  const organizationId = org.id;
  await prisma.organization.update({ where: { id: organizationId }, data: { plan: "club" } });
  await syncEntitlements(organizationId, "club");

  const enroll = async (userId: string, firstName: string, lastName: string) => {
    await prisma.organizationMember.create({ data: { organizationId, userId, role: "athlete", status: "active" } });
    const athlete = await prisma.athlete.create({
      data: {
        organizationId,
        userId,
        firstName,
        lastName,
        birthDate: new Date("2003-03-03T00:00:00Z"),
        groups: { create: { groupId: org.firstGroupId, createdAt: new Date("2026-01-05T10:00:00Z") } },
      },
    });
    await setConsent(userId, "terms", true, athlete.id);
    await setConsent(userId, "health", true, athlete.id);
    await setConsent(userId, "video", true, athlete.id);
    return athlete.id;
  };

  const mainAthleteUser = await account(ATHLETE_EMAIL, "Alex", "Bernard");
  const mainAthlete = await enroll(mainAthleteUser, "Alex", "Bernard");
  // La capture du calendrier montre le mois sans toucher à l'écran.
  await prisma.profile.update({
    where: { id: mainAthleteUser },
    data: { calendarView: "month", calendarViewUpdatedAt: new Date() },
  });
  const roster = [mainAthlete];
  for (const [first, last] of ATHLETES) roster.push(await enroll(await person(first, last), first, last));

  const library = await prisma.exercise.findMany({ where: { organizationId }, select: { id: true, name: true } });
  const exercise = (name: string) => {
    const found = library.find((row) => row.name === name);
    if (!found) throw new Error(`Exercice absent : ${name}`);
    return found.id;
  };
  const item = (name: string, prescription: Prescription) => ({ exerciseId: exercise(name), prescription });
  const block = (name: string, items: ReturnType<typeof item>[]) => ({ name, variant: "club" as const, items });

  const sessionsByType: Record<
    string,
    { type: SessionType; title: string; duration: number; note: string; blocks: SessionDraft["blocks"] }
  > = {
    force: {
      type: "strength",
      title: "Force bas du corps",
      duration: 70,
      note: "Descente contrôlée, on pousse fort dans le sol.",
      blocks: [
        block("Échauffement", [item("Mobilité de cheville", { sets: 2, reps: 10, rest_s: 30 })]),
        block("Force", [
          item("Squat arrière", { sets: 4, reps: 5, load: { type: "kg", value: 90 }, rest_s: 180 }),
          item("Soulevé de terre roumain", { sets: 3, reps: 8, load: { type: "kg", value: 70 }, rest_s: 120 }),
          item("Squat bulgare", { sets: 3, reps: 8, load: { type: "kg", value: 16 }, rest_s: 90 }),
        ]),
        block("Gainage", [item("Gainage ventral", { sets: 3, duration_s: 40, rest_s: 45 })]),
      ],
    },
    plyo: {
      type: "plyo",
      title: "Pliométrie, contacts courts",
      duration: 50,
      note: "Qualité avant quantité : on s'arrête dès que les appuis ralentissent.",
      blocks: [
        block("Préparation", [item("Éducatifs de cheville", { sets: 3, distance_m: 20, rest_s: 30 })]),
        block("Pliométrie", [
          item("Sauts de haies basses", { sets: 5, unit: "haies", count: 6, ground_contacts: 30, rest_s: 120 }),
          item("Bonds unipodaux", { sets: 4, unit: "bonds", count: 6, ground_contacts: 24, rest_s: 120 }),
          item("Foulées bondissantes", { sets: 4, distance_m: 30, rest_s: 150 }),
        ]),
      ],
    },
    technique: {
      type: "running",
      title: "Technique de course",
      duration: 60,
      note: "Bassin haut, pied actif sous le corps.",
      blocks: [
        block("Gammes", [
          item("Gammes : montées de genoux", { sets: 3, distance_m: 30, rest_s: 60 }),
          item("Gammes : talons-fesses", { sets: 3, distance_m: 30, rest_s: 60 }),
        ]),
        block("Vitesse", [
          item("Accélérations", { sets: 6, distance_m: 30, rest_s: 120 }),
          item("Sprints départ lancé", { sets: 4, distance_m: 40, rest_s: 240 }),
        ]),
      ],
    },
    plots: {
      type: "cones",
      title: "Appuis sur plots",
      duration: 45,
      note: "Regarde le plot suivant, pas tes pieds.",
      blocks: [
        block("Appuis", [
          item("Slalom entre les plots", { sets: 4, unit: "plots", count: 8, rest_s: 90 }),
          item("Changements d'appuis en carré", { sets: 4, unit: "côtés", count: 4, rest_s: 90 }),
          item("Sprint en T entre plots", { sets: 5, distance_m: 20, rest_s: 120 }),
        ]),
      ],
    },
    escaliers: {
      type: "stairs",
      title: "Escaliers en fréquence",
      duration: 40,
      note: "Pied complet sur la marche.",
      blocks: [
        block("Escaliers", [
          item("Escaliers en fréquence", { sets: 6, unit: "marches", count: 20, rest_s: 120 }),
          item("Bondissements en escaliers", { sets: 4, unit: "marches", count: 12, rest_s: 150 }),
        ]),
      ],
    },
    mobilite: {
      type: "mobility",
      title: "Mobilité et récupération",
      duration: 30,
      note: "Amplitude sans douleur.",
      blocks: [
        block("Mobilité", [
          item("Mobilité des hanches", { sets: 3, reps: 10, rest_s: 30 }),
          item("Rotation thoracique au sol", { sets: 3, reps: 8, rest_s: 30 }),
        ]),
      ],
    },
  };

  // Semaine type, de quatre semaines avant à quatre semaines après : le mois affiché est plein.
  const pattern: [number, keyof typeof sessionsByType][] = [
    [0, "force"],
    [1, "technique"],
    [2, "plyo"],
    [3, "plots"],
    [4, "force"],
    [5, "mobilite"],
  ];
  const today = todayIso();
  const monday = startOfWeek(today);
  const publishedAt = new Date(`${addDays(monday, -35)}T10:00:00Z`);
  for (let week = -4; week <= 4; week++) {
    for (const [offset, key] of pattern) {
      const date = addDays(monday, week * 7 + offset);
      const spec = week === 1 && key === "plots" ? sessionsByType.escaliers! : sessionsByType[key]!;
      const session = await saveScheduledSession(coachId, organizationId, {
        date,
        startTime: "18:30",
        location: spec.type === "strength" ? "Salle de force" : "Stade",
        publishAt: null,
        draft: {
          title: spec.title,
          type: spec.type,
          durationMin: spec.duration,
          coachNote: spec.note,
          blocks: spec.blocks,
        },
        assignments: [{ targetType: "group", targetId: org.firstGroupId }],
        overrides: [],
      });
      await publishRow(session.id, coachId, publishedAt, { silent: true });
      if (date >= today) continue;
      for (const athleteId of roster) {
        const roll = random();
        const status = roll < 0.78 ? "done" : roll < 0.9 ? "partial" : "missed";
        const log = await prisma.sessionLog.create({
          data: {
            scheduledSessionId: session.id,
            athleteId,
            clientId: randomUUID(),
            status,
            variantDone: "club",
            rpe: status === "missed" ? null : 6 + Math.floor(random() * 3),
          },
        });
        if (spec.type === "strength" && status === "done") {
          const load = 85 + week * 1.25 + Math.floor(random() * 3) * 2.5;
          await prisma.setLog.createMany({
            data: Array.from({ length: 4 }, (_, setIndex) => ({
              sessionLogId: log.id,
              itemRef: "b1-i0",
              setIndex,
              reps: 5,
              loadKg: load,
              done: true,
            })),
          });
        }
      }
    }
  }

  // La capture de l'accueil montre toujours une séance du jour, même un jour de repos du cycle.
  const offsetToday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  if (!pattern.some(([offset]) => offset === offsetToday)) {
    const spec = sessionsByType.force!;
    const session = await saveScheduledSession(coachId, organizationId, {
      date: today,
      startTime: "18:30",
      location: "Salle de force",
      publishAt: null,
      draft: {
        title: spec.title,
        type: spec.type,
        durationMin: spec.duration,
        coachNote: spec.note,
        blocks: spec.blocks,
      },
      assignments: [{ targetType: "group", targetId: org.firstGroupId }],
      overrides: [],
    });
    await publishRow(session.id, coachId, publishedAt, { silent: true });
  }

  const phaseStart = addDays(monday, -14);
  await prisma.trainingPhase.create({
    data: {
      organizationId,
      id: randomUUID(),
      creationFingerprint: randomUUID(),
      groupId: org.firstGroupId,
      name: "Charge",
      kind: "development",
      startDate: toDbDate(phaseStart),
      endDate: toDbDate(addDays(phaseStart, 41)),
      objective: "Monter en force avant la saison en salle",
      publishedAt,
      createdBy: coachId,
    },
  });

  await prisma.strengthTest.create({
    data: {
      organizationId,
      athleteId: mainAthlete,
      exerciseId: exercise("Squat arrière"),
      exerciseKey: "back_squat",
      kind: "one_rm",
      value: 120,
      date: toDbDate(addDays(monday, -21)),
    },
  });

  const sessionForVideo = await prisma.scheduledSession.findFirstOrThrow({
    where: { organizationId, title: "Technique de course", date: { lt: toDbDate(today) } },
    orderBy: { date: "desc" },
  });
  await prisma.video.create({
    data: {
      organizationId,
      athleteId: mainAthlete,
      uploadedBy: coachId,
      scheduledSessionId: sessionForVideo.id,
      exerciseId: exercise("Accélérations"),
      status: "ready",
      fps: 120,
      durationMs: 12000,
      recordedAt: sessionForVideo.date,
      sharedWithAthlete: true,
      annotations: {
        create: [
          { authorId: coachId, tMs: 1800, text: "Bien : le genou monte sans casser le bassin." },
          { authorId: coachId, tMs: 4200, text: "Pied actif : pose-le sous le corps, pas devant." },
        ],
      },
    },
  });
  console.log(`Prêt : ${COACH_EMAIL} et ${ATHLETE_EMAIL}.`);
  await prisma.$disconnect();
};

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
