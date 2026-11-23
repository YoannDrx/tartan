import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { todayIso } from "@/lib/dates";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { logSession } from "@/server/athlete-view.service";
import {
  getSharedHistory,
  historyShareOffered,
  listMyHistoryShares,
  revokeHistoryShare,
  shareHistory,
} from "@/server/history-share.service";
import { acceptInvitation, createInvitation } from "@/server/invitation.service";
import { createPersonalSpace } from "@/server/personal-space.service";
import { publishSession, saveScheduledSession } from "@/server/session.service";
import { addStrengthTest } from "@/server/strength.service";
import { addStaff, makeOrg, makeUser } from "./helpers";

// Le partage de l'historique personnel avec un coach (AA2) : lecture seule, révocation immédiate, santé jamais
// visible, droits existants de l'espace du coach, coach d'un autre espace refusé.

const HEALTH = "DOULEUR-SENTINELLE";

const world = async () => {
  const coachSpace = await makeOrg("Partage");
  const user = await makeUser("Solène");
  const personal = await createPersonalSpace(user.userId, {
    firstName: "Solène",
    lastName: "Seule",
    termsAccepted: true,
    consents: { health: true, video: false },
  });
  // Son historique personnel : une séance validée avec effort ressenti et douleur, un test de force, un record.
  const [exercise] = await prisma.exercise.findMany({ where: { organizationId: personal.organizationId }, take: 1 });
  const session = await saveScheduledSession(user.userId, personal.organizationId, {
    date: todayIso(),
    publishAt: null,
    startTime: null,
    location: null,
    assignments: [],
    overrides: [],
    draft: {
      title: "Séance perso",
      type: "strength",
      durationMin: 30,
      coachNote: null,
      blocks: [
        { name: "Force", variant: "club", items: [{ exerciseId: exercise!.id, prescription: { sets: 3, reps: 5 } }] },
      ],
    },
  });
  await publishSession(user.userId, personal.organizationId, session.id);
  await logSession(user.userId, personal.organizationId, session.id, {
    clientId: `perso-${randomUUID()}`,
    status: "done",
    variantDone: "club",
    rpe: 9,
    comment: HEALTH,
  } as never);
  await addStrengthTest(user.userId, personal.organizationId, {
    athleteId: personal.athleteId,
    exerciseKey: "squat",
    value: 120,
    kind: "one_rm",
    date: todayIso(),
  });
  await prisma.performance.create({
    data: {
      organizationId: personal.organizationId,
      athleteId: personal.athleteId,
      discipline: "100 m",
      mark: 11.9,
      unit: "s",
      date: new Date(`${todayIso()}T00:00:00Z`),
      isPb: true,
    },
  });
  await prisma.injury.create({
    data: {
      organizationId: personal.organizationId,
      athleteId: personal.athleteId,
      bodyArea: "knee",
      startDate: new Date(),
      description: HEALTH,
    },
  });
  // Il rejoint ensuite le groupe d'un coach.
  const { link } = await createInvitation(coachSpace.owner.userId, coachSpace.organizationId, {
    kind: "group_link",
    groupIds: [coachSpace.groupId],
  });
  const joined = await acceptInvitation(user, link.split("/").at(-1)!, {
    firstName: "Solène",
    lastName: "Seule",
    birthDate: null,
    consents: { terms: true, health: false, video: false },
  });
  return { coachSpace, user, personal, athleteId: joined.athleteId! };
};

beforeEach(() => {
  outbox.length = 0;
});

