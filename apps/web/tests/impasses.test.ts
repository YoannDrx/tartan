import { beforeEach, describe, expect, it } from "vitest";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { POST as createOrgRoute } from "../app/api/v1/orgs/route";
import { auth } from "@/lib/auth";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { deleteAccount } from "@/server/account.service";
import { acceptInvitation, createInvitation, invitationConflictMessage } from "@/server/invitation.service";
import { createOrganization } from "@/server/org.service";
import { makeOrg, makeUser } from "./helpers";
import { sessionCookie } from "./personas";

// Les impasses relevées le 23 novembre 2026 (docs/plans/athlete-autonome.md, § 1) : chaque test échouait avant.

const ORIGIN = "http://localhost:3000";
const tokenOf = (link: string) => link.split("/").at(-1)!;
const accept = {
  firstName: "Autre",
  lastName: "Nom",
  birthDate: "2000-01-01",
  consents: { terms: true, health: false, video: false },
};
const signUp = (body: unknown, headers: Record<string, string> = {}) =>
  auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: ORIGIN, ...headers },
      body: JSON.stringify(body),
    }),
  );
const lastMailTo = (email: string) => outbox.filter((mail) => mail.to === email).at(-1);

beforeEach(() => {
  outbox.length = 0;
});

describe("compte existant qui s'inscrit depuis une invitation", () => {
  it("l'e-mail account_exists ramène à l'invitation d'où partait l'inscription", async () => {
    const org = await makeOrg("Retour");
    const existing = await makeUser("Déjà");
    const { link } = await createInvitation(org.owner.userId, org.organizationId, {
      kind: "group_link",
      groupIds: [org.groupId],
    });
    const path = `/i/${tokenOf(link)}`;
    const res = await signUp(
      { email: existing.email, password: "un-mot-de-passe-solide", name: "x", callbackURL: path },
      { "x-tartan-return": path },
    );
    expect(res.status).toBe(200);
    const mail = lastMailTo(existing.email);
    expect(mail?.subject).toBe(w.auth.emails.accountExists.subject);
    expect(mail?.html).toContain(`/connexion?next=${encodeURIComponent(path)}`);
    expect(mail?.html).toContain(w.auth.emails.accountExists.ctaInvitation);
  });

  it("sans en-tête, une invitation nominative encore ouverte à cette adresse en tient lieu", async () => {
    const org = await makeOrg("Nominative");
    const existing = await makeUser("Invitée");
    const { link } = await createInvitation(org.owner.userId, org.organizationId, {
      kind: "personal_email",
      email: existing.email,
      groupIds: [org.groupId],
    });
    outbox.length = 0;
    await signUp({ email: existing.email, password: "un-mot-de-passe-solide", name: "x" });
    expect(lastMailTo(existing.email)?.html).toContain(encodeURIComponent(`/i/${tokenOf(link)}`));
  });

  it("un chemin étranger posé dans l'en-tête est ignoré : l'e-mail mène à la connexion", async () => {
    const existing = await makeUser("Prudente");
    await signUp(
      { email: existing.email, password: "un-mot-de-passe-solide", name: "x" },
      { "x-tartan-return": "https://ailleurs.example/i/aaaaaaaaaaaaaaaaaaaa" },
    );
    const mail = lastMailTo(existing.email);
    expect(mail?.html).toContain(`${ORIGIN}/connexion"`);
    expect(mail?.html).not.toContain("ailleurs.example");
  });
});

describe("invitation nominative ouverte avec un autre compte", () => {
  it("le refus est connu avant le formulaire, et son texte vient de packages/i18n", async () => {
    const org = await makeOrg("Adresse");
    const invited = `invite-${Date.now()}@test.tartan.coach`;
    const { link } = await createInvitation(org.owner.userId, org.organizationId, {
      kind: "personal_email",
      email: invited,
      groupIds: [org.groupId],
    });
    const other = await makeUser("Mauvaise");
    await expect(invitationConflictMessage(tokenOf(link), other)).resolves.toBe(m.invite.wrongAccount);
    await expect(acceptInvitation(other, tokenOf(link), accept)).rejects.toMatchObject({
      status: 403,
      code: "wrong_account",
      message: m.invite.wrongAccount,
    });
  });
});

describe("acceptation d'une invitation par un compte qui a déjà un nom", () => {
  it("le nom du compte reste le sien ; la fiche de l'espace prend ce qui a été saisi", async () => {
    const org = await makeOrg("Nom");
    const user = await makeUser("Léa");
    const { link } = await createInvitation(org.owner.userId, org.organizationId, {
      kind: "group_link",
      groupIds: [org.groupId],
    });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.userId }, select: { name: true } });
    const res = await acceptInvitation(user, tokenOf(link), accept);
    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: user.userId } });
    expect(profile).toMatchObject({ firstName: "Léa", lastName: "Test" });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.userId }, select: { name: true } })).toEqual(before);
    expect(await prisma.athlete.findUniqueOrThrow({ where: { id: res.athleteId! } })).toMatchObject({
      firstName: "Autre",
      lastName: "Nom",
    });
  });

  it("un compte sans nom le reçoit de l'invitation", async () => {
    const org = await makeOrg("SansNom");
    const user = await makeUser("Vide");
    await prisma.profile.update({ where: { id: user.userId }, data: { firstName: null, lastName: null } });
    const { link } = await createInvitation(org.owner.userId, org.organizationId, {
      kind: "group_link",
      groupIds: [org.groupId],
    });
    await acceptInvitation(user, tokenOf(link), accept);
    expect(await prisma.profile.findUniqueOrThrow({ where: { id: user.userId } })).toMatchObject({
      firstName: "Autre",
      lastName: "Nom",
    });
  });
});

describe("création d'un espace par l'API du mobile", () => {
  const body = { name: "Coaching Mobile", type: "independent" as const, firstGroupName: "Groupe", termsAccepted: true };

  it("POST /api/v1/orgs enregistre les conditions acceptées, comme l'action du web", async () => {
    const user = await makeUser("Mobile");
    const res = await createOrgRoute(
      new Request(`${ORIGIN}/api/v1/orgs`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: await sessionCookie(user.email), origin: ORIGIN },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);
    const terms = await prisma.consent.findFirst({ where: { userId: user.userId, kind: "terms" } });
    expect(terms?.grantedAt).toBeTruthy();
  });

  it("l'app en circulation, qui n'envoie pas le champ, crée toujours son espace", async () => {
    const user = await makeUser("Ancienne");
    const org = await createOrganization(user.userId, { ...body, termsAccepted: undefined });
    expect(org.id).toBeTruthy();
  });
});

describe("compte sans espace", () => {
  it("se supprime sans avoir rejoint aucun espace", async () => {
    const user = await makeUser("Seul");
    expect(await prisma.organizationMember.count({ where: { userId: user.userId } })).toBe(0);
    await deleteAccount(user.userId);
    expect(await prisma.user.findUnique({ where: { id: user.userId } })).toBeNull();
  });
});
