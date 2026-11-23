import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { w } from "@tartan/i18n/web";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { flushEmailOutbox } from "@/server/email-outbox.service";
import { createInvitation } from "@/server/invitation.service";
import { queueFinishSignupEmails, queuePersonalActivationEmails } from "@/server/personal-email";
import { createPersonalSpace } from "@/server/personal-space.service";
import { makeOrg, makeUser } from "./helpers";

// Les e-mails de l'athlète autonome (docs/reference/emails.md, « Athlète autonome »).

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const t = w.personal.emails;
const signup = { firstName: "Noé", lastName: "Seul", termsAccepted: true as const };
const mailsTo = (email: string) => outbox.filter((mail) => mail.to === email);

beforeEach(() => {
  outbox.length = 0;
});

describe("bienvenue de l'athlète autonome", () => {
  it("part à l'ouverture de son espace, une seule fois, sans la bienvenue du coach", async () => {
    const user = await makeUser("Bienvenu");
    const space = await createPersonalSpace(user.userId, signup);
    expect(mailsTo(user.email).map((mail) => mail.subject)).toEqual([t.welcome.subject]);
    expect(mailsTo(user.email)[0]!.html).toContain(`/seances/nouvelle?espace=${space.organizationId}`);
    await createPersonalSpace(user.userId, signup);
    await flushEmailOutbox(new Date());
    expect(mailsTo(user.email)).toHaveLength(1);
  });
});

describe("conseils J1, J3, J7", () => {
  it("visent la prochaine étape, se revérifient à l'envoi, et se coupent avec les conseils", async () => {
    const user = await makeUser("Conseil");
    const space = await createPersonalSpace(user.userId, signup);
    await prisma.organization.update({
      where: { id: space.organizationId },
      data: { createdAt: new Date(Date.now() - 1.5 * DAY) },
    });
    outbox.length = 0;
    await queuePersonalActivationEmails(new Date());
    const queued = () =>
      prisma.emailOutbox.count({ where: { organizationId: space.organizationId, kind: "personal_activation" } });
    expect(await queued()).toBe(1);
    // Une seconde passe le même matin ne double rien.
    await queuePersonalActivationEmails(new Date());
    expect(await queued()).toBe(1);
    await flushEmailOutbox(new Date());
    const tip = mailsTo(user.email).at(-1);
    expect(tip?.subject).toBe(t.activation.steps.plan.subject);
    expect(tip?.headers["List-Unsubscribe"]).toBeTruthy();

    // J3 : l'athlète a coupé les conseils entre-temps, rien ne part.
    await prisma.organization.update({
      where: { id: space.organizationId },
      data: { createdAt: new Date(Date.now() - 4 * DAY) },
    });
    await prisma.profile.update({ where: { id: user.userId }, data: { emailTips: false } });
    outbox.length = 0;
    await queuePersonalActivationEmails(new Date());
    expect(await queued()).toBe(1);
    expect(mailsTo(user.email)).toHaveLength(0);
  });

  it("l'espace d'un coach ne reçoit jamais ces conseils", async () => {
    const coach = await makeOrg("PasPerso");
    await prisma.organization.update({
      where: { id: coach.organizationId },
      data: { createdAt: new Date(Date.now() - 1.5 * DAY) },
    });
    await queuePersonalActivationEmails(new Date());
    expect(
      await prisma.emailOutbox.count({ where: { organizationId: coach.organizationId, kind: "personal_activation" } }),
    ).toBe(0);
  });
});

describe("« Termine ton inscription »", () => {
  const aged = async (name: string, hours: number) => {
    const user = await makeUser(name);
    await prisma.user.update({ where: { id: user.userId }, data: { createdAt: new Date(Date.now() - hours * HOUR) } });
    return user;
  };
  const queuedFor = (userId: string) => prisma.emailOutbox.count({ where: { dedupeKey: `finish_signup:${userId}` } });

  it("une fois, 24 heures après, pour un compte sans espace ni invitation", async () => {
    const early = await aged("Tôt", 20);
    const due = await aged("Dû", 26);
    const late = await aged("Tard", 80);
    await queueFinishSignupEmails(new Date());
    await queueFinishSignupEmails(new Date());
    expect(await queuedFor(early.userId)).toBe(0);
    expect(await queuedFor(due.userId)).toBe(1);
    expect(await queuedFor(late.userId)).toBe(0);
    await flushEmailOutbox(new Date());
    expect(mailsTo(due.email).map((mail) => mail.subject)).toEqual([t.finishSignup.subject]);
    expect(mailsTo(due.email)[0]!.html).toContain("/bienvenue");
  });

  it("rien pour un compte qui a un espace ou une invitation ouverte, ni s'il en ouvre un avant l'envoi", async () => {
    const withSpace = await aged("Espace", 26);
    await createPersonalSpace(withSpace.userId, signup);
    const org = await makeOrg("Invite");
    const invited = await aged(`Invité${randomUUID().slice(0, 4)}`, 26);
    await createInvitation(org.owner.userId, org.organizationId, {
      kind: "personal_email",
      email: invited.email,
      groupIds: [org.groupId],
    });
    const later = await aged("Ensuite", 26);
    await queueFinishSignupEmails(new Date());
    expect(await queuedFor(withSpace.userId)).toBe(0);
    expect(await queuedFor(invited.userId)).toBe(0);
    expect(await queuedFor(later.userId)).toBe(1);
    await createPersonalSpace(later.userId, signup);
    outbox.length = 0;
    await flushEmailOutbox(new Date());
    expect(mailsTo(later.email).some((mail) => mail.subject === t.finishSignup.subject)).toBe(false);
  });
});
