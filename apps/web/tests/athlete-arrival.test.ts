import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { m } from "@tartan/i18n";
import { todayIso } from "@/lib/dates";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { getAthleteWelcome, logSession } from "@/server/athlete-view.service";
import { queueInvitationReminders } from "@/server/athlete-email";
import { flushEmailOutbox } from "@/server/email-outbox.service";
import {
  applyUnsubscribe,
  invitationOptOutPageUrl,
  invitationOptOutUrl,
  isValidUnsubscribe,
} from "@/server/email-preferences.service";
import { assertEmailDeliverable } from "@/server/email-suppression.service";
import { saveExercise } from "@/server/exercise.service";
import { acceptInvitation, createInvitation, groupInvitationLink } from "@/server/invitation.service";
import { publishSession, saveScheduledSession } from "@/server/session.service";
import { addAthlete, makeOrg, makeUser } from "./helpers";

const DAY = 86_400_000;
const later = (minutes: number) => new Date(Date.now() + minutes * 60_000);
const address = (name: string) => `${name}-${randomUUID()}@test.tartan.coach`;
const accept = {
  firstName: "Léa",
  lastName: "Arrivante",
  birthDate: "2000-01-01",
  consents: { terms: true, health: false, video: false },
};
const tokenOf = (link: string) => link.split("/").at(-1)!;
const mailsTo = (email: string) => outbox.filter((mail) => mail.to === email);
const invite = (org: Awaited<ReturnType<typeof makeOrg>>, email: string) =>
  createInvitation(org.owner.userId, org.organizationId, {
    kind: "personal_email",
    role: "athlete",
    email,
    groupIds: [org.groupId],
  });
// Une invitation dont la dernière action remonte à `days` jours.
const ageInvitation = (id: string, days: number) =>
  prisma.$executeRaw`UPDATE invitations SET updated_at = ${new Date(Date.now() - days * DAY)} WHERE id = ${id}::uuid`;

beforeEach(() => {
  outbox.length = 0;
});

describe("bienvenue de l'athlète", () => {
  it("part une fois, à l'adresse du compte qui a rejoint, avec le nom du groupe et du coach", async () => {
    const org = await makeOrg("Accueil");
    const user = await makeUser("Léa");
    const group = await groupInvitationLink(org.owner.userId, org.organizationId, org.groupId);
    outbox.length = 0;

    await acceptInvitation(user, tokenOf(group.link), accept);
    const [mail] = mailsTo(user.email);
    expect(mail?.subject).toBe(m.email.athleteWelcome.subject("Hauteur Élite"));
    expect(mail?.text).toContain("Accueil");
    expect(mail?.html).toContain(`espace=${org.organizationId}`);

    // Rouvrir le lien du groupe ne renvoie pas de bienvenue.
    await acceptInvitation(user, tokenOf(group.link), accept);
    expect(mailsTo(user.email)).toHaveLength(1);
  });

  it("ne part pas pour un coach invité", async () => {
    const org = await makeOrg("Encadrant");
    const coach = await makeUser("Adjoint");
    const invitation = await createInvitation(org.owner.userId, org.organizationId, {
      kind: "qr",
      role: "coach",
      groupIds: [org.groupId],
    });
    outbox.length = 0;
    await acceptInvitation(coach, tokenOf(invitation.link), accept);
    expect(mailsTo(coach.email)).toHaveLength(0);
  });
});

