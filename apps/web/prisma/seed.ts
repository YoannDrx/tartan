// Données de démonstration pour les environnements de preview et la revue des stores (§ 14, § 16.1).
// Personnes fictives et majeures, clairement identifiées. En production, seulement pour les comptes de revue
// (docs/fiches-stores.md) : aucune vraie donnée sur ces comptes.
import { randomBytes } from "node:crypto";
import { addDays, startOfWeek } from "@tartan/domain";
import { auth } from "@/lib/auth";
import { todayIso } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { addStrengthTest, saveInjury } from "@/server/athlete.service";
import { logSession } from "@/server/athlete-view.service";
import { setConsent } from "@/server/consent.service";
import { saveExercise } from "@/server/exercise.service";
import { createOrganization } from "@/server/org.service";
import { publishSession, saveScheduledSession } from "@/server/session.service";
import { publishAnnouncement } from "@/server/comm.service";

const PASSWORD = process.env.DEMO_PASSWORD ?? randomBytes(12).toString("base64url");

const signUp = async (email: string, name: string): Promise<string> => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;
  // Adresses fictives : confirmées d'emblée, aucun e-mail ne part vers elles.
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser({ email, name, emailVerified: true }, { method: "email-password" });
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await ctx.password.hash(PASSWORD),
  });
  // Comptes fictifs et majeurs : sans date, la revue buterait sur l'écran de confirmation.
  const birthDate = new Date("1990-05-12T00:00:00Z");
  await prisma.profile.upsert({ where: { id: user.id }, create: { id: user.id, birthDate }, update: { birthDate } });
  return user.id;
};

