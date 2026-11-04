import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MagicLinkEmail } from "@email/auth";
import { outbox, sendEmail } from "@/lib/mail";

const send = (extra: { unsubscribeUrl?: string } = {}) => {
  const to = `socle-${Math.random()}@test.tartan.coach`;
  return sendEmail({
    to,
    subject: "Essai",
    react: createElement(MagicLinkEmail, { url: "https://app.tartan.coach/lien" }),
    ...extra,
  }).then(() => outbox.find((mail) => mail.to === to)!);
};

afterEach(() => vi.unstubAllEnvs());

describe("socle e-mail", () => {
  it("le pied de page nomme l'éditeur", async () => {
    const mail = await send();
    expect(mail.html).toContain("SIREN 803 272 590");
    expect(mail.html).toContain("https://tartan.coach/mentions-legales");
    expect(mail.html).toContain("https://tartan.coach/confidentialite");
  });
  it("une version texte accompagne chaque message", async () => {
    const mail = await send();
    expect(mail.text.trim().length).toBeGreaterThan(20);
    expect(mail.text).toContain("https://app.tartan.coach/lien");
    expect(mail.text).not.toContain("<table");
  });
  it("les en-têtes de désinscription n'existent que si une adresse est fournie", async () => {
    expect((await send()).headers).toEqual({});
    const url = "https://app.tartan.coach/api/email/desinscription/digest/jeton";
    expect((await send({ unsubscribeUrl: url })).headers).toEqual({
      "List-Unsubscribe": `<${url}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });
  it("une clé absente en production Vercel est une erreur, pas un succès", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(send()).rejects.toThrow("email_unconfigured");
  });
});
