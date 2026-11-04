import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { env } from "./env";
import { log } from "./logger";

export const outbox: { to: string; subject: string; html: string; text: string; headers: Record<string, string> }[] =
  [];

export const sendEmail = async (input: {
  to: string;
  subject: string;
  react: ReactElement;
  idempotencyKey?: string;
  // Envois coupables seulement : un clic dans le client de messagerie les arrête, sans session.
  unsubscribeUrl?: string;
}): Promise<void> => {
  const [html, text] = await Promise.all([render(input.react), render(input.react, { plainText: true })]);
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  const headers: Record<string, string> = input.unsubscribeUrl
    ? {
        "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    : {};
  if (!RESEND_API_KEY) {
    // Une clé absente en production ne doit pas fabriquer un succès dans une boîte en mémoire.
    if (process.env.VERCEL_ENV === "production") throw new Error("email_unconfigured");
    // Sans clé (local et tests), on garde le message pour l'inspecter au lieu de l'envoyer.
    outbox.push({ to: input.to, subject: input.subject, html, text, headers });
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
      text,
      headers,
      replyTo: env().EMAIL_CONTACT,
    },
    { ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}), signal: AbortSignal.timeout(10_000) },
  );
  if (error) {
    log.error("email_failed", { code: error.name });
    throw new Error("email_failed");
  }
};
