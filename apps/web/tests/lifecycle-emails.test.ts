import { beforeEach, describe, expect, it } from "vitest";
import { m } from "@tartan/i18n";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { queuePlanLimitNotices, syncEntitlements } from "@/server/billing.service";
import { flushEmailOutbox } from "@/server/email-outbox.service";
import { applyUnsubscribe, getEmailPreferences, unsubscribeUrl } from "@/server/email-preferences.service";
import { createInvitation } from "@/server/invitation.service";
import { queueActivationEmails } from "@/server/lifecycle-email.service";
import { addAthlete, makeOrg } from "./helpers";

const DAY = 86_400_000;
const later = (minutes: number) => new Date(Date.now() + minutes * 60_000);

// Un espace créé il y a `days` jours, sans athlète ni séance, et l'adresse de son propriétaire.
const spaceAged = async (name: string, days: number) => {
  const org = await makeOrg(name);
  await prisma.organization.update({
    where: { id: org.organizationId },
    data: { createdAt: new Date(Date.now() - days * DAY) },
  });
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: org.owner.userId }, select: { email: true } });
  outbox.length = 0;
  return { ...org, email: owner.email };
};
const mailsTo = (email: string) => outbox.filter((mail) => mail.to === email);
const rowsOf = (organizationId: string, kind: string) =>
  prisma.emailOutbox.findMany({ where: { organizationId, kind } });

beforeEach(() => {
  outbox.length = 0;
});

describe("e-mails d'activation du coach", () => {
  it("le lendemain de la création, le coach sans athlète est invité à inviter, une seule fois", async () => {
    const space = await spaceAged("Activation", 1.2);
    await queueActivationEmails();
    await queueActivationEmails();
    expect(await rowsOf(space.organizationId, "activation")).toHaveLength(1);

    await flushEmailOutbox(later(1));
    const [mail] = mailsTo(space.email);
    expect(mail?.subject).toBe(m.email.activation.steps.invite.subject);
    expect(mail?.html).toContain("Coaching Activation");
    // Le conseil se coupe d'un clic depuis le client de messagerie.
    expect(mail?.headers["List-Unsubscribe"]).toBe(`<${unsubscribeUrl(space.owner.userId, "tips")}>`);
    expect(mail?.html).toContain(`espace=${space.organizationId}`);
  });

  it("le conseil ne part pas si le coach a fait l'étape entre-temps", async () => {
    const space = await spaceAged("Rapide", 1.2);
    await queueActivationEmails();
    await createInvitation(space.owner.userId, space.organizationId, {
      kind: "group_link",
      role: "athlete",
      groupIds: [space.groupId],
    });

    await flushEmailOutbox(later(1));
    expect(mailsTo(space.email)).toHaveLength(0);
    const [row] = await rowsOf(space.organizationId, "activation");
    expect(row?.failureCode).toBe("obsolete");
  });

  it("le jour même et après dix jours, rien n'est mis en file", async () => {
    const fresh = await spaceAged("Neuf", 0.3);
    const old = await spaceAged("Ancien", 12);
    await queueActivationEmails();
    expect(await rowsOf(fresh.organizationId, "activation")).toHaveLength(0);
    expect(await rowsOf(old.organizationId, "activation")).toHaveLength(0);
  });

  it("un coach qui a coupé les conseils n'en reçoit plus, même déjà en file", async () => {
    const off = await spaceAged("Coupé", 3.2);
    await prisma.profile.update({ where: { id: off.owner.userId }, data: { emailTips: false } });
    await queueActivationEmails();
    expect(await rowsOf(off.organizationId, "activation")).toHaveLength(0);

    const late = await spaceAged("Tardif", 3.2);
    await queueActivationEmails();
    const token = unsubscribeUrl(late.owner.userId, "tips").split("/").at(-1)!;
    await applyUnsubscribe("tips", token);
    expect((await getEmailPreferences(late.owner.userId)).tips).toBe(false);

    await flushEmailOutbox(later(1));
    expect(mailsTo(late.email)).toHaveLength(0);
  });

  it("au troisième rappel, l'e-mail propose de répondre pour être aidé", async () => {
    const space = await spaceAged("Septième", 7.4);
    await queueActivationEmails();
    await flushEmailOutbox(later(1));
    expect(mailsTo(space.email)[0]?.text).toContain(m.email.activation.help);
  });
});

describe("plafond d'offre proche", () => {
  const discovery = async (name: string, athletes: number) => {
    const org = await makeOrg(name);
    await prisma.organization.update({ where: { id: org.organizationId }, data: { plan: "discovery" } });
    await syncEntitlements(org.organizationId, "discovery");
    for (let index = 0; index < athletes; index += 1) await addAthlete(org.organizationId, org.groupId, `A${index}`);
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: org.owner.userId }, select: { email: true } });
    outbox.length = 0;
    return { ...org, email: owner.email };
  };

  it("prévient le payeur à quatre athlètes sur cinq, une seule fois", async () => {
    const space = await discovery("Presque", 4);
    await queuePlanLimitNotices();
    await queuePlanLimitNotices();
    expect(await rowsOf(space.organizationId, "plan_near_limit")).toHaveLength(1);

    await flushEmailOutbox(later(1));
    const [mail] = mailsTo(space.email);
    expect(mail?.subject).toBe(m.email.nearLimit.maxAthletes.subject);
    expect(mail?.text).toContain("4 athlètes sur les 5");
  });

  it("ne prévient ni loin du plafond, ni une fois atteint, ni en offre sans limite", async () => {
    const far = await discovery("Loin", 2);
    const full = await discovery("Complet", 5);
    const pilot = await makeOrg("Pilote");
    for (let index = 0; index < 4; index += 1) await addAthlete(pilot.organizationId, pilot.groupId, `P${index}`);
    await queuePlanLimitNotices();
    for (const space of [far, full, pilot])
      expect(await rowsOf(space.organizationId, "plan_near_limit")).toHaveLength(0);
  });
});
