import { createHmac, randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { POST } from "../app/api/webhooks/resend/route";
import { env } from "@/lib/env";
import { assertEmailDeliverable } from "@/server/email-suppression.service";

afterEach(() => {
  env().RESEND_API_KEY = undefined;
  env().RESEND_WEBHOOK_SECRET = undefined;
});

it.each(["Permanent", "Transient", "Undetermined"])(
  "ne bloque durablement que le rebond Permanent : %s",
  async (type) => {
    const key = Buffer.from("rebond-factice-pour-test");
    env().RESEND_API_KEY = "re_test_local";
    env().RESEND_WEBHOOK_SECRET = `whsec_${key.toString("base64")}`;
    const email = `rebond-${randomUUID()}@test.tartan.coach`;
    const body = JSON.stringify({
      type: "email.bounced",
      created_at: new Date().toISOString(),
      data: { to: [email], bounce: { type, subType: "General", message: "test" } },
    });
    const id = `msg_${randomUUID()}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
    const response = await POST(
      new Request("http://localhost/api/webhooks/resend", {
        method: "POST",
        body,
        headers: { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` },
      }),
    );
    expect(response.status).toBe(200);
    if (type === "Permanent") {
      // Une adresse qui n'existe plus ne reçoit rien, pas même un lien de connexion.
      await expect(assertEmailDeliverable(email, "activity")).rejects.toThrow("email_suppressed");
      await expect(assertEmailDeliverable(email, "security")).rejects.toThrow("email_suppressed");
    } else await expect(assertEmailDeliverable(email, "activity")).resolves.toBeUndefined();
  },
);

it("vérifie la signature brute, bloque un destinataire plaintif et supporte le rejeu", async () => {
  const key = Buffer.from("cle-de-webhook-factice-pour-test");
  env().RESEND_API_KEY = "re_test_local";
  env().RESEND_WEBHOOK_SECRET = `whsec_${key.toString("base64")}`;
  const email = `plainte-${randomUUID()}@test.tartan.coach`;
  const body = JSON.stringify({
    type: "email.complained",
    created_at: new Date().toISOString(),
    data: { to: [email] },
  });
  const id = `msg_${randomUUID()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  const call = (sig: string) =>
    POST(
      new Request("http://localhost/api/webhooks/resend", {
        method: "POST",
        body,
        headers: { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${sig}` },
      }),
    );
  expect((await call("invalid")).status).toBe(400);
  await expect(assertEmailDeliverable(email, "activity")).resolves.toBeUndefined();
  expect((await call(signature)).status).toBe(200);
  expect((await call(signature)).status).toBe(200);
  await expect(assertEmailDeliverable(email.toUpperCase(), "activity")).rejects.toThrow("email_suppressed");
  await expect(assertEmailDeliverable(email, "billing")).rejects.toThrow("email_suppressed");
  // Une plainte ne coupe pas l'accès au compte : connexion et réinitialisation partent toujours.
  await expect(assertEmailDeliverable(email, "security")).resolves.toBeUndefined();
});
