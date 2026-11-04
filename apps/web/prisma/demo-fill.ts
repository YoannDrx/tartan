// Remplit un compte coach avec des personnes et des données fictives, pour voir l'application en situation.
// Écrit sans passer par les notifications : aucun e-mail ni push ne part au remplissage.
// Les comptes fictifs n'ont ni mot de passe ni adresse réelle. `--retirer` enlève tout ce que ce script a créé.
//   pnpm --filter @tartan/web demo:fill <email>
//   pnpm --filter @tartan/web demo:fill <email> --retirer
process.env.COACH_SIGNUP_MODE = "public";

import { randomUUID } from "node:crypto";
import type { Prescription, SessionDraft } from "@tartan/contracts";
import { addDays, startOfWeek, STARTER_LIBRARY } from "@tartan/domain";
import { todayIso, toDbDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { syncEntitlements } from "@/server/billing.service";
import { createOrganization } from "@/server/org.service";
import { publishRow, saveCompetition, saveScheduledSession, saveTemplate } from "@/server/session.service";

const PREFIX = "fill.";
const DOMAIN = "@demo.tartan.coach";
const COACH_EMAIL = `${PREFIX}coach${DOMAIN}`;
const SECOND_GROUP = "Sprint et haies";
const ATHLETE_SPACE = "Club démo (vue athlète)";
const COMPETITIONS = ["Meeting d'automne", "Interclubs d'hiver"];

// Hasard reproductible : deux remplissages donnent la même saison.
let state = 20261103;
const random = () => {
  state = (state * 1664525 + 1013904223) % 2 ** 32;
  return state / 2 ** 32;
};
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

type Person = {
  first: string;
  last: string;
  born: string;
  discipline: "high_jump" | "sprint";
  best: number;
  squat: number;
  health?: boolean;
  goal?: string;
};

const JUMPERS: Person[] = [
  { first: "Léa", last: "Moreau", born: "2005-03-14", discipline: "high_jump", best: 178, squat: 95, goal: "1,85 m cet hiver" },
  { first: "Tom", last: "Girard", born: "2004-07-02", discipline: "high_jump", best: 205, squat: 140, goal: "Qualification nationale" },
  { first: "Inès", last: "Benali", born: "2006-11-21", discipline: "high_jump", best: 168, squat: 80 },
  { first: "Noah", last: "Petit", born: "2003-01-09", discipline: "high_jump", best: 212, squat: 150, goal: "Passer 2,15 m" },
  { first: "Camille", last: "Roux", born: "2005-09-30", discipline: "high_jump", best: 172, squat: 90 },
  { first: "Yanis", last: "Haddad", born: "2006-05-17", discipline: "high_jump", best: 190, squat: 110, health: false },
];
const SPRINTERS: Person[] = [
  { first: "Hugo", last: "Lefèvre", born: "2004-02-25", discipline: "sprint", best: 7.02, squat: 130 },
  { first: "Manon", last: "Dubois", born: "2005-12-03", discipline: "sprint", best: 7.71, squat: 85 },
];
const CLUBMATES: Person[] = [
  { first: "Sacha", last: "Lambert", born: "2004-08-11", discipline: "high_jump", best: 195, squat: 120 },
  { first: "Emma", last: "Faure", born: "2005-06-19", discipline: "high_jump", best: 170, squat: 88 },
];

const COMMENTS = [
  "Bonnes sensations sur les appuis.",
  "Un peu raide au début, mieux après l'échauffement.",
  "Séance solide, les jambes répondent bien.",
  "Fatigué après la semaine de cours.",
  "J'ai raccourci la fin, manque de temps.",
];

const toEmail = (p: { first: string; last: string }) =>
  `${PREFIX}${`${p.first}.${p.last}`
    .normalize("NFD")
    .replace(/[^A-Za-z.]/g, "")
    .toLowerCase()}${DOMAIN}`;

const createPerson = async (email: string, firstName: string, lastName: string, birthDate = "1985-03-14") => {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email,
      name: `${firstName} ${lastName}`,
      emailVerified: true,
      profile: {
        create: { firstName, lastName, birthDate: new Date(`${birthDate}T00:00:00Z`) },
      },
    },
  });
  return id;
};