describe("accueil sur la page de l'athlète", () => {
  it("nomme le groupe et le coach pendant la première semaine, puis s'efface", async () => {
    const org = await makeOrg("Semaine");
    const athlete = await addAthlete(org.organizationId, org.groupId, "Tom");
    expect(await getAthleteWelcome(athlete.userId, org.organizationId)).toEqual({
      group: "Hauteur Élite",
      coach: "Semaine",
    });
    expect(await getAthleteWelcome(athlete.userId, org.organizationId, new Date(Date.now() + 8 * DAY))).toBeNull();
  });

  it("s'efface dès la première séance validée", async () => {
    const org = await makeOrg("Validée");
    const athlete = await addAthlete(org.organizationId, org.groupId, "Zoé");
    const exercise = await saveExercise(org.owner.userId, org.organizationId, { name: "Bonds", category: "plyo" });
    const session = await saveScheduledSession(org.owner.userId, org.organizationId, {
      date: todayIso(),
      startTime: null,
      location: null,
      draft: {
        title: "Pliométrie",
        type: "strength" as const,
        durationMin: 45,
        coachNote: null,
        blocks: [
          {
            name: "Corps de séance",
            variant: "club" as const,
            items: [{ exerciseId: exercise.id, prescription: { sets: 3, reps: 5 } }],
          },
        ],
      },
      assignments: [{ targetType: "group", targetId: org.groupId }],
      overrides: [],
      publishAt: null,
    });
    await publishSession(org.owner.userId, org.organizationId, session.id);
    expect(await getAthleteWelcome(athlete.userId, org.organizationId)).not.toBeNull();

    await logSession(athlete.userId, org.organizationId, session.id, {
      clientId: `arrivee-${randomUUID()}`,
      status: "done",
      variantDone: "club",
    });
    expect(await getAthleteWelcome(athlete.userId, org.organizationId)).toBeNull();
  });
});

describe("rappel d'invitation", () => {
  it("part une seule fois, trois jours après une invitation nominative sans réponse", async () => {
    const org = await makeOrg("Rappel");
    const email = address("rappel");
    const { id } = await invite(org, email);
    await ageInvitation(id, 3.4);
    outbox.length = 0;

    await queueInvitationReminders();
    await queueInvitationReminders();
    expect(await prisma.emailOutbox.count({ where: { toEmail: email, kind: "invitation_reminder" } })).toBe(1);

    await flushEmailOutbox(later(1));
    const [mail] = mailsTo(email);
    expect(mail?.subject).toBe(m.email.invitationReminder.subject("Rappel Test", "Hauteur Élite"));
    expect(mail?.headers["List-Unsubscribe"]).toBe(`<${invitationOptOutUrl(id)}>`);
    expect(mail?.html).toContain(invitationOptOutPageUrl(id));
  });

  it("ne part ni trop tôt, ni pour un lien de groupe, ni une fois l'invitation acceptée", async () => {
    const org = await makeOrg("Silence");
    const early = address("tot");
    await invite(org, early);
    const group = await groupInvitationLink(org.owner.userId, org.organizationId, org.groupId);
    await ageInvitation(group.id, 3.4);

    // Une invitation nominative ne s'accepte qu'avec l'adresse invitée.
    const user = await makeUser("Vite");
    const answered = user.email;
    const nominal = await invite(org, answered);
    await ageInvitation(nominal.id, 3.4);
    await queueInvitationReminders();
    await acceptInvitation(user, tokenOf(nominal.link), accept);
    outbox.length = 0;

    await flushEmailOutbox(later(1));
    expect(mailsTo(early)).toHaveLength(0);
    expect(mailsTo(answered)).toHaveLength(0);
    const kinds = await prisma.emailOutbox.findMany({ where: { kind: "invitation_reminder", toEmail: answered } });
    expect(kinds.map((row) => row.failureCode)).toEqual(["obsolete"]);
    expect(await prisma.emailOutbox.count({ where: { kind: "invitation_reminder", toEmail: early } })).toBe(0);
  });

  it("la personne invitée peut refuser tout e-mail, sans perdre l'accès à un futur compte", async () => {
    const org = await makeOrg("Refus");
    const email = address("refus");
    const { id } = await invite(org, email);
    const token = tokenOf(invitationOptOutUrl(id));
    expect(isValidUnsubscribe("invitation", token)).toBe(true);
    expect(isValidUnsubscribe("digest", token)).toBe(false);

    await applyUnsubscribe("invitation", token);
    await expect(assertEmailDeliverable(email, "invitation")).rejects.toThrow("email_suppressed");
    await expect(assertEmailDeliverable(email, "security")).resolves.toBeUndefined();

    // Une nouvelle invitation à cette adresse ne part plus.
    outbox.length = 0;
    await invite(org, email);
    expect(mailsTo(email)).toHaveLength(0);
  });
});