describe("partage de l'historique personnel", () => {
  it("est proposé à l'arrivée, puis le coach lit en lecture seule les seules cases partagées, jamais la santé", async () => {
    const w = await world();
    expect(await historyShareOffered(w.user.userId, w.coachSpace.organizationId)).toBe(true);
    expect(await getSharedHistory(w.coachSpace.owner.userId, w.coachSpace.organizationId, w.athleteId)).toBeNull();

    await shareHistory(w.user.userId, { organizationId: w.coachSpace.organizationId, scopes: ["records", "sessions"] });
    expect(await historyShareOffered(w.user.userId, w.coachSpace.organizationId)).toBe(false);
    // Le coach est prévenu par e-mail, sans chiffre ni santé.
    const mail = outbox.find((sent) => sent.to === w.coachSpace.owner.email);
    expect(mail?.html).not.toContain(HEALTH);
    expect(mail?.html).not.toContain("11,9");

    const performancesBefore = await prisma.performance.count({
      where: { organizationId: w.coachSpace.organizationId },
    });
    const history = await getSharedHistory(w.coachSpace.owner.userId, w.coachSpace.organizationId, w.athleteId);
    expect(history).toMatchObject({
      scopes: ["records", "sessions"],
      records: [expect.objectContaining({ discipline: "100 m", mark: 11.9, isPb: true })],
      sessions: [expect.objectContaining({ title: "Séance perso", status: "done" })],
    });
    expect(history?.strength).toBeUndefined();
    const text = JSON.stringify(history);
    expect(text).not.toContain(HEALTH);
    expect(text).not.toContain("rpe");
    // Rien n'est copié dans l'espace du coach ; la lecture est tracée.
    expect(await prisma.performance.count({ where: { organizationId: w.coachSpace.organizationId } })).toBe(
      performancesBefore,
    );
    expect(
      await prisma.auditLog.count({
        where: { organizationId: w.coachSpace.organizationId, action: "history_share_read", entityId: w.athleteId },
      }),
    ).toBe(1);
    expect(await listMyHistoryShares(w.user.userId)).toEqual([
      expect.objectContaining({ organizationId: w.coachSpace.organizationId, scopes: ["records", "sessions"] }),
    ]);
  });

  it("le retrait est immédiat, et se resserrer ne prévient pas le coach", async () => {
    const w = await world();
    await shareHistory(w.user.userId, {
      organizationId: w.coachSpace.organizationId,
      scopes: ["records", "strength", "sessions"],
    });
    outbox.length = 0;
    await shareHistory(w.user.userId, { organizationId: w.coachSpace.organizationId, scopes: ["strength"] });
    expect(outbox).toHaveLength(0);
    expect(
      (await getSharedHistory(w.coachSpace.owner.userId, w.coachSpace.organizationId, w.athleteId))?.strength,
    ).toEqual([expect.objectContaining({ value: 120, kind: "one_rm" })]);
    await revokeHistoryShare(w.user.userId, w.coachSpace.organizationId);
    expect(await getSharedHistory(w.coachSpace.owner.userId, w.coachSpace.organizationId, w.athleteId)).toBeNull();
    expect(await listMyHistoryShares(w.user.userId)).toEqual([]);
  });

  it("suit les droits de l'espace du coach : son coach lit, un autre groupe ou un autre espace est refusé", async () => {
    const w = await world();
    await shareHistory(w.user.userId, { organizationId: w.coachSpace.organizationId, scopes: ["records"] });
    const groupCoach = await addStaff(w.coachSpace.organizationId, "Coach", "coach", [w.coachSpace.groupId]);
    expect(await getSharedHistory(groupCoach.userId, w.coachSpace.organizationId, w.athleteId)).not.toBeNull();
    const elsewhere = await prisma.group.create({
      data: { organizationId: w.coachSpace.organizationId, name: "Autre groupe" },
    });
    const otherCoach = await addStaff(w.coachSpace.organizationId, "Ailleurs", "coach", [elsewhere.id]);
    await expect(getSharedHistory(otherCoach.userId, w.coachSpace.organizationId, w.athleteId)).rejects.toMatchObject({
      status: 403,
    });
    const stranger = await makeOrg("Étranger");
    await expect(
      getSharedHistory(stranger.owner.userId, w.coachSpace.organizationId, w.athleteId),
    ).rejects.toMatchObject({ status: 403 });
    // Un coach d'un autre espace ne lit pas non plus par son propre espace : le partage vise un seul espace.
    await expect(getSharedHistory(stranger.owner.userId, stranger.organizationId, w.athleteId)).rejects.toMatchObject({
      status: 404,
    });
    // L'athlète lui-même n'emprunte pas ce chemin.
    await expect(getSharedHistory(w.user.userId, w.coachSpace.organizationId, w.athleteId)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("ne se partage que vers l'espace d'un coach dont il est athlète ; quitter l'espace emporte le partage", async () => {
    const w = await world();
    await expect(
      shareHistory(w.coachSpace.owner.userId, { organizationId: w.coachSpace.organizationId, scopes: ["records"] }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      shareHistory(w.user.userId, { organizationId: w.personal.organizationId, scopes: ["records"] }),
    ).rejects.toMatchObject({ status: 400 });
    await shareHistory(w.user.userId, { organizationId: w.coachSpace.organizationId, scopes: ["records"] });
    await prisma.athlete.delete({ where: { id: w.athleteId } });
    expect(await prisma.historyShare.count({ where: { userId: w.user.userId } })).toBe(0);
  });
});
