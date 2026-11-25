import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { env } from "./env";
import { log } from "./logger";
import { categoryOf, type EmailKey } from "@/server/email-registry";
import { assertEmailDeliverable } from "@/server/email-suppression.service";

// Le lien à jouer en local : le premier qui mène quelque part. Celui du logo, en tête de chaque message, ne vise
// que l'accueil du site.
export const actionLink = (html: string): string | undefined => {
  const links = [...html.matchAll(/href="(https?:[^"]+)"/g)].map((match) => match[1]!.replaceAll("&amp;", "&"));
  return links.find((link) => new URL(link).pathname !== "/" || new URL(link).search !== "") ?? links[0];
};

export const outbox: { to: string; subject: string; html: string; text: string; headers: Record<string, string> }[] =
  [];

export const sendEmail = async (input: {
  // L'e-mail tel qu'il figure au registre : sa catégorie décide de ce qu'une liste de blocage arrête.
  kind: EmailKey;
  to: string;
  subject: string;
  react: ReactElement;
  idempotencyKey?: string;
  // Envois coupables seulement : un clic dans le client de messagerie les arrête, sans session.
  unsubscribeUrl?: string;
}): Promise<void> => {
  // Avant tout rendu, et en local comme en production : le blocage se teste sans prestataire.
  await assertEmailDeliverable(input.to, categoryOf(input.kind));
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
    const link = actionLink(html);
    if (process.env.NODE_ENV === "development" && input.kind !== "beta_install") {
      console.info(`[e-mail local] ${input.subject}${link ? ` → ${link}` : ""}`);
    }
    // Parcours Playwright sur build de production : le message est déposé dans un dossier que le test relit, pour
    // suivre le vrai lien. Variable interdite en production (assertEnvIsolation), et cette branche n'y passe jamais.
    const captureDir = process.env.E2E_MAIL_DIR;
    if (captureDir) {
      await mkdir(captureDir, { recursive: true });
      await writeFile(
        path.join(captureDir, `${Date.now()}-${randomUUID()}.json`),
        JSON.stringify({ to: input.to, subject: input.subject, link: link ?? null }),
      );
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