const grantConsents = async (userId: string, athleteId: string, health: boolean) => {
  const now = new Date();
  await prisma.consent.createMany({
    data: (["terms", "video", "health"] as const).map((kind) => {
      const granted = kind !== "health" || health;
      return {
        userId,
        athleteId,
        kind,
        version: "2026-11",
        grantedAt: granted ? now : null,
        revokedAt: granted ? null : now,
      };
    }),
    skipDuplicates: true,
  });
};

type Roster = { id: string; person: Person; health: boolean };

const enrollAthlete = async (organizationId: string, groupId: string, person: Person, userId: string) => {
  await prisma.organizationMember.create({ data: { organizationId, userId, role: "athlete", status: "active" } });
  const athlete = await prisma.athlete.create({
    data: {
      organizationId,
      userId,
      firstName: person.first,
      lastName: person.last,
      birthDate: new Date(`${person.born}T00:00:00Z`),
      disciplines: [person.discipline],
      level: person.best > 200 ? "National" : "Régional",
      goals: person.goal ?? null,
      takeoffFoot: person.discipline === "high_jump" ? (random() < 0.5 ? "left" : "right") : null,
      approachSteps: person.discipline === "high_jump" ? between(7, 11) : null,
      groups: { create: { groupId } },
    },
  });
  await grantConsents(userId, athlete.id, person.health !== false);
  return { id: athlete.id, person, health: person.health !== false };
};

const trainingSheets = async (organizationId: string) => {
  const rows = await prisma.exercise.findMany({
    where: { OR: [{ organizationId }, { organizationId: null }], deletedAt: null },
    select: { id: true, name: true },
  });
  const item = (name: string, prescription: Prescription) => {
    const found = rows.find((r) => r.name === name);
    if (!found) throw new Error(`Exercice introuvable : ${name}`);
    return { exerciseId: found.id, prescription };
  };
  const sheets: Record<"strength" | "plyo" | "jump" | "running", SessionDraft> = {
    strength: {
      title: "Force : bas du corps",
      type: "strength",
      durationMin: 75,
      coachNote: "On reste propre sur la dernière série.",
      blocks: [
        {
          name: "Force",
          variant: "club",
          items: [
            item("Squat arrière", {
              sets: 4,
              reps: 5,
              rest_s: 150,
              load: { type: "pct_1rm", value: 80, test: "back_squat" },
            }),
            item("Épaulé", { sets: 5, reps: 3, rest_s: 180, load: { type: "pct_1rm", value: 75, test: "clean" } }),
            item("Soulevé de terre roumain sur une jambe", { sets: 3, reps: 8, rest_s: 90 }),
          ],
        },
        {
          name: "Hanches",
          variant: "both",
          items: [item("Marche des fléchisseurs de hanche à la kettlebell", { sets: 3, reps: 12, rest_s: 45 })],
        },
      ],
    },
    plyo: {
      title: "Pliométrie et appuis",
      type: "plyo",
      durationMin: 60,
      coachNote: "Temps au sol le plus court possible.",
      blocks: [
        {
          name: "Préparation",
          variant: "both",
          items: [item("Routine cheville en 10 minutes", { duration_s: 600 })],
        },
        {
          name: "Bondissements",
          variant: "club",
          items: [
            item("Sauts de haies basses", { sets: 5, unit: "haies", count: 6, ground_contacts: 30, rest_s: 120 }),
            item("Pliométrie en fente sur caisson", { sets: 3, reps: 6, ground_contacts: 18, rest_s: 120 }),
          ],
        },
        {
          name: "Sans matériel",
          variant: "autonomous",
          items: [
            item("Bonds alternés", { sets: 4, distance_m: 20, ground_contacts: 40, rest_s: 120 }),
            item("Fentes sautées", { sets: 3, reps: 10, ground_contacts: 30, rest_s: 90 }),
          ],
        },
      ],
    },
    jump: {
      title: "Saut : élan complet",
      type: "jump",
      durationMin: 90,
      coachNote: "On cherche le rythme des trois derniers appuis.",
      blocks: [
        {
          name: "Technique",
          variant: "club",
          items: [
            item("Élans courts en courbe", { sets: 6, rest_s: 120 }),
            item("Sauts à la barre, élan complet", { sets: 8, rest_s: 180 }),
          ],
        },
        {
          name: "Retour au calme",
          variant: "both",
          items: [item("Bascule de hanches 90/90 à la kettlebell", { sets: 2, reps: 8 })],
        },
      ],
    },
    running: {
      title: "Vitesse",
      type: "running",
      durationMin: 60,
      coachNote: null,
      blocks: [
        {
          name: "Vitesse",
          variant: "club",
          items: [
            item("Gammes : montées de genoux", { sets: 3, distance_m: 30, rest_s: 60 }),
            item("Accélérations", { sets: 4, distance_m: 60, rest_s: 180 }),
            item("Sprints départ lancé", { sets: 4, distance_m: 30, rest_s: 240 }),
          ],
        },
      ],
    },
  };
  return sheets;
};

