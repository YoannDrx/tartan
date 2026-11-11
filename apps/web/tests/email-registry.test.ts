import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { m } from "@tartan/i18n";
import { emailCatalog } from "@email/catalog";
import { MagicLinkEmail } from "@email/auth";
import * as mail from "@/lib/mail";
import { outbox, sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { flushEmailOutbox } from "@/server/email-outbox.service";
import { EMAIL_KEYS, EMAILS, categoryOf, emailForOutboxKind, isBlockedBy } from "@/server/email-registry";
import { assertEmailDeliverable, suppressEmail } from "@/server/email-suppression.service";
import { createInvitation, resendInvitation, revokeInvitation } from "@/server/invitation.service";
import { makeOrg } from "./helpers";

const later = (minutes: number) => new Date(Date.now() + minutes * 60_000);
const address = (name: string) => `${name}-${randomUUID()}@test.tartan.coach`;
const react = createElement(MagicLinkEmail, { url: "https://app.tartan.coach/lien" });

beforeEach(() => {
  outbox.length = 0;
});
afterEach(() => vi.restoreAllMocks());

describe("registre des e-mails", () => {
  it("le catalogue d'essai couvre chaque e-mail du registre, et rien d'autre", () => {
    const samples = emailCatalog("https://app.tartan.coach").map((sample) => sample.key);
    expect([...samples].sort()).toEqual([...EMAIL_KEYS].sort());
  });

  it("docs/reference/emails.md décrit chaque e-mail du registre", () => {
    const doc = readFileSync(path.resolve(import.meta.dirname, "../../../docs/reference/emails.md"), "utf8");
    const missing = EMAIL_KEYS.filter((key) => !doc.includes(`\`${key}\``));
    expect(missing).toEqual([]);
  });

  it("chaque genre de la file renvoie à un seul e-mail", () => {
    const kinds = EMAIL_KEYS.flatMap((key) => {
      const definition: { outbox?: string } = EMAILS[key];
      return definition.outbox ? [definition.outbox] : [];
    });
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(emailForOutboxKind("started")).toBe("subscription_started");
    expect(emailForOutboxKind("genre_inconnu")).toBeNull();
  });

  it("seuls la connexion et la protection du compte sont en catégorie sécurité", () => {
    const security = EMAIL_KEYS.filter((key) => categoryOf(key) === "security");
    expect(security.sort()).toEqual(["magic_link", "password_changed", "reset_password", "verify"]);
  });
});

describe("liste de blocage par catégorie", () => {
  it("un rebond bloque tout, une plainte ou une désinscription épargne la sécurité", () => {
    expect(isBlockedBy("security", "bounce")).toBe(true);
    expect(isBlockedBy("security", "complaint")).toBe(false);
    expect(isBlockedBy("security", "suppressed")).toBe(false);
    for (const category of ["invitation", "billing", "account", "activity", "internal"] as const) {
      expect(isBlockedBy(category, "complaint")).toBe(true);
      expect(isBlockedBy(category, "suppressed")).toBe(true);
    }
  });

  it("après une plainte, le résumé ne part plus mais le lien de connexion part toujours", async () => {
    const to = address("plainte");
    await suppressEmail(to, "complaint");
    await expect(sendEmail({ kind: "weekly_digest", to, subject: "Résumé", react })).rejects.toThrow(
      "email_suppressed",
    );
    await sendEmail({ kind: "magic_link", to, subject: m.email.subjects.magicLink, react });
    expect(outbox.filter((entry) => entry.to === to).map((entry) => entry.subject)).toEqual([
      m.email.subjects.magicLink,
    ]);
  });

  it("un rebond définitif l'emporte sur une plainte déjà notée", async () => {
    const to = address("rebond");
    await suppressEmail(to, "complaint");
    await expect(assertEmailDeliverable(to, "security")).resolves.toBeUndefined();
    await suppressEmail(to, "bounce");
    await expect(assertEmailDeliverable(to, "security")).rejects.toThrow("email_suppressed");
    // Une plainte reçue ensuite ne ressuscite pas l'adresse.
    await suppressEmail(to, "complaint");
    await expect(assertEmailDeliverable(to, "security")).rejects.toThrow("email_suppressed");
  });
});

describe("invitation par la file", () => {
  const invite = async (name: string) => {
    const org = await makeOrg(name);
    const email = address("invite");
    outbox.length = 0;
    return { org, email };
  };
  const create = (org: Awaited<ReturnType<typeof makeOrg>>, email: string) =>
    createInvitation(org.owner.userId, org.organizationId, {
      kind: "personal_email",
      role: "athlete",
      email,
      groupIds: [org.groupId],
    });
  const rowsFor = (email: string) => prisma.emailOutbox.findMany({ where: { toEmail: email } });

  it("part tout de suite, sans jamais écrire le lien dans la file", async () => {
    const { org, email } = await invite("Envoi");
    const { link } = await create(org, email);
    const [sent] = outbox.filter((entry) => entry.to === email);
    expect(sent?.subject).toContain("t'invite à rejoindre");
    expect(sent?.html).toContain(link);

    const [row] = await rowsFor(email);
    expect(row?.kind).toBe("invitation_athlete");
    expect(row?.sentAt).not.toBeNull();
    expect(JSON.stringify(row?.payload)).not.toContain("/i/");
    expect(JSON.stringify(row?.payload)).not.toContain(link.split("/").at(-1));
  });

  it("une panne d'envoi ne fait pas échouer l'invitation, et la file la reprend", async () => {
    const { org, email } = await invite("Panne");
    const sending = vi.spyOn(mail, "sendEmail").mockRejectedValueOnce(new Error("email_failed"));
    await expect(create(org, email)).resolves.toMatchObject({ link: expect.stringContaining("/i/") });
    expect(outbox.filter((entry) => entry.to === email)).toHaveLength(0);
    sending.mockRestore();

    await flushEmailOutbox(later(6));
    expect(outbox.filter((entry) => entry.to === email)).toHaveLength(1);
  });

  it("une invitation révoquée entre-temps ne part plus", async () => {
    const { org, email } = await invite("Révoquée");
    const sending = vi.spyOn(mail, "sendEmail").mockRejectedValueOnce(new Error("email_failed"));
    const { id } = await create(org, email);
    sending.mockRestore();
    await revokeInvitation(org.owner.userId, org.organizationId, id);

    await flushEmailOutbox(later(6));
    expect(outbox.filter((entry) => entry.to === email)).toHaveLength(0);
    const [row] = await rowsFor(email);
    expect(row?.failureCode).toBe("obsolete");
  });

  it("un renvoi voulu par le coach donne un second e-mail", async () => {
    const { org, email } = await invite("Renvoi");
    const { id } = await create(org, email);
    await resendInvitation(org.owner.userId, org.organizationId, id);
    expect(outbox.filter((entry) => entry.to === email)).toHaveLength(2);
  });
});

describe("genre inconnu dans la file", () => {
  it("est marqué en échec au lieu de partir sous un autre gabarit", async () => {
    const org = await makeOrg("Inconnu");
    const to = address("inconnu");
    const dedupeKey = `inconnu:${randomUUID()}`;
    await prisma.emailOutbox.create({
      data: { organizationId: org.organizationId, toEmail: to, kind: "genre_retire", dedupeKey, payload: {} },
    });
    await flushEmailOutbox(later(1), { dedupeKey });
    expect(outbox.filter((entry) => entry.to === to)).toHaveLength(0);
    const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { dedupeKey } });
    expect(row.failureCode).toBe("unknown_kind");
  });
});
