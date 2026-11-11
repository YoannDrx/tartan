import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MagicLinkEmail, NotificationEmail, ResetPasswordEmail, VerifyEmail } from "@email/auth";
import { outbox, sendEmail } from "@/lib/mail";
import { getEmailPreferences, isValidUnsubscribe, unsubscribeUrl } from "@/server/email-preferences.service";
import { POST } from "../app/api/email/desinscription/[kind]/[token]/route";
import { makeUser } from "./helpers";

const send = (extra: { unsubscribeUrl?: string } = {}) => {
  const to = `socle-${Math.random()}@test.tartan.coach`;
  return sendEmail({
    kind: "magic_link",
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
    expect(mail.html).toContain("Yodev, entreprise individuelle");
    expect(mail.html).not.toContain("Andrieux");
    expect(mail.html).not.toContain("803 272 590");
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
  it("les durées annoncées sont les bonnes, et le lien existe aussi en clair", async () => {
    const url = "https://app.tartan.coach/lien-secret";
    for (const [react, duration] of [
      [createElement(VerifyEmail, { url }), "1 heure"],
      [createElement(ResetPasswordEmail, { url }), "1 heure"],
      [createElement(MagicLinkEmail, { url }), "15 minutes"],
    ] as const) {
      const to = `duree-${Math.random()}@test.tartan.coach`;
      await sendEmail({ kind: "magic_link", to, subject: "Essai", react });
      const mail = outbox.find((entry) => entry.to === to)!;
      expect(mail.html).toContain(duration);
      expect(mail.html.split(url).length).toBeGreaterThan(2);
    }
  });
  it("le titre d'un repli est son texte, sans répétition ni « Tartan » seul", async () => {
    const to = `repli-${Math.random()}@test.tartan.coach`;
    const body = "Ta séance de lundi est annulée";
    await sendEmail({
      kind: "notification_fallback",
      to,
      subject: body,
      react: createElement(NotificationEmail, { body, url: "https://app.tartan.coach/x", cta: "Voir mes séances" }),
    });
    const mail = outbox.find((entry) => entry.to === to)!;
    // Une fois dans l'aperçu, une fois dans le titre.
    expect(mail.html.split(body).length - 1).toBe(2);
    expect(mail.html).toContain("Voir mes séances");
  });
  it("un POST valide coupe le flux sans session, un jeton faux donne 404, le GET ne change rien", async () => {
    const user = await makeUser("Coupe");
    const url = unsubscribeUrl(user.userId, "digest");
    const token = url.split("/").at(-1)!;
    const params = (kind: string, value: string) => ({ params: Promise.resolve({ kind, token: value }) });
    const request = new Request(url, { method: "POST", body: "List-Unsubscribe=One-Click" });
    const wrong = await POST(request.clone(), params("digest", `${token}x`));
    expect(wrong.status).toBe(404);
    const otherKind = await POST(request.clone(), params("notifications", token));
    expect(otherKind.status).toBe(404);
    expect(isValidUnsubscribe("digest", token)).toBe(true);
    expect((await getEmailPreferences(user.userId)).digest).toBe(true);
    const done = await POST(request.clone(), params("digest", token));
    expect(done.status).toBe(200);
    const after = await getEmailPreferences(user.userId);
    // Couper le résumé ne touche ni aux replis de notification ni aux conseils.
    expect(after).toEqual({ digest: false, notifications: true, tips: true });
  });
  it("le formulaire de la page revient sur la page", async () => {
    const user = await makeUser("Page");
    const url = unsubscribeUrl(user.userId, "notifications");
    const token = url.split("/").at(-1)!;
    const response = await POST(new Request(url, { method: "POST", headers: { accept: "text/html" } }), {
      params: Promise.resolve({ kind: "notifications", token }),
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain(`/e-mails/notifications/${token}?fait=1`);
  });
});