const planWeeks = async (
  coachId: string,
  organizationId: string,
  groupId: string,
  roster: Roster[],
  plan: { offset: number; sheet: SessionDraft }[],
  commentsOn: boolean,
) => {
  const today = todayIso();
  const monday = startOfWeek(today);
  const dates = new Map<string, SessionDraft>();
  for (let week = -5; week <= 1; week += 1) {
    for (const { offset, sheet } of plan) dates.set(addDays(monday, week * 7 + offset), sheet);
  }
  // Il y a toujours une séance aujourd'hui : c'est le premier écran de l'athlète.
  if (!dates.has(today) && plan[0]) dates.set(today, plan[0].sheet);
  const sessionIds: string[] = [];
  for (const [date, draft] of [...dates].sort(([a], [b]) => a.localeCompare(b))) {
    const session = await saveScheduledSession(coachId, organizationId, {
      date,
      startTime: "18:00",
      location: "Stade municipal",
      draft,
      assignments: [{ targetType: "group", targetId: groupId }],
      overrides: [],
      publishAt: null,
    });
    await publishRow(session.id, coachId, new Date(), { silent: true });
    sessionIds.push(session.id);
    if (date > today) continue;
    const isToday = date === today;
    for (const member of roster) {
      if (isToday && random() < 0.5) continue;
      const roll = random();
      const status = roll < 0.74 ? "done" : roll < 0.87 ? "partial" : "missed";
      const missed = status === "missed";
      await prisma.sessionLog.create({
        data: {
          scheduledSessionId: session.id,
          athleteId: member.id,
          clientId: randomUUID(),
          status,
          variantDone: missed ? null : random() < 0.8 ? "club" : "autonomous",
          rpe: !missed && member.health ? between(5, 9) : null,
          durationMin: missed ? null : (draft.durationMin ?? 60) - between(0, 10),
          comment: !missed && random() < 0.2 ? (COMMENTS[between(0, COMMENTS.length - 1)] ?? null) : null,
          completedAt: missed ? null : new Date(`${date}T19:30:00Z`),
        },
      });
      await prisma.attendance.create({
        data: {
          scheduledSessionId: session.id,
          athleteId: member.id,
          status: missed ? "absent" : "present",
          source: "coach",
        },
      });
    }
    if (commentsOn && roster[0] && random() < 0.25) {
      const author = await prisma.athlete.findUniqueOrThrow({ where: { id: roster[0].id }, select: { userId: true } });
      await prisma.comment.create({
        data: {
          organizationId,
          entityType: "session",
          entityId: session.id,
          authorId: author.userId as string,
          body: "On peut décaler le départ à 18 h 15 ?",
        },
      });
    }
  }
  return sessionIds;
};

