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
import { publishAnnouncement } from "@/server/comm.service";
import { createOrganization } from "@/server/org.service";
import { addPerformance } from "@/server/performance.service";
import { addStrengthTest, selectStrengthReference } from "@/server/strength.service";
import { publishRow, saveCompetition, saveScheduledSession } from "@/server/session.service";

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
  // Un espace rempli pour les captures n'est pas un nouveau venu : ni tour, ni carte des premiers pas, ni repères.
  await prisma.onboardingState.updateMany({ where: { organizationId }, data: { guided: false } });
  // Le planificateur s'ouvre sur sa demande : l'accord du coach est déjà donné (aucun appel n'en découle ici).
  await prisma.profile.update({ where: { id: coachId }, data: { aiConsentAt: new Date() } });
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
  // Un second groupe, les sprinteurs, qui s'entraînent aussi à midi : Alex en fait partie.
  const sprintGroup = await prisma.group.create({
    data: { organizationId, name: "Groupe sprint", goal: "Vitesse et départs, saison en salle" },
  });
  const sprinters = [0, 1, 2, 3, 5, 6, 10].map((index) => roster[index]!);
  await prisma.groupMember.createMany({
    data: sprinters.map((athleteId) => ({
      groupId: sprintGroup.id,
      athleteId,
      createdAt: new Date("2026-01-05T10:00:00Z"),
    })),
  });

  const library = await prisma.exercise.findMany({ where: { organizationId }, select: { id: true, name: true } });
  const exercise = (name: string) => {
    const found = library.find((row) => row.name === name);
    if (!found) throw new Error(`Exercice absent : ${name}`);
    return found.id;
  };
  // Les références de force de chaque athlète : maximum au squat, à l'épaulé, au soulevé de terre et au hip thrust,
  // différents d'une personne à l'autre. Alex, l'athlète des captures, progresse au squat depuis l'automne.
  const today0 = todayIso();
  const squatMax = new Map<string, number>();
  for (const [index, athleteId] of roster.entries()) {
    const base = 90 + ((index * 37) % 60);
    squatMax.set(athleteId, index === 0 ? 120 : base);
    const tests: [string, number][] = [
      ["back_squat", index === 0 ? 120 : base],
      ["clean", Math.round((index === 0 ? 120 : base) * 0.72)],
      ["deadlift", Math.round((index === 0 ? 120 : base) * 1.2)],
      ["hip_thrust", Math.round((index === 0 ? 120 : base) * 1.35)],
    ];
    // Chaque test sert les pourcentages des séances (clé du test) ; squat et épaulé ont aussi leur référence de travail,
    // rattachée à leur fiche, que la fiche de l'athlète affiche.
    const linked: Record<string, string> = { back_squat: "Squat arrière", clean: "Épaulé" };
    for (const [exerciseKey, value] of tests) {
      const date = addDays(today0, -21 - (index % 4) * 3);
      await addStrengthTest(coachId, organizationId, { athleteId, exerciseKey, value, kind: "one_rm", date });
      const name = linked[exerciseKey];
      if (name) {
        await selectStrengthReference(coachId, organizationId, athleteId, exercise(name), {
          source: "working",
          valueKg: value,
        });
      }
    }
  }
  for (const [days, value] of [
    [-84, 105],
    [-56, 112.5],
  ] as const) {
    await prisma.strengthTest.create({
      data: {
        organizationId,
        athleteId: mainAthlete,
        exerciseKey: "back_squat",
        kind: "one_rm",
        value,
        date: toDbDate(addDays(today0, days)),
      },
    });
  }

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
        // Charges en pourcentage du maximum : chaque athlète reçoit les siennes, calculées sur ses références.
        block("Force", [
          item("Squat arrière", {
            sets: 4,
            reps: 5,
            load: { type: "pct_1rm", value: 80, test: "back_squat" },
            rest_s: 180,
          }),
          item("Épaulé", { sets: 5, reps: 3, load: { type: "pct_1rm", value: 75, test: "clean" }, rest_s: 180 }),
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
    reveil: {
      type: "mobility",
      title: "Réveil gainage et mobilité",
      duration: 25,
      note: "Avant les cours : on réveille le tronc et les hanches, sans se presser.",
      blocks: [
        block("Réveil", [
          item("Mobilité de cheville", { sets: 2, reps: 10, rest_s: 20 }),
          item("Mobilité des hanches", { sets: 2, reps: 10, rest_s: 20 }),
          item("Gainage ventral", { sets: 3, duration_s: 45, rest_s: 30 }),
        ]),
      ],
    },
    vitesse: {
      type: "running",
      title: "Vitesse, départs",
      duration: 50,
      note: "Départs réactifs : premiers appuis courts et puissants.",
      blocks: [
        block("Activation", [item("Gammes : montées de genoux", { sets: 2, distance_m: 20, rest_s: 45 })]),
        block("Vitesse", [
          item("Accélérations", { sets: 5, distance_m: 30, rest_s: 150 }),
          item("Sprints départ lancé", { sets: 4, distance_m: 30, rest_s: 240 }),
        ]),
      ],
    },
  };

  // Semaine type, de quatre semaines avant à quatre semaines après : le mois affiché est plein. Le groupe prépa le
  // soir, son réveil musculaire trois matins, et le groupe sprint deux midis : jusqu'à trois séances par jour.
  type Slot = [offset: number, key: keyof typeof sessionsByType, time: string, group: "prepa" | "sprint"];
  const pattern: Slot[] = [
    [0, "reveil", "07:30", "prepa"],
    [0, "force", "18:30", "prepa"],
    [1, "vitesse", "12:15", "sprint"],
    [1, "technique", "18:30", "prepa"],
    [2, "reveil", "07:30", "prepa"],
    [2, "vitesse", "12:15", "sprint"],
    [2, "plyo", "18:30", "prepa"],
    [3, "escaliers", "12:15", "sprint"],
    [3, "plots", "18:30", "prepa"],
    [4, "reveil", "07:30", "prepa"],
    [4, "force", "18:30", "prepa"],
    [5, "mobilite", "10:00", "prepa"],
  ];
  const groups = { prepa: { id: org.firstGroupId, members: roster }, sprint: { id: sprintGroup.id, members: sprinters } };
  const today = todayIso();
  const monday = startOfWeek(today);
  const publishedAt = new Date(`${addDays(monday, -35)}T10:00:00Z`);
  for (let week = -4; week <= 4; week++) {
    for (const [offset, key, startTime, groupKey] of pattern) {
      const date = addDays(monday, week * 7 + offset);
      const spec = sessionsByType[key]!;
      const group = groups[groupKey];
      const session = await saveScheduledSession(coachId, organizationId, {
        date,
        startTime,
        location: spec.type === "strength" ? "Salle de force" : spec.type === "stairs" ? "Tribune du stade" : "Stade",
        publishAt: null,
        draft: {
          title: spec.title,
          type: spec.type,
          durationMin: spec.duration,
          coachNote: spec.note,
          blocks: spec.blocks,
        },
        assignments: [{ targetType: "group", targetId: group.id }],
        overrides: [],
      });
      await publishRow(session.id, coachId, publishedAt, { silent: true });
      // Le réveil de ce matin est déjà fait par une partie du groupe : la journée a commencé.
      const doneThisMorning = date === today && startTime < "09:00";
      if (date >= today && !doneThisMorning) continue;
      for (const athleteId of group.members) {
        if (doneThisMorning && random() < 0.3) continue;
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
          const max = squatMax.get(athleteId) ?? 100;
          const load = Math.round((max * 0.78 + week * 1.25) / 2.5) * 2.5 + Math.floor(random() * 2) * 2.5;
          // Les séries de travail du squat (b1-i0) et de l'épaulé (b1-i1), saisies par l'athlète.
          const clean = Math.round((max * 0.72 * 0.75) / 2.5) * 2.5;
          await prisma.setLog.createMany({
            data: [
              ...Array.from({ length: 4 }, (_, setIndex) => ({ itemRef: "b1-i0", setIndex, reps: 5, loadKg: load })),
              ...Array.from({ length: 5 }, (_, setIndex) => ({ itemRef: "b1-i1", setIndex, reps: 3, loadKg: clean })),
            ].map((set) => ({
              ...set,
              sessionLogId: log.id,
              done: true,
              // Les valeurs du contrat des séries détaillées : sans elles, l'analyse ignore la série.
              setKind: "work",
              loadKind: "external",
              repetitionScope: "total",
              sideCount: 1,
            })),
          });
        }
      }
    }
  }

  // Le meeting du samedi, pour le groupe sprint : il paraît dans le calendrier du coach et de ses athlètes.
  await saveCompetition(coachId, organizationId, {
    name: "Meeting régional en salle",
    date: addDays(monday, 5),
    location: "Halle d'athlétisme",
    level: "Régional",
    athleteIds: sprinters,
  });

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

  // Les marques en compétition, pour les records et les progrès (personnes et résultats fictifs).
  const marks: [number, string, number, "s" | "m", number][] = [
    [0, "100 m", 11.42, "s", -150],
    [0, "100 m", 11.21, "s", -95],
    [0, "100 m", 11.08, "s", -32],
    [0, "Saut en longueur", 6.62, "m", -120],
    [0, "Saut en longueur", 6.91, "m", -40],
    [0, "60 m", 7.12, "s", -12],
    [1, "Saut en longueur", 6.48, "m", -60],
    [2, "100 m haies", 14.31, "s", -45],
    [3, "Saut en hauteur", 1.96, "m", -30],
    [4, "200 m", 25.12, "s", -50],
    [5, "Triple saut", 13.84, "m", -38],
  ];
  for (const [index, discipline, mark, unit, days] of marks) {
    await addPerformance(coachId, organizationId, {
      athleteId: roster[index]!,
      discipline,
      mark,
      unit,
      date: addDays(today, days),
      location: index % 2 ? "Stade municipal" : "Halle d'athlétisme",
      wind: unit === "s" && !discipline.startsWith("60") ? 0.8 : null,
    });
  }

  // Les favoris du coach, en tête de la bibliothèque.
  const favorites = await prisma.exerciseList.create({
    data: { organizationId, ownerId: coachId, name: "Favoris", isFavorites: true },
  });
  for (const [position, name] of [
    "Squat arrière",
    "Épaulé",
    "Sauts de haies basses",
    "Accélérations",
    "Bonds unipodaux",
  ].entries()) {
    await prisma.exerciseListItem.create({ data: { listId: favorites.id, exerciseId: exercise(name), position } });
  }

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
  // D'autres vidéos du groupe, pour la liste du coach : une par athlète et par geste.
  const sessionForPlyo = await prisma.scheduledSession.findFirstOrThrow({
    where: { organizationId, title: "Pliométrie, contacts courts", date: { lt: toDbDate(today) } },
    orderBy: { date: "desc" },
  });
  const sessionForStrength = await prisma.scheduledSession.findFirstOrThrow({
    where: { organizationId, title: "Force bas du corps", date: { lt: toDbDate(today) } },
    orderBy: { date: "desc" },
  });
  for (const [athleteId, session, name, note] of [
    [roster[1]!, sessionForPlyo, "Sauts de haies basses", "Contact court : le talon ne touche pas."],
    [roster[3]!, sessionForStrength, "Squat arrière", "Genoux dans l'axe des pieds en remontant."],
    [roster[2]!, sessionForPlyo, "Bonds unipodaux", "Bras actifs, bassin haut à chaque bond."],
  ] as const) {
    await prisma.video.create({
      data: {
        organizationId,
        athleteId,
        uploadedBy: coachId,
        scheduledSessionId: session.id,
        exerciseId: exercise(name),
        status: "ready",
        fps: 120,
        durationMs: 9000,
        recordedAt: session.date,
        sharedWithAthlete: true,
        annotations: { create: [{ authorId: coachId, tMs: 2400, text: note }] },
      },
    });
  }

  // Deux annonces du coach, pour la capture des annonces du tour de piste (personnes et contenus fictifs).
  await publishAnnouncement(coachId, organizationId, {
    groupId: org.firstGroupId,
    body: "Samedi, séance au stade à 10 h : prévoyez les pointes et une tenue de pluie.",
    pinned: true,
  });
  await publishAnnouncement(coachId, organizationId, {
    groupId: org.firstGroupId,
    body: "Tests de détente la semaine prochaine : pensez à valider vos séances d'ici là.",
    pinned: false,
  });
  console.log(`Prêt : ${COACH_EMAIL} et ${ATHLETE_EMAIL}.`);
  await prisma.$disconnect();
};

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
