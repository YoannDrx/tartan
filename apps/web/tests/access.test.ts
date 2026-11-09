import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { outbox } from "@/lib/mail";
import {
  addCoachNote,
  addStrengthTest,
  getAthleteFile,
  getMyFile,
  listAthletes,
  saveInjury,
} from "@/server/athlete.service";
import { getAthleteSession, getAthleteToday, logSession, setMyAttendance } from "@/server/athlete-view.service";
import { deleteAccount } from "@/server/account.service";
import { addComment, listAnnouncements, listComments, publishAnnouncement } from "@/server/comm.service";
import { answerParentalConsent, consentForAthletes, setConsent } from "@/server/consent.service";
import { saveExercise, listExercises, deleteExercise } from "@/server/exercise.service";
import {
  acceptInvitation,
  createInvitation,
  groupInvitationLink,
  previewInvitation,
  revokeInvitation,
} from "@/server/invitation.service";
import { attributeReferral } from "@/server/referral.service";
import { canCreateCoachSpace, ensureReferralCode, updateOrganization } from "@/server/org.service";
import {
  getAlerts,
  getSessionDetailForCoach,
  getTrackingGrid,
  remindAthletes,
  takeRollCall,
} from "@/server/tracking.service";
import {
  generateAutonomousVersion,
  publishSession,
  saveScheduledSession,
  listCalendar,
} from "@/server/session.service";
import {
  addAnnotation,
  addJumpAttempt,
  applyMuxEvent,
  createVideoUpload,
  getBarSheet,
  getVideo,
  listVideos,
  renewVideoUpload,
  shareVideo,
} from "@/server/video.service";
import { closeOverdueSessions } from "@/server/cron.service";
import { todayIso } from "@/lib/dates";
import { addDays } from "@tartan/domain";
import { pilotMetrics } from "@/server/metrics.service";
import { addAthlete, addStaff, makeOrg, makeUser } from "./helpers";

afterEach(() => vi.unstubAllEnvs());

const TODAY = todayIso();

const draftWith = (exerciseId: string, withAutonomous = true) => ({
  title: "Force et pliométrie",
  type: "strength" as const,
  durationMin: 60,
  coachNote: "Reste léger sur les appuis",
  blocks: [
    {
      name: "Corps de séance",
      variant: "club" as const,
      items: [
        {
          exerciseId,
          prescription: {
            sets: 4,
            reps: 5,
            rest_s: 150,
            load: { type: "pct_1rm" as const, value: 80, test: "back_squat" },
          },
        },
      ],
    },
    ...(withAutonomous
      ? [
          {
            name: "Version seul",
            variant: "autonomous" as const,
            items: [{ exerciseId, prescription: { sets: 3, reps: 10 } }],
          },
        ]
      : []),
  ],
});

const setup = async () => {
  const org = await makeOrg("Thomas");
  const lea = await addAthlete(org.organizationId, org.groupId, "Léa");
  const hugo = await addAthlete(org.organizationId, org.groupId, "Hugo");
  const exercise = await saveExercise(org.owner.userId, org.organizationId, {
    name: "Squat",
    category: "strength",
    cues: ["Dos droit"],
  });
  const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
    date: TODAY,
    startTime: "18:00",
    location: "Stade",
    draft: draftWith(exercise.id),
    assignments: [{ targetType: "group", targetId: org.groupId }],
    overrides: [],
    publishAt: null,
  });
  await publishSession(org.owner.userId, org.organizationId, session.id);
  return { ...org, lea, hugo, exerciseId: exercise.id, sessionId: session.id };
};

let a: Awaited<ReturnType<typeof setup>>;
let b: Awaited<ReturnType<typeof setup>>;

beforeAll(async () => {
  a = await setup();
  b = await setup();
});