const addResults = async (organizationId: string, roster: Roster[], competitionId: string, sessionId?: string) => {
  const today = todayIso();
  for (const { id, person } of roster) {
    await prisma.strengthTest.createMany({
      data: [
        { exerciseKey: "back_squat", value: person.squat - 5, days: -48 },
        { exerciseKey: "back_squat", value: person.squat, days: -8 },
        { exerciseKey: "clean", value: Math.round(person.squat * 0.72), days: -8 },
      ].map(({ exerciseKey, value, days }) => ({
        organizationId,
        athleteId: id,
        exerciseKey,
        value,
        kind: "one_rm" as const,
        date: toDbDate(addDays(today, days)),
      })),
    });
    const high = person.discipline === "high_jump";
    const season = high ? [person.best - 8, person.best - 3, person.best] : [person.best + 0.21, person.best + 0.08, person.best];
    let index = 0;
    for (const mark of season) {
      await prisma.performance.create({
        data: {
          organizationId,
          athleteId: id,
          discipline: high ? "Saut en hauteur" : "60 m",
          mark,
          unit: high ? "cm" : "s",
          date: toDbDate(addDays(today, [-60, -32, -18][index] ?? -18)),
          location: index === 2 ? "Stade municipal" : "Halle régionale",
          competitionId: index === 2 ? competitionId : null,
          isPb: true,
        },
      });
      index += 1;
    }
    if (!high) continue;
    // Le relevé de barres d'un concours : deux hauteurs franchies, puis trois échecs.
    const attempts: [number, number, "O" | "X"][] = [
      [person.best - 5, 1, "O"],
      [person.best, 1, "X"],
      [person.best, 2, "O"],
      [person.best + 3, 1, "X"],
      [person.best + 3, 2, "X"],
      [person.best + 3, 3, "X"],
    ];
    await prisma.jumpAttempt.createMany({
      data: attempts.map(([barHeightCm, attemptNo, result]) => ({
        organizationId,
        athleteId: id,
        competitionId,
        scheduledSessionId: sessionId ?? null,
        barHeightCm,
        attemptNo,
        result,
        clientId: randomUUID(),
      })),
    });
  }
};

const fillCoachSpace = async (coachId: string, organizationId: string) => {
  const today = todayIso();
  const owner = await prisma.organizationMember.findFirstOrThrow({
    where: { organizationId, role: "owner" },
    select: { userId: true },
  });
  await prisma.organizationMember.create({ data: { organizationId, userId: coachId, role: "coach", status: "active" } });
  const first = await prisma.group.findFirstOrThrow({ where: { organizationId }, orderBy: { createdAt: "asc" } });
  const second = await prisma.group.create({
    data: { organizationId, name: SECOND_GROUP, goal: "Préparation de la saison en salle" },
  });
  await prisma.groupCoach.createMany({
    data: [
      { groupId: first.id, userId: coachId, role: "assistant" },
      { groupId: second.id, userId: coachId, role: "lead" },
    ],
  });
  await prisma.exercise.createMany({
    data: STARTER_LIBRARY.map((e) => ({
      organizationId,
      createdBy: coachId,
      name: e.name,
      category: e.category,
      cues: e.cues,
      defaultPrescription: e.prescription,
    })),
  });

  const enrollAll = async (groupId: string, people: Person[]) => {
    const roster: Roster[] = [];
    for (const person of people) {
      const userId = await createPerson(toEmail(person), person.first, person.last, person.born);
      roster.push(await enrollAthlete(organizationId, groupId, person, userId));
    }
    return roster;
  };
  const jumpers = await enrollAll(first.id, JUMPERS);
  const sprinters = await enrollAll(second.id, SPRINTERS);
  const sheets = await trainingSheets(organizationId);

  await planWeeks(
    coachId,
    organizationId,
    first.id,
    jumpers,
    [
      { offset: 0, sheet: sheets.strength },
      { offset: 2, sheet: sheets.plyo },
      { offset: 5, sheet: sheets.jump },
    ],
    true,
  );
  await planWeeks(
    coachId,
    organizationId,
    second.id,
    sprinters,
    [
      { offset: 1, sheet: sheets.running },
      { offset: 3, sheet: sheets.strength },
    ],
    false,
  );
  // Un brouillon la semaine d'après : le coach voit ce qui n'est pas encore publié.
  await saveScheduledSession(coachId, organizationId, {
    date: addDays(startOfWeek(today), 14),
    startTime: "18:00",
    location: "Stade municipal",
    draft: sheets.jump,
    assignments: [{ targetType: "group", targetId: first.id }],
    overrides: [],
    publishAt: null,
  });
  await saveTemplate(coachId, organizationId, sheets.strength);
  await saveTemplate(coachId, organizationId, sheets.plyo);

  const roster = [...jumpers, ...sprinters];
  const past = await saveCompetition(coachId, organizationId, {
    name: COMPETITIONS[0] as string,
    date: addDays(today, -18),
    location: "Halle régionale",
    level: "Régional",
    athleteIds: roster.map((r) => r.id),
  });
  await saveCompetition(coachId, organizationId, {
    name: COMPETITIONS[1] as string,
    date: addDays(today, 12),
    location: "Stade municipal",
    level: "Interclubs",
    athleteIds: jumpers.map((r) => r.id),
  });
  await addResults(organizationId, roster, past.id);

  const lea = jumpers[0];
  const tom = jumpers[1];
  const camille = jumpers[4];
  if (lea && tom && camille) {
    await prisma.injury.createMany({
      data: [
        {
          organizationId,
          athleteId: tom.id,
          bodyArea: "achilles",
          side: "left",
          startDate: toDbDate(addDays(today, -5)),
          status: "recovering",
          restrictions: "Pas de bondissements cette semaine",
        },
        {
          organizationId,
          athleteId: camille.id,
          bodyArea: "knee",
          side: "right",
          startDate: toDbDate(addDays(today, -2)),
          status: "active",
          restrictions: "Séance adaptée, pas d'impulsions",
        },
      ],
    });
    await prisma.coachNote.createMany({
      data: [
        { organizationId, athleteId: lea.id, authorId: owner.userId, body: "Progresse vite. Travailler la courbe." },
        { organizationId, athleteId: tom.id, authorId: owner.userId, body: "Surveiller le tendon jusqu'au meeting." },
      ],
    });
    const lastLog = await prisma.sessionLog.findFirst({
      where: { athleteId: camille.id, status: { not: "missed" } },
      orderBy: { completedAt: "desc" },
    });
    if (lastLog) {
      await prisma.sessionLog.update({
        where: { id: lastLog.id },
        data: { pain: { bodyArea: "knee", side: "right", intensity: 5 }, comment: "Gêne au genou droit en fin de séance." },
      });
    }
  }
  await prisma.announcement.createMany({
    data: [
      {
        organizationId,
        groupId: first.id,
        authorId: coachId,
        pinned: true,
        body: "Interclubs dans 12 jours : confirmez votre présence avant vendredi.",
      },
      {
        organizationId,
        groupId: first.id,
        authorId: coachId,
        body: "Séance de samedi déplacée en salle s'il pleut. Prenez vos pointes.",
      },
      { organizationId, groupId: second.id, authorId: coachId, body: "Tests de vitesse sur 30 m mardi prochain." },
    ],
  });
};

