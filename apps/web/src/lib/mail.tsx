import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { env } from "./env";
import { log } from "./logger";

export const outbox: { to: string; subject: string; html: string }[] = [];

export const sendEmail = async (input: {
  to: string;
  subject: string;
  react: ReactElement;
  idempotencyKey?: string;
}): Promise<void> => {
  const html = await render(input.react);
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  if (!RESEND_API_KEY) {
    // Sans clé (local et tests), on garde le message pour l'inspecter au lieu de l'envoyer.
    outbox.push({ to: input.to, subject: input.subject, html });
    if (process.env.NODE_ENV === "development") {
      const link = html.match(/href="(https?:[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
      console.info(`[e-mail local] ${input.subject}${link ? ` → ${link}` : ""}`);
    }
    return;
  }
  // Comptes de démonstration : ces adresses n'existent pas, un envoi nuirait à la réputation du domaine.
  if (input.to.endsWith("@demo.tartan.coach")) return;
  const { error } = await new Resend(RESEND_API_KEY).emails.send(
    {
      from: EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html,
      replyTo: env().EMAIL_CONTACT,
    },
    { ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}), signal: AbortSignal.timeout(10_000) },
  );
  if (error) {
    log.error("email_failed", { code: error.name });
    throw new Error("email_failed");
  }
};