const main = async () => {
  if (await prisma.user.findUnique({ where: { email: "coach@demo.tartan.coach" } })) {
    console.log("Démonstration déjà en place.");
    return;
  }
  const coachId = await signUp("coach@demo.tartan.coach", "Coach Démo");
  const org = await createOrganization(coachId, {
    name: "Coaching Démo",
    type: "independent",
    disciplines: ["high_jump"],
    firstGroupName: "Hauteur Démo",
  });

  const athletes = [];
  for (const [first, last] of [
    ["Démo", "Un"],
    ["Essai", "Deux"],
    ["Exemple", "Trois"],
  ] as const) {
    const email = `${last.toLowerCase()}@demo.tartan.coach`;
    const userId = await signUp(email, `${first} ${last}`);
    await prisma.organizationMember.create({ data: { organizationId: org.id, userId, role: "athlete" } });
    const athlete = await prisma.athlete.create({
      data: {
        organizationId: org.id,
        userId,
        firstName: first,
        lastName: last,
        birthDate: new Date("2004-05-12T00:00:00Z"),
        takeoffFoot: "left",
        approachSteps: 9,
        groups: { create: { groupId: org.firstGroupId } },
      },
    });
    await setConsent(userId, "terms", true, athlete.id);
    await setConsent(userId, "health", true, athlete.id);
    await setConsent(userId, "video", true, athlete.id);
    await addStrengthTest(coachId, org.id, {
      athleteId: athlete.id,
      exerciseKey: "back_squat",
      value: 100,
      kind: "one_rm",
      date: addDays(todayIso(), -20),
    });
    athletes.push({ userId, id: athlete.id });
  }

  const squat = await saveExercise(coachId, org.id, {
    name: "Squat",
    category: "strength",
    cues: ["Dos droit", "Descente contrôlée"],
    defaultPrescription: { sets: 4, reps: 5, rest_s: 150, load: { type: "pct_1rm", value: 80, test: "back_squat" } },
  });
  const hurdles = await saveExercise(coachId, org.id, {
    name: "Sauts de haies basses",
    category: "plyo",
    cues: ["Pieds actifs", "Bras synchronisés"],
    defaultPrescription: { sets: 5, unit: "haies", count: 6, ground_contacts: 30, rest_s: 120 },
  });
  const lunges = await saveExercise(coachId, org.id, {
    name: "Fentes sautées",
    category: "plyo",
    cues: ["Genou dans l'axe"],
    defaultPrescription: { sets: 3, reps: 10, rest_s: 90 },
  });
  await saveExercise(coachId, org.id, {
    name: "Mobilité des hanches",
    category: "mobility",
    media: {
      kind: "youtube",
      url: "https://youtu.be/dQw4w9WgXcQ",
      customTitle: "Routine hanches",
      startS: 10,
      endS: 70,
    },
  });

  const makeDraft = (title: string, type: "strength" | "plyo" | "jump", withAuto: boolean) => ({
    title,
    type,
    durationMin: 60,
    coachNote: "Reste léger sur les appuis",
    blocks: [
      {
        name: "Corps de séance",
        variant: "club" as const,
        items: [
          {
            exerciseId: squat.id,
            prescription: {
              sets: 4,
              reps: 5,
              rest_s: 150,
              load: { type: "pct_1rm" as const, value: 80, test: "back_squat" },
            },
          },
          {
            exerciseId: hurdles.id,
            prescription: { sets: 5, unit: "haies", count: 6, ground_contacts: 30, rest_s: 120 },
          },
        ],
      },
      ...(withAuto
        ? [
            {
              name: "Sans matériel",
              variant: "autonomous" as const,
              items: [{ exerciseId: lunges.id, prescription: { sets: 3, reps: 10, rest_s: 90 } }],
            },
          ]
        : []),
    ],
  });

  const today = todayIso();
  const monday = startOfWeek(today);
  const plan = [
    { date: monday, title: "Force", type: "strength" as const },
    { date: addDays(monday, 2), title: "Pliométrie", type: "plyo" as const },
    { date: today, title: "Force et pliométrie", type: "plyo" as const },
    { date: addDays(monday, 5), title: "Séance de saut", type: "jump" as const },
  ];
  const seen = new Set<string>();
  const sessions: { id: string; date: string }[] = [];
  for (const entry of plan) {
    if (seen.has(entry.date)) continue;
    seen.add(entry.date);
    const session = await saveScheduledSession(coachId, org.id, {
      date: entry.date,
      startTime: "18:00",
      location: "Stade",
      draft: makeDraft(entry.title, entry.type, true),
      assignments: [{ targetType: "group", targetId: org.firstGroupId }],
      overrides: [],
      publishAt: null,
    });
    await publishSession(coachId, org.id, session.id);
    sessions.push({ id: session.id, date: entry.date });
  }

  const past = sessions.filter((s) => s.date < today);
  const first = athletes[0];
  const second = athletes[1];
  if (first && second) {
    for (const s of past) {
      await logSession(first.userId, org.id, s.id, {
        clientId: `demo-${first.id}-${s.id}`.slice(0, 64),
        status: "done",
        variantDone: "club",
        rpe: 7,
        durationMin: 60,
      });
      await logSession(second.userId, org.id, s.id, {
        clientId: `demo-${second.id}-${s.id}`.slice(0, 64),
        status: "partial",
        variantDone: "autonomous",
        rpe: 9,
        comment: "Séance en autonomie, gêne en fin de séance.",
        pain: { bodyArea: "knee", side: "left", intensity: 4 },
      });
    }
    await saveInjury(coachId, org.id, {
      athleteId: second.id,
      bodyArea: "knee",
      side: "left",
      startDate: addDays(today, -3),
      status: "recovering",
      restrictions: "Pas de bondissements",
    });
  }
  await publishAnnouncement(coachId, org.id, {
    groupId: org.firstGroupId,
    body: "Annonce de démonstration : séance de samedi au stade.",
    pinned: true,
  });
  // La démonstration ne doit jamais clôturer les messages de vrais utilisateurs.
  const demoUsers = [coachId, ...athletes.map((athlete) => athlete.userId)];
  await prisma.$transaction([
    prisma.notificationDelivery.updateMany({
      where: { notification: { userId: { in: demoUsers } }, state: { in: ["pending", "receipt"] } },
      data: { state: "skipped", leaseToken: null, leaseUntil: null, errorCode: "demo_seed" },
    }),
    prisma.notification.updateMany({
      where: { userId: { in: demoUsers }, sentAt: null },
      data: { deliveryInitializedAt: new Date(), deliveryCompletedAt: new Date() },
    }),
  ]);

  console.log(
    `Démonstration prête : coach@demo.tartan.coach, un@demo.tartan.coach (mot de passe : ${process.env.DEMO_PASSWORD ? "DEMO_PASSWORD" : PASSWORD}).`,
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