const fillAthleteSpace = async (coachId: string, meId: string, meName: { first: string; last: string }) => {
  const org = await createOrganization(coachId, {
    name: ATHLETE_SPACE,
    type: "club",
    disciplines: ["high_jump"],
    firstGroupName: "Hauteur",
  });
  await prisma.organization.update({ where: { id: org.id }, data: { plan: "pilot" } });
  await syncEntitlements(org.id, "pilot");
  const me: Person = {
    first: meName.first,
    last: meName.last,
    born: "1990-06-15",
    discipline: "high_jump",
    best: 186,
    squat: 115,
    goal: "Passer 1,90 m",
  };
  const roster = [await enrollAthlete(org.id, org.firstGroupId, me, meId)];
  for (const person of CLUBMATES) {
    const userId = await createPerson(toEmail(person), person.first, person.last, person.born);
    roster.push(await enrollAthlete(org.id, org.firstGroupId, person, userId));
  }
  const sheets = await trainingSheets(org.id);
  const sessions = await planWeeks(
    coachId,
    org.id,
    org.firstGroupId,
    roster,
    [
      { offset: 0, sheet: sheets.strength },
      { offset: 2, sheet: sheets.plyo },
      { offset: 4, sheet: sheets.jump },
    ],
    false,
  );
  const competition = await saveCompetition(coachId, org.id, {
    name: COMPETITIONS[0] as string,
    date: addDays(todayIso(), -18),
    location: "Halle régionale",
    level: "Régional",
    athleteIds: roster.map((r) => r.id),
  });
  await addResults(org.id, roster, competition.id, sessions[0]);
  await prisma.announcement.create({
    data: {
      organizationId: org.id,
      groupId: org.firstGroupId,
      authorId: coachId,
      pinned: true,
      body: "Stage de reprise les 20 et 21 décembre, inscriptions ouvertes.",
    },
  });
  // Aujourd'hui reste à faire pour le compte réel : c'est l'écran à essayer.
  const today = await prisma.scheduledSession.findFirst({
    where: { organizationId: org.id, date: toDbDate(todayIso()) },
    select: { id: true },
  });
  const myId = roster[0]?.id;
  if (today && myId) {
    await prisma.sessionLog.deleteMany({ where: { scheduledSessionId: today.id, athleteId: myId } });
    await prisma.attendance.deleteMany({ where: { scheduledSessionId: today.id, athleteId: myId } });
  }
};