describe("isolation entre organisations", () => {
  it("un coach ne voit que ses organisations", async () => {
    await expect(listAthletes(a.owner.userId, b.organizationId)).rejects.toMatchObject({ status: 403 });
    await expect(getTrackingGrid(a.owner.userId, b.organizationId, {})).rejects.toMatchObject({ status: 403 });
    await expect(listExercises(a.owner.userId, b.organizationId)).rejects.toMatchObject({ status: 403 });
    await expect(listCalendar(a.owner.userId, b.organizationId, { from: TODAY, to: TODAY })).rejects.toMatchObject({
      status: 403,
    });
  });

  it("refuse une fiche d'une autre organisation, même avec son identifiant", async () => {
    await expect(getAthleteFile(a.owner.userId, a.organizationId, b.lea.athleteId)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("refuse d'attribuer une séance à un groupe d'une autre organisation", async () => {
    await expect(
      saveScheduledSession(a.owner.userId, a.organizationId, {
        date: TODAY,
        startTime: null,
        location: null,
        draft: draftWith(a.exerciseId),
        assignments: [{ targetType: "group", targetId: b.groupId }],
        overrides: [],
        publishAt: null,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("refuse un exercice d'une autre organisation dans une séance", async () => {
    await expect(
      saveScheduledSession(a.owner.userId, a.organizationId, {
        date: TODAY,
        startTime: null,
        location: null,
        draft: draftWith(b.exerciseId),
        assignments: [{ targetType: "group", targetId: a.groupId }],
        overrides: [],
        publishAt: null,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("isolation entre athlètes", () => {
  it("un athlète ne voit jamais les données d'un autre", async () => {
    await expect(getAthleteFile(a.lea.userId, a.organizationId, a.hugo.athleteId)).rejects.toMatchObject({
      status: 403,
    });
    await expect(getTrackingGrid(a.lea.userId, a.organizationId, {})).resolves.toMatchObject({
      rows: [expect.objectContaining({ athleteId: a.lea.athleteId })],
    });
    const grid = await getTrackingGrid(a.lea.userId, a.organizationId, {});
    expect(grid.rows).toHaveLength(1);
    await expect(getBarSheet(a.lea.userId, a.organizationId, { athleteId: a.hugo.athleteId })).rejects.toMatchObject({
      status: 403,
    });
  });

  it("un athlète ne peut pas agir comme coach", async () => {
    await expect(saveExercise(a.lea.userId, a.organizationId, { name: "X", category: "plyo" })).rejects.toMatchObject({
      status: 403,
    });
    await expect(publishSession(a.lea.userId, a.organizationId, a.sessionId)).rejects.toMatchObject({ status: 403 });
    await expect(
      createInvitation(a.lea.userId, a.organizationId, { kind: "group_link", groupIds: [a.groupId] }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(addCoachNote(a.lea.userId, a.organizationId, a.lea.athleteId, "Note")).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      publishAnnouncement(a.lea.userId, a.organizationId, { groupId: a.groupId, body: "Coucou" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("une séance non attribuée reste invisible", async () => {
    const solo = await saveScheduledSession(a.owner.userId, a.organizationId, {
      date: TODAY,
      startTime: null,
      location: null,
      draft: draftWith(a.exerciseId),
      assignments: [{ targetType: "athlete", targetId: a.hugo.athleteId }],
      overrides: [],
      publishAt: null,
    });
    await publishSession(a.owner.userId, a.organizationId, solo.id);
    await expect(getAthleteSession(a.lea.userId, a.organizationId, solo.id)).rejects.toMatchObject({ status: 404 });
    await expect(getAthleteSession(a.hugo.userId, a.organizationId, solo.id)).resolves.toMatchObject({ id: solo.id });
  });
});

describe("notes privées du coach", () => {
  it("ne sont jamais exposées à l'athlète", async () => {
    await addCoachNote(a.owner.userId, a.organizationId, a.lea.athleteId, "NOTE-SECRETE-COACH");
    const mine = await getMyFile(a.lea.userId, a.organizationId);
    expect(JSON.stringify(mine)).not.toContain("NOTE-SECRETE-COACH");
    expect(mine).not.toHaveProperty("notes");
    const today = await getAthleteToday(a.lea.userId, a.organizationId);
    expect(JSON.stringify(today)).not.toContain("NOTE-SECRETE-COACH");
    const file = await getAthleteFile(a.owner.userId, a.organizationId, a.lea.athleteId);
    expect(file.notes.map((n) => n.body)).toContain("NOTE-SECRETE-COACH");
  });

  it("restent invisibles pour un coach adjoint", async () => {
    const assistant = await addStaff(a.organizationId, "Paul", "assistant", [a.groupId]);
    const file = await getAthleteFile(assistant.userId, a.organizationId, a.lea.athleteId);
    expect(file.notes).toEqual([]);
    expect(file.canWriteNotes).toBe(false);
  });

  it("un coach ne lit que les siennes", async () => {
    const coach = await addStaff(a.organizationId, "Sarah", "coach", [a.groupId]);
    const file = await getAthleteFile(coach.userId, a.organizationId, a.lea.athleteId);
    expect(file.notes.map((n) => n.body)).not.toContain("NOTE-SECRETE-COACH");
  });
});

describe("portée des coachs", () => {
  it("un coach ne voit que ses groupes", async () => {
    const org = await makeOrg("Marc");
    const other = await prisma.group.create({ data: { organizationId: org.organizationId, name: "Cadets" } });
    const inMine = await addAthlete(org.organizationId, org.groupId, "Anna");
    const inOther = await addAthlete(org.organizationId, other.id, "Bilal");
    const coach = await addStaff(org.organizationId, "Julie", "coach", [org.groupId]);
    const list = await listAthletes(coach.userId, org.organizationId);
    expect(list.map((x) => x.id)).toEqual([inMine.athleteId]);
    await expect(getAthleteFile(coach.userId, org.organizationId, inOther.athleteId)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      createInvitation(coach.userId, org.organizationId, { kind: "group_link", groupIds: [other.id] }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      createInvitation(coach.userId, org.organizationId, { kind: "personal_email", role: "coach", email: "x@y.fr" }),
    ).rejects.toMatchObject({ status: 403 });
    const owner = await listAthletes(org.owner.userId, org.organizationId);
    expect(owner).toHaveLength(2);
  });

  it("un coach adjoint ne modifie que ses séances", async () => {
    const assistant = await addStaff(a.organizationId, "Nora", "assistant", [a.groupId]);
    await expect(publishSession(assistant.userId, a.organizationId, a.sessionId)).rejects.toMatchObject({
      status: 403,
    });
    const own = await saveScheduledSession(assistant.userId, a.organizationId, {
      date: TODAY,
      startTime: null,
      location: null,
      draft: draftWith(a.exerciseId),
      assignments: [{ targetType: "group", targetId: a.groupId }],
      overrides: [],
      publishAt: null,
    });
    await expect(publishSession(assistant.userId, a.organizationId, own.id)).resolves.toMatchObject({ id: own.id });
    await expect(
      saveInjury(assistant.userId, a.organizationId, {
        athleteId: a.lea.athleteId,
        bodyArea: "knee",
        side: "left",
        startDate: TODAY,
        status: "active",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("invitations", () => {
  it("ne stocke jamais le jeton en clair", async () => {
    const { id, link } = await groupInvitationLink(a.owner.userId, a.organizationId, a.groupId);
    const token = link.split("/i/")[1] as string;
    const row = await prisma.invitation.findUniqueOrThrow({ where: { id } });
    expect(row.tokenHash).not.toContain(token);
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it("réutilise le lien de groupe et permet plusieurs usages", async () => {
    const first = await groupInvitationLink(a.owner.userId, a.organizationId, a.groupId);
    const second = await groupInvitationLink(a.owner.userId, a.organizationId, a.groupId);
    expect(second.link).toBe(first.link);
    const token = first.link.split("/i/")[1] as string;
    for (const name of ["Inès", "Malik"]) {
      const user = await makeUser(name);
      const res = await acceptInvitation(user, token, {
        firstName: name,
        lastName: "Test",
        birthDate: "2005-01-01",
        consents: { terms: true, health: true, video: true },
      });
      expect(res.athleteId).toBeTruthy();
    }
  });

  it("refuse un athlète sans date de naissance, sinon un enfant consentirait seul", async () => {
    vi.stubEnv("PARENTAL_FLOW_ENABLED", "true");
    const { link } = await createInvitation(a.owner.userId, a.organizationId, {
      kind: "group_link",
      role: "athlete",
      groupIds: [a.groupId],
    });
    const token = link.split("/i/")[1] as string;
    const child = await makeUser("Enfant");
    await prisma.profile.update({ where: { id: child.userId }, data: { birthDate: null } });
    const input = { firstName: "Enfant", lastName: "Test", consents: { terms: true, health: true, video: true } };
    await expect(acceptInvitation(child, token, { ...input, birthDate: null })).rejects.toMatchObject({ status: 400 });
    await expect(acceptInvitation(child, token, { ...input, birthDate: "2020-01-01" })).rejects.toMatchObject({
      status: 400,
    });
  });

  it("garde la date connue au lieu de l'effacer, et demande un parent si elle révèle un mineur", async () => {
    vi.stubEnv("PARENTAL_FLOW_ENABLED", "true");
    const { link } = await createInvitation(a.owner.userId, a.organizationId, {
      kind: "group_link",
      role: "athlete",
      groupIds: [a.groupId],
    });
    const token = link.split("/i/")[1] as string;
    const child = await makeUser("Noa", { birthDate: "2020-01-01" });
    const input = { firstName: "Noa", lastName: "Test", consents: { terms: true, health: true, video: true } };
    await expect(acceptInvitation(child, token, { ...input, birthDate: null })).rejects.toMatchObject({ status: 400 });
  });

  it("consomme un lien nominatif une seule fois et vérifie le destinataire", async () => {
    const user = await makeUser("Chloé");
    const { link } = await createInvitation(a.owner.userId, a.organizationId, {
      kind: "personal_email",
      email: user.email,
      groupIds: [a.groupId],
    });
    const token = link.split("/i/")[1] as string;
    expect(outbox.some((m) => m.to === user.email)).toBe(true);
    const stranger = await makeUser("Intrus");
    await expect(
      acceptInvitation(stranger, token, {
        firstName: "I",
        lastName: "T",
        birthDate: null,
        consents: { terms: true, health: false, video: false },
      }),
    ).rejects.toMatchObject({ code: "wrong_account" });
    await acceptInvitation(user, token, {
      firstName: "Chloé",
      lastName: "R",
      birthDate: "2006-03-03",
      consents: { terms: true, health: false, video: false },
    });
    const preview = await previewInvitation(token);
    expect(preview.state).toBe("used");
    await expect(
      acceptInvitation(user, token, {
        firstName: "Chloé",
        lastName: "R",
        birthDate: "2006-03-03",
        consents: { terms: true, health: false, video: false },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("refuse un jeton forgé et un lien révoqué", async () => {
    await expect(previewInvitation("00000000000000000000000000000000.faux")).rejects.toMatchObject({ status: 404 });
    const { id, link } = await createInvitation(a.owner.userId, a.organizationId, {
      kind: "qr",
      groupIds: [a.groupId],
    });
    await revokeInvitation(a.owner.userId, a.organizationId, id);
    const token = link.split("/i/")[1] as string;
    expect((await previewInvitation(token)).state).toBe("revoked");
    const user = await makeUser("Sami");
    await expect(
      acceptInvitation(user, token, {
        firstName: "S",
        lastName: "D",
        birthDate: null,
        consents: { terms: true, health: false, video: false },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rattache la fiche pré-créée au compte", async () => {
    const org = await makeOrg("Karim");
    const prepared = await prisma.athlete.create({
      data: { organizationId: org.organizationId, firstName: "Zoé", lastName: "P" },
    });
    await addStrengthTest(org.owner.userId, org.organizationId, {
      athleteId: prepared.id,
      exerciseKey: "back_squat",
      value: 80,
      kind: "one_rm",
      date: "2026-10-01",
    });
    const user = await makeUser("Zoé");
    const { link } = await createInvitation(org.owner.userId, org.organizationId, {
      kind: "personal_email",
      email: user.email,
      groupIds: [org.groupId],
      athleteId: prepared.id,
    });
    const res = await acceptInvitation(user, link.split("/i/")[1] as string, {
      firstName: "Zoé",
      lastName: "P",
      birthDate: "2004-02-02",
      consents: { terms: true, health: true, video: true },
    });
    expect(res.athleteId).toBe(prepared.id);
    const mine = await getMyFile(user.userId, org.organizationId);
    expect(mine.tests[0]?.value).toBe(80);
  });

  it("exige les conditions d'utilisation", async () => {
    const { link } = await createInvitation(a.owner.userId, a.organizationId, {
      kind: "group_link",
      groupIds: [a.groupId],
    });
    const user = await makeUser("Sans");
    await expect(
      acceptInvitation(user, link.split("/i/")[1] as string, {
        firstName: "S",
        lastName: "C",
        birthDate: null,
        consents: { terms: false, health: true, video: true },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("un coach invité rejoint l'espace comme coach", async () => {
    const org = await makeOrg("Lucie");
    const user = await makeUser("Adjoint");
    const { link } = await createInvitation(org.owner.userId, org.organizationId, {
      kind: "personal_email",
      role: "assistant",
      email: user.email,
      groupIds: [org.groupId],
    });
    await acceptInvitation(user, link.split("/i/")[1] as string, {
      firstName: "Adj",
      lastName: "T",
      birthDate: null,
      consents: { terms: true, health: false, video: false },
    });
    const member = await prisma.organizationMember.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: org.organizationId, userId: user.userId } },
    });
    expect(member.role).toBe("assistant");
    expect(await listAthletes(user.userId, org.organizationId)).toEqual([]);
  });
});

describe("mineurs et consentements", () => {
  const under15 = `${new Date().getUTCFullYear() - 13}-01-01`;

  it("exige l'e-mail d'un parent sous 15 ans et masque santé et vidéos", async () => {
    vi.stubEnv("PARENTAL_FLOW_ENABLED", "true");
    const org = await makeOrg("Paul");
    const { link } = await createInvitation(org.owner.userId, org.organizationId, {
      kind: "group_link",
      groupIds: [org.groupId],
    });
    const token = link.split("/i/")[1] as string;
    const kid = await makeUser("Enzo");
    await expect(
      acceptInvitation(kid, token, {
        firstName: "Enzo",
        lastName: "T",
        birthDate: under15,
        consents: { terms: true, health: true, video: true },
      }),
    ).rejects.toMatchObject({ status: 400 });
    const parentEmail = `parent-${kid.userId.slice(0, 8)}@test.tartan.coach`;
    const res = await acceptInvitation(kid, token, {
      firstName: "Enzo",
      lastName: "T",
      birthDate: under15,
      guardianEmail: parentEmail,
      consents: { terms: true, health: true, video: true },
    });
    expect(res.parentalConsentRequired).toBe(true);
    const athleteId = res.athleteId as string;
    let state = (await consentForAthletes([athleteId])).get(athleteId);
    expect(state).toEqual({ health: false, video: false, parentalPending: true });

    const mail = outbox.find((m) => m.to === parentEmail);
    expect(mail).toBeTruthy();
    const parentToken = mail?.html.match(/accord-parental\/([^"&]+)/)?.[1] as string;
    await answerParentalConsent({ token: parentToken, decision: "granted", scope: { health: true, video: false } });
    state = (await consentForAthletes([athleteId])).get(athleteId);
    expect(state).toEqual({ health: true, video: false, parentalPending: false });
    await expect(createVideoUpload(org.owner.userId, org.organizationId, { athleteId })).rejects.toMatchObject({
      code: "consent_required",
    });
  });

  it("refuse un faux jeton parental", async () => {
    await expect(
      answerParentalConsent({
        token: "abc.def.ghi.jkl.mno",
        decision: "granted",
        scope: { health: true, video: true },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("sans accord santé : pas d'effort ressenti, pas de douleur, pas de blessure", async () => {
    const org = await makeOrg("Nadia");
    const kid = await addAthlete(org.organizationId, org.groupId, "Tom", { health: false });
    const exercise = await saveExercise(org.owner.userId, org.organizationId, { name: "Bonds", category: "plyo" });
    const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
      date: TODAY,
      startTime: null,
      location: null,
      draft: draftWith(exercise.id),
      assignments: [{ targetType: "group", targetId: org.groupId }],
      overrides: [],
      publishAt: null,
    });
    await publishSession(org.owner.userId, org.organizationId, session.id);
    await logSession(kid.userId, org.organizationId, session.id, {
      clientId: "client-sans-accord",
      status: "done",
      variantDone: "club",
      rpe: 9,
      pain: { bodyArea: "knee", side: "left", intensity: 7 },
    });
    const row = await prisma.sessionLog.findFirstOrThrow({ where: { athleteId: kid.athleteId } });
    expect(row.rpe).toBeNull();
    expect(row.pain).toBeNull();
    await expect(
      saveInjury(org.owner.userId, org.organizationId, {
        athleteId: kid.athleteId,
        bodyArea: "knee",
        side: "left",
        startDate: TODAY,
        status: "active",
      }),
    ).rejects.toMatchObject({ code: "consent_required" });
    const file = await getAthleteFile(org.owner.userId, org.organizationId, kid.athleteId);
    expect(file.healthVisible).toBe(false);
  });

  it("le retrait d'accord masque aussitôt les blessures et journalise l'accès", async () => {
    const org = await makeOrg("Omar");
    const ath = await addAthlete(org.organizationId, org.groupId, "Lina");
    await saveInjury(org.owner.userId, org.organizationId, {
      athleteId: ath.athleteId,
      bodyArea: "knee",
      side: "left",
      startDate: TODAY,
      status: "active",
    });
    const before = await getAthleteFile(org.owner.userId, org.organizationId, ath.athleteId);
    expect(before.injuries).toHaveLength(1);
    const logged = await prisma.auditLog.count({
      where: { organizationId: org.organizationId, action: "health_read", entityId: ath.athleteId },
    });
    expect(logged).toBeGreaterThan(0);
    await setConsent(ath.userId, "health", false);
    const after = await getAthleteFile(org.owner.userId, org.organizationId, ath.athleteId);
    expect(after.injuries).toEqual([]);
    const grid = await getTrackingGrid(org.owner.userId, org.organizationId, {});
    expect(grid.rows[0]?.activeInjury).toBeNull();
  });
});

describe("séance : du coach à l'athlète", () => {
  it("calcule la charge individuelle et la recalcule après un nouveau test", async () => {
    await addStrengthTest(a.owner.userId, a.organizationId, {
      athleteId: a.lea.athleteId,
      exerciseKey: "back_squat",
      value: 110,
      kind: "one_rm",
      date: "2026-10-01",
    });
    let detail = await getAthleteSession(a.lea.userId, a.organizationId, a.sessionId);
    expect(detail.blocks[0]?.items[0]?.resolvedLoadKg).toBe(87.5);
    await addStrengthTest(a.owner.userId, a.organizationId, {
      athleteId: a.lea.athleteId,
      exerciseKey: "back_squat",
      value: 120,
      kind: "one_rm",
      date: "2026-10-20",
    });
    detail = await getAthleteSession(a.lea.userId, a.organizationId, a.sessionId);
    expect(detail.blocks[0]?.items[0]?.resolvedLoadKg).toBe(96.25);
    const hugo = await getAthleteSession(a.hugo.userId, a.organizationId, a.sessionId);
    expect(hugo.blocks[0]?.items[0]?.resolvedLoadKg).toBeNull();
  });

  it("un ajustement individuel ne touche qu'un athlète", async () => {
    const session = await saveScheduledSession(b.owner.userId, b.organizationId, {
      date: TODAY,
      startTime: null,
      location: null,
      draft: draftWith(b.exerciseId),
      assignments: [{ targetType: "group", targetId: b.groupId }],
      overrides: [{ athleteId: b.lea.athleteId, itemRef: "b0-i0", prescription: { sets: 2 } }],
      publishAt: null,
    });
    await publishSession(b.owner.userId, b.organizationId, session.id);
    const lea = await getAthleteSession(b.lea.userId, b.organizationId, session.id);
    const hugo = await getAthleteSession(b.hugo.userId, b.organizationId, session.id);
    expect(lea.blocks[0]?.items[0]?.prescription.sets).toBe(2);
    expect(hugo.blocks[0]?.items[0]?.prescription.sets).toBe(4);
  });

  it("une séance publiée est un instantané : supprimer l'exercice ne la change pas", async () => {
    const org = await makeOrg("Eva");
    const ath = await addAthlete(org.organizationId, org.groupId, "Noa");
    const exercise = await saveExercise(org.owner.userId, org.organizationId, { name: "Fentes", category: "strength" });
    const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
      date: TODAY,
      startTime: null,
      location: null,
      draft: draftWith(exercise.id),
      assignments: [{ targetType: "group", targetId: org.groupId }],
      overrides: [],
      publishAt: null,
    });
    await publishSession(org.owner.userId, org.organizationId, session.id);
    await deleteExercise(org.owner.userId, org.organizationId, exercise.id);
    const detail = await getAthleteSession(ath.userId, org.organizationId, session.id);
    expect(detail.blocks[0]?.items[0]?.name).toBe("Fentes");
    expect((await listExercises(org.owner.userId, org.organizationId)).map((e) => e.name)).not.toContain("Fentes");
  });

  it("un brouillon reste invisible pour l'athlète", async () => {
    const draft = await saveScheduledSession(a.owner.userId, a.organizationId, {
      date: TODAY,
      startTime: null,
      location: null,
      draft: draftWith(a.exerciseId),
      assignments: [{ targetType: "group", targetId: a.groupId }],
      overrides: [],
      publishAt: null,
    });
    await expect(getAthleteSession(a.lea.userId, a.organizationId, draft.id)).rejects.toMatchObject({ status: 404 });
  });

  it("refuse de publier sans destinataire", async () => {
    const draft = await saveScheduledSession(a.owner.userId, a.organizationId, {
      date: TODAY,
      startTime: null,
      location: null,
      draft: draftWith(a.exerciseId),
      assignments: [],
      overrides: [],
      publishAt: null,
    });
    await expect(publishSession(a.owner.userId, a.organizationId, draft.id)).rejects.toMatchObject({ status: 400 });
  });

  it("la validation est idempotente pour la file hors ligne", async () => {
    const input = {
      clientId: "client-idem-123",
      status: "done" as const,
      variantDone: "club" as const,
      rpe: 6,
      comment: "Bien",
    };
    const first = await logSession(a.hugo.userId, a.organizationId, a.sessionId, input);
    const second = await logSession(a.hugo.userId, a.organizationId, a.sessionId, input);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(
      await prisma.sessionLog.count({ where: { athleteId: a.hugo.athleteId, scheduledSessionId: a.sessionId } }),
    ).toBe(1);
  });

  it("une douleur alerte le coach, sans détail dans la notification, et passe l'athlète en tête", async () => {
    await logSession(a.lea.userId, a.organizationId, a.sessionId, {
      clientId: "client-douleur-1",
      status: "partial",
      variantDone: "club",
      rpe: 9,
      pain: { bodyArea: "knee", side: "left", intensity: 6 },
    });
    const notif = await prisma.notification.findFirstOrThrow({ where: { userId: a.owner.userId, type: "pain_alert" } });
    expect(JSON.stringify(notif.payload)).not.toMatch(/knee|genou|left/i);
    const grid = await getTrackingGrid(a.owner.userId, a.organizationId, { week: TODAY });
    expect(grid.rows[0]?.athleteId).toBe(a.lea.athleteId);
    expect(grid.rows[0]?.hasPain).toBe(true);
    const alerts = await getAlerts(a.owner.userId, a.organizationId);
    expect(alerts[0]).toMatchObject({ kind: "pain", athleteId: a.lea.athleteId, severity: "high" });
  });

  it("l'absent reçoit la version autonomie, et le coach sait s'il n'y en a pas", async () => {
    const org = await makeOrg("Ali");
    const ath = await addAthlete(org.organizationId, org.groupId, "Maya");
    const exercise = await saveExercise(org.owner.userId, org.organizationId, { name: "Gainage", category: "warmup" });
    const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
      date: addDays(TODAY, 1),
      startTime: null,
      location: null,
      draft: draftWith(exercise.id, false),
      assignments: [{ targetType: "group", targetId: org.groupId }],
      overrides: [],
      publishAt: null,
    });
    await publishSession(org.owner.userId, org.organizationId, session.id);
    let call = await takeRollCall(org.owner.userId, org.organizationId, session.id, {
      entries: [{ athleteId: ath.athleteId, status: "absent" }],
    });
    expect(call).toEqual({ absentCount: 1, hasAutonomous: false });
    await generateAutonomousVersion(org.owner.userId, org.organizationId, session.id);
    call = await takeRollCall(org.owner.userId, org.organizationId, session.id, {
      entries: [{ athleteId: ath.athleteId, status: "absent" }],
    });
    expect(call.hasAutonomous).toBe(true);
    const detail = await getAthleteSession(ath.userId, org.organizationId, session.id);
    expect(detail.variant).toBe("autonomous");
    const res = await setMyAttendance(ath.userId, org.organizationId, session.id, "present");
    expect(res.variant).toBe("club");
  });

  it("le coach relance les retardataires seulement", async () => {
    const res = await remindAthletes(a.owner.userId, a.organizationId, a.sessionId);
    const detail = await getSessionDetailForCoach(a.owner.userId, a.organizationId, a.sessionId);
    const late = detail.athletes.filter((x) => x.status === "upcoming" || x.status === "missed");
    expect(res.count).toBe(late.length);
  });

  it("passe en manquée 24 h après la date, sans doublon", async () => {
    const org = await makeOrg("Ines");
    const ath = await addAthlete(org.organizationId, org.groupId, "Rayan");
    const exercise = await saveExercise(org.owner.userId, org.organizationId, {
      name: "Sprints",
      category: "running_drill",
    });
    const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
      date: addDays(TODAY, -3),
      startTime: null,
      location: null,
      draft: draftWith(exercise.id),
      assignments: [{ targetType: "group", targetId: org.groupId }],
      overrides: [],
      publishAt: null,
    });
    await publishSession(org.owner.userId, org.organizationId, session.id);
    await closeOverdueSessions();
    await closeOverdueSessions();
    const logs = await prisma.sessionLog.findMany({ where: { athleteId: ath.athleteId } });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe("missed");
    // Une validation tardive reprend la main sur « manquée ».
    await logSession(ath.userId, org.organizationId, session.id, {
      clientId: "client-tardif-1",
      status: "done",
      variantDone: "club",
    });
    const grid = await getTrackingGrid(org.owner.userId, org.organizationId, { week: addDays(TODAY, -3) });
    expect(grid.rows[0]?.cells[0]?.status).toBe("done");
  });
});

describe("vidéos", () => {
  const makeVideo = async (shared: boolean) => {
    const video = await prisma.video.create({
      data: {
        organizationId: a.organizationId,
        athleteId: a.lea.athleteId,
        uploadedBy: a.owner.userId,
        status: "ready",
        sharedWithAthlete: shared,
        scheduledSessionId: a.sessionId,
      },
    });
    return video.id;
  };

  it("n'est visible que des coachs de l'athlète et de lui-même une fois partagée", async () => {
    const id = await makeVideo(false);
    await expect(getVideo(a.lea.userId, a.organizationId, id)).rejects.toMatchObject({ status: 404 });
    await expect(getVideo(a.hugo.userId, a.organizationId, id)).rejects.toMatchObject({ status: 404 });
    await expect(getVideo(b.owner.userId, a.organizationId, id)).rejects.toMatchObject({ status: 403 });
    await expect(getVideo(a.owner.userId, a.organizationId, id)).resolves.toMatchObject({ id });
    await shareVideo(a.owner.userId, a.organizationId, id, { withAthlete: true });
    await expect(getVideo(a.lea.userId, a.organizationId, id)).resolves.toMatchObject({ id });
    await expect(getVideo(a.hugo.userId, a.organizationId, id)).rejects.toMatchObject({ status: 404 });
    expect((await listVideos(a.hugo.userId, a.organizationId)).map((v) => v.id)).not.toContain(id);
    const notif = await prisma.notification.findFirst({ where: { userId: a.lea.userId, type: "video_shared" } });
    expect(notif).toBeTruthy();
  });

  it("refuse le partage au groupe en V1", async () => {
    const id = await makeVideo(false);
    await expect(
      shareVideo(a.owner.userId, a.organizationId, id, { withAthlete: true, withGroup: true }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("l'athlète répond mais n'annote pas", async () => {
    const id = await makeVideo(true);
    await addAnnotation(a.owner.userId, a.organizationId, id, { tMs: 2400, phase: "takeoff", text: "Pied à plat" });
    await expect(addAnnotation(a.lea.userId, a.organizationId, id, { tMs: 100, text: "Moi" })).rejects.toMatchObject({
      status: 403,
    });
    await addComment(a.lea.userId, a.organizationId, { entityType: "video", entityId: id, body: "Merci coach" });
    const detail = await getVideo(a.lea.userId, a.organizationId, id);
    expect(detail.annotations[0]).toMatchObject({ tMs: 2400, phase: "takeoff" });
    expect(detail.comments[0]?.body).toBe("Merci coach");
    await expect(
      addComment(a.hugo.userId, a.organizationId, { entityType: "video", entityId: id, body: "Coucou" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("un adjoint ne lit pas les vidéos d'un autre groupe en passant l'identifiant", async () => {
    const id = await makeVideo(false);
    const otherGroup = await prisma.group.create({ data: { organizationId: a.organizationId, name: "Autre groupe" } });
    const assistant = await addStaff(a.organizationId, "Adjoint", "assistant", [otherGroup.id]);
    const videos = await listVideos(assistant.userId, a.organizationId, { athleteId: a.lea.athleteId });
    expect(videos.map((v) => v.id)).not.toContain(id);
  });

  it("un accord vidéo retiré coupe la lecture et le partage côté coach, pas côté athlète", async () => {
    const id = await makeVideo(true);
    await prisma.video.update({ where: { id }, data: { muxPlaybackId: null } });
    await setConsent(a.lea.userId, "video", false, a.lea.athleteId);
    const seen = await getVideo(a.owner.userId, a.organizationId, id);
    expect(seen.consentRevoked).toBe(true);
    expect(seen.mp4Url).toBeNull();
    await expect(shareVideo(a.owner.userId, a.organizationId, id, { withAthlete: true })).rejects.toMatchObject({
      code: "consent_required",
    });
    const own = await getVideo(a.lea.userId, a.organizationId, id);
    expect(own.consentRevoked).toBe(false);
    await setConsent(a.lea.userId, "video", true, a.lea.athleteId);
  });

  it("la feuille de barres sans filtre montre la dernière séance, et la meilleure barre de toutes", async () => {
    const hugo = a.hugo.athleteId;
    const base = { organizationId: a.organizationId, athleteId: hugo };
    await prisma.jumpAttempt.createMany({
      data: [
        { ...base, barHeightCm: 180, attemptNo: 1, result: "O", createdAt: new Date("2026-10-01T10:00:00Z") },
        { ...base, barHeightCm: 170, attemptNo: 1, result: "X", createdAt: new Date("2026-10-20T10:00:00Z") },
      ],
    });
    const sheet = await getBarSheet(a.owner.userId, a.organizationId, { athleteId: hugo });
    expect(sheet.rows.map((r) => r.heightCm)).toEqual([170]);
    expect(sheet.bestCm).toBe(180);
  });

  it("le webhook met à jour statut, fréquence et durée", async () => {
    const id = await makeVideo(false);
    await applyMuxEvent({ type: "video.asset.created", data: { id: "asset-1", passthrough: `video:${id}` } });
    await applyMuxEvent({
      type: "video.asset.ready",
      data: {
        id: "asset-1",
        passthrough: `video:${id}`,
        duration: 4.25,
        playback_ids: [{ id: "playback-1" }],
        tracks: [{ type: "video", max_frame_rate: 239.97 }],
      },
    });
    const row = await prisma.video.findUniqueOrThrow({ where: { id } });
    // Non étirée : Mux ne sert que 30 i/s au plus, quoi que dise la source.
    expect(row).toMatchObject({ status: "ready", fps: 30, durationMs: 4250, muxPlaybackId: "playback-1" });
  });

  it("une vidéo étirée garde sa fréquence de capture et sa durée réelle", async () => {
    const id = await makeVideo(false);
    await prisma.video.update({ where: { id }, data: { fps: 240, timeScale: 8 } });
    await applyMuxEvent({
      type: "video.asset.ready",
      data: {
        id: "asset-2",
        passthrough: `video:${id}`,
        duration: 24,
        playback_ids: [{ id: "playback-2" }],
        tracks: [{ type: "video", max_frame_rate: 30 }],
      },
    });
    const row = await prisma.video.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: "ready", fps: 240, timeScale: 8, durationMs: 3000 });
  });

  it("un essai rejoué depuis la file hors ligne ne crée pas de doublon", async () => {
    const input = {
      athleteId: b.lea.athleteId,
      barHeightCm: 150,
      attemptNo: 1,
      result: "O" as const,
      clientId: "client-essai-1",
    };
    const first = await addJumpAttempt(b.owner.userId, b.organizationId, input);
    const second = await addJumpAttempt(b.owner.userId, b.organizationId, input);
    expect(second.id).toBe(first.id);
    expect(await prisma.jumpAttempt.count({ where: { athleteId: b.lea.athleteId, clientId: "client-essai-1" } })).toBe(
      1,
    );
  });

  it("une vidéo déjà envoyée ne redemande pas d'adresse d'envoi", async () => {
    const id = await makeVideo(false);
    await expect(renewVideoUpload(a.owner.userId, a.organizationId, id)).rejects.toMatchObject({ status: 400 });
    await expect(renewVideoUpload(a.lea.userId, a.organizationId, id)).rejects.toMatchObject({ status: 403 });
  });

  it("note la feuille de barres", async () => {
    const athleteId = a.hugo.athleteId;
    for (const [h, n, r] of [
      [160, 1, "O"],
      [170, 1, "X"],
      [170, 2, "O"],
      [175, 1, "X"],
      [175, 2, "X"],
      [175, 3, "X"],
    ] as const) {
      await addJumpAttempt(a.owner.userId, a.organizationId, {
        athleteId,
        scheduledSessionId: a.sessionId,
        barHeightCm: h,
        attemptNo: n,
        result: r,
      });
    }
    const sheet = await getBarSheet(a.owner.userId, a.organizationId, { athleteId, scheduledSessionId: a.sessionId });
    expect(sheet.rows.map((x) => `${x.label}:${x.notation}`)).toEqual(["1,60:O", "1,70:XO", "1,75:XXX"]);
    await expect(getBarSheet(a.hugo.userId, a.organizationId, { athleteId })).resolves.toBeTruthy();
  });
});

describe("communication", () => {
  it("une annonce reste dans son groupe", async () => {
    const org = await makeOrg("Sonia");
    const other = await prisma.group.create({ data: { organizationId: org.organizationId, name: "Cadets" } });
    const inGroup = await addAthlete(org.organizationId, org.groupId, "Ana");
    const elsewhere = await addAthlete(org.organizationId, other.id, "Ben");
    await publishAnnouncement(org.owner.userId, org.organizationId, {
      groupId: org.groupId,
      body: "Séance déplacée",
      pinned: true,
    });
    expect((await listAnnouncements(inGroup.userId, org.organizationId)).map((x) => x.body)).toEqual([
      "Séance déplacée",
    ]);
    expect(await listAnnouncements(elsewhere.userId, org.organizationId)).toEqual([]);
    const today = await getAthleteToday(inGroup.userId, org.organizationId);
    expect(today.pinnedAnnouncement?.body).toBe("Séance déplacée");
  });

  it("le coach accède au fil d'une séance publiée à un groupe encore vide", async () => {
    const org = await makeOrg("Vide");
    const exercise = await saveExercise(org.owner.userId, org.organizationId, { name: "Bonds", category: "plyo" });
    const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
      date: TODAY,
      startTime: null,
      location: null,
      draft: draftWith(exercise.id),
      assignments: [{ targetType: "group", targetId: org.groupId }],
      overrides: [],
      publishAt: null,
    });
    await publishSession(org.owner.userId, org.organizationId, session.id);
    await expect(listComments(org.owner.userId, org.organizationId, "session", session.id)).resolves.toEqual([]);
    const outsider = await addStaff(org.organizationId, "Autre", "coach");
    await expect(listComments(outsider.userId, org.organizationId, "session", session.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("les commentaires de séance restent aux concernés", async () => {
    await addComment(a.lea.userId, a.organizationId, {
      entityType: "session",
      entityId: a.sessionId,
      body: "Gêne au 3e bond",
    });
    expect((await listComments(a.owner.userId, a.organizationId, "session", a.sessionId)).map((c) => c.body)).toContain(
      "Gêne au 3e bond",
    );
    await expect(listComments(b.lea.userId, a.organizationId, "session", a.sessionId)).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("parrainage", () => {
  it("attribue une fois pour toutes et écarte l'auto-parrainage", async () => {
    const coach = await makeOrg("Marie");
    const code = await ensureReferralCode(coach.owner.userId);
    expect(code).toMatch(/^TARTAN-MARIE-/);
    expect(await attributeReferral({ userId: coach.owner.userId, code })).toBe(false);
    const filleul = await makeUser("Filleul");
    expect(await attributeReferral({ userId: filleul.userId, code })).toBe(true);
    const other = await makeOrg("Autre");
    const otherCode = await ensureReferralCode(other.owner.userId);
    expect(await attributeReferral({ userId: filleul.userId, code: otherCode })).toBe(false);
  });

  it("écarte les mineurs", async () => {
    const coach = await makeOrg("Hana");
    const code = await ensureReferralCode(coach.owner.userId);
    const kid = await makeUser("Petit", { birthDate: `${new Date().getUTCFullYear() - 12}-01-01` });
    expect(await attributeReferral({ userId: kid.userId, code })).toBe(false);
  });
});

describe("plafond de l'offre gratuite de Mux", () => {
  const withLimit = async (limit: string) => {
    vi.resetModules();
    vi.stubEnv("MUX_VIDEO_LIMIT", limit);
    return import("@/server/video-capacity.service");
  };

  it("ne plafonne rien sans limite définie", async () => {
    const service = await withLimit("");
    expect(await service.videoCapacity()).toBeNull();
    await expect(service.assertVideoCapacity()).resolves.toBeUndefined();
    vi.unstubAllEnvs();
  });

  it("compte les vidéos stockées et les envois en cours, pas les envois abandonnés", async () => {
    const org = await makeOrg("Plafond");
    const athlete = await addAthlete(org.organizationId, org.groupId, "Paul");
    const video = (data: { muxAssetId?: string; createdAt?: Date }) =>
      prisma.video.create({
        data: {
          organizationId: org.organizationId,
          athleteId: athlete.athleteId,
          uploadedBy: org.owner.userId,
          ...data,
        },
      });
    const service = await withLimit("100000");
    const start = (await service.videoCapacity())?.used ?? 0;

    await video({ muxAssetId: `plafond-${org.organizationId}` });
    await video({});
    await video({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });
    expect((await service.videoCapacity())?.used).toBe(start + 2);

    const full = await withLimit(String(start + 2));
    await expect(full.assertVideoCapacity()).rejects.toMatchObject({ status: 409, code: "video_storage_full" });
    const room = await withLimit(String(start + 3));
    await expect(room.assertVideoCapacity()).resolves.toBeUndefined();
    vi.unstubAllEnvs();
  });
});

describe("ouverture aux coachs", () => {
  it("réserve la création d'espace à la liste quand les inscriptions sont fermées", async () => {
    const stranger = await makeUser("Inconnu");
    const invited = await makeUser("Invite");
    expect(await canCreateCoachSpace(stranger.email)).toBe(true);
    vi.resetModules();
    vi.stubEnv("COACH_SIGNUP_MODE", "closed");
    vi.stubEnv("COACH_SIGNUP_EMAILS", ` ${invited.email.toUpperCase()} , autre@test.fr`);
    const fresh = await import("@/server/org.service");
    expect(await fresh.canCreateCoachSpace(stranger.email)).toBe(false);
    expect(await fresh.canCreateCoachSpace(invited.email)).toBe(true);
    await expect(
      fresh.createOrganization(stranger.userId, {
        name: "X",
        type: "independent",
        disciplines: [],
        firstGroupName: "G",
      }),
    ).rejects.toMatchObject({ code: "signup_closed" });
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe("relance douce", () => {
  it("se désactive au niveau de l'espace, sans empêcher le passage en manquée", async () => {
    const org = await makeOrg("Calme");
    const ath = await addAthlete(org.organizationId, org.groupId, "Tina");
    await updateOrganization(org.owner.userId, org.organizationId, { name: "Calme", overdueReminders: false });
    await expect(
      updateOrganization(ath.userId, org.organizationId, { name: "Pirate", overdueReminders: true }),
    ).rejects.toMatchObject({ status: 403 });
    const exercise = await saveExercise(org.owner.userId, org.organizationId, { name: "Gainage", category: "warmup" });
    const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
      date: addDays(TODAY, -3),
      startTime: null,
      location: null,
      draft: draftWith(exercise.id),
      assignments: [{ targetType: "group", targetId: org.groupId }],
      overrides: [],
      publishAt: null,
    });
    await publishSession(org.owner.userId, org.organizationId, session.id);
    await closeOverdueSessions();
    expect(await prisma.sessionLog.count({ where: { athleteId: ath.athleteId, status: "missed" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: ath.userId, type: "session_reminder" } })).toBe(0);
  });
});

describe("blessures côté athlète", () => {
  it("l'athlète déclare les siennes, jamais celles d'un autre", async () => {
    await saveInjury(a.hugo.userId, a.organizationId, {
      athleteId: a.hugo.athleteId,
      bodyArea: "ankle",
      side: "right",
      startDate: TODAY,
      status: "active",
    });
    expect((await getMyFile(a.hugo.userId, a.organizationId)).injuries).toHaveLength(1);
    await expect(
      saveInjury(a.hugo.userId, a.organizationId, {
        athleteId: a.lea.athleteId,
        bodyArea: "ankle",
        side: "right",
        startDate: TODAY,
        status: "active",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("indicateurs du pilote", () => {
  it("calcule le taux de validation sur les séances passées, sans donnée de santé", async () => {
    const org = await makeOrg("Mesure");
    const done = await addAthlete(org.organizationId, org.groupId, "Fait");
    await addAthlete(org.organizationId, org.groupId, "Absent");
    const exercise = await saveExercise(org.owner.userId, org.organizationId, { name: "Sauts", category: "jump" });
    const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
      date: addDays(TODAY, -3),
      startTime: null,
      location: null,
      draft: draftWith(exercise.id),
      assignments: [{ targetType: "group", targetId: org.groupId }],
      overrides: [],
      publishAt: null,
    });
    await publishSession(org.owner.userId, org.organizationId, session.id);
    await logSession(done.userId, org.organizationId, session.id, {
      clientId: "client-mesure-1",
      status: "done",
      variantDone: "club",
      rpe: 8,
    });
    const metrics = await pilotMetrics(org.organizationId);
    expect(metrics.validationRatePct).toBe(50);
    expect(metrics.activeAthletesPct).toBe(50);
    expect(metrics.activationPct).toBe(50);
    expect(JSON.stringify(metrics)).not.toMatch(/rpe|pain/i);
  });
});

describe("suppression du compte", () => {
  it("supprime l'athlète et ses données, y compris ses contenus", async () => {
    const org = await makeOrg("Theo");
    const ath = await addAthlete(org.organizationId, org.groupId, "Partant");
    const exercise = await saveExercise(org.owner.userId, org.organizationId, { name: "Sauts", category: "jump" });
    const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
      date: TODAY,
      startTime: null,
      location: null,
      draft: draftWith(exercise.id),
      assignments: [{ targetType: "group", targetId: org.groupId }],
      overrides: [],
      publishAt: null,
    });
    await publishSession(org.owner.userId, org.organizationId, session.id);
    await logSession(ath.userId, org.organizationId, session.id, {
      clientId: "client-supp-1",
      status: "done",
      variantDone: "club",
    });
    await addComment(ath.userId, org.organizationId, {
      entityType: "session",
      entityId: session.id,
      body: "À supprimer",
    });
    await deleteAccount(ath.userId);
    expect(await prisma.user.findUnique({ where: { id: ath.userId } })).toBeNull();
    expect(await prisma.athlete.findUnique({ where: { id: ath.athleteId } })).toBeNull();
    expect(await prisma.sessionLog.count({ where: { athleteId: ath.athleteId } })).toBe(0);
    expect(await prisma.comment.count({ where: { authorId: ath.userId } })).toBe(0);
    expect(await prisma.consent.count({ where: { userId: ath.userId } })).toBe(0);
  });

  it("transmet l'espace au coach suivant, sinon le supprime", async () => {
    const org = await makeOrg("Solo");
    await deleteAccount(org.owner.userId);
    expect(await prisma.organization.findUnique({ where: { id: org.organizationId } })).toBeNull();
    const shared = await makeOrg("Duo");
    const coach = await addStaff(shared.organizationId, "Relais", "coach", [shared.groupId]);
    await deleteAccount(shared.owner.userId);
    const row = await prisma.organization.findUniqueOrThrow({ where: { id: shared.organizationId } });
    expect(row.ownerId).toBe(coach.userId);
  });
});