const fill = async (email: string) => {
  const me = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, profile: { select: { firstName: true, lastName: true } } },
  });
  if (!me) throw new Error(`Aucun compte pour ${email}`);
  if (await prisma.user.findUnique({ where: { email: COACH_EMAIL } })) {
    throw new Error("Déjà rempli : retire d'abord avec --retirer.");
  }
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: me.id, role: "owner", status: "active" },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new Error(`${email} ne possède aucun espace coach.`);
  const notifications = await prisma.notification.count();
  const coachId = await createPerson(COACH_EMAIL, "Sarah", "Vidal");
  await fillCoachSpace(coachId, membership.organizationId);
  await fillAthleteSpace(coachId, me.id, {
    first: me.profile?.firstName ?? me.name,
    last: me.profile?.lastName ?? "Démo",
  });
  if ((await prisma.notification.count()) !== notifications) {
    throw new Error("Des notifications ont été créées : à vérifier avant de continuer.");
  }
  console.log("Remplissage terminé, sans aucune notification.");
};

const remove = async (email: string) => {
  const me = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!me) throw new Error(`Aucun compte pour ${email}`);
  const coach = await prisma.user.findUnique({ where: { email: COACH_EMAIL }, select: { id: true } });
  if (!coach) {
    console.log("Rien à retirer.");
    return;
  }
  const people = await prisma.user.findMany({
    where: { email: { startsWith: PREFIX, endsWith: DOMAIN } },
    select: { id: true },
  });
  const peopleIds = people.map((p) => p.id);
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: me.id, role: "owner" },
    orderBy: { createdAt: "asc" },
  });
  await prisma.organization.deleteMany({ where: { ownerId: coach.id, name: ATHLETE_SPACE } });
  await prisma.organizationMember.deleteMany({ where: { userId: me.id, role: "athlete", organization: { name: ATHLETE_SPACE } } });
  if (membership) {
    const organizationId = membership.organizationId;
    const athletes = await prisma.athlete.findMany({ where: { organizationId, userId: { in: peopleIds } }, select: { id: true } });
    const athleteIds = athletes.map((a) => a.id);
    await prisma.sessionTemplate.deleteMany({ where: { organizationId, createdBy: coach.id } });
    await prisma.scheduledSession.deleteMany({ where: { organizationId, createdBy: coach.id } });
    await prisma.comment.deleteMany({ where: { organizationId, authorId: { in: peopleIds } } });
    await prisma.announcement.deleteMany({ where: { organizationId, authorId: coach.id } });
    await prisma.coachNote.deleteMany({ where: { organizationId, athleteId: { in: athleteIds } } });
    await prisma.athlete.deleteMany({ where: { id: { in: athleteIds } } });
    await prisma.competition.deleteMany({ where: { organizationId, name: { in: COMPETITIONS } } });
    await prisma.exercise.deleteMany({ where: { organizationId, createdBy: coach.id } });
    await prisma.group.deleteMany({ where: { organizationId, name: SECOND_GROUP } });
  }
  await prisma.notification.deleteMany({ where: { userId: { in: peopleIds } } });
  await prisma.referralCode.deleteMany({ where: { ownerType: "user", ownerId: { in: peopleIds } } });
  await prisma.user.deleteMany({ where: { id: { in: peopleIds } } });
  console.log("Données fictives retirées.");
};

const [email, flag] = process.argv.slice(2);
if (!email) throw new Error("Indique l'adresse du compte à remplir.");
(flag === "--retirer" ? remove(email) : fill(email))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
