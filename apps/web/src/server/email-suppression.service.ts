import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isBlockedBy, type EmailCategory, type SuppressionReason } from "./email-registry";

const hashEmail = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

export const suppressEmail = async (email: string, reason: SuppressionReason) => {
  const emailHash = hashEmail(email);
  // Ni contenu, ni objet, ni adresse en clair dans la liste de blocage ; le rejeu est sans effet.
  await prisma.emailSuppression.createMany({ data: [{ emailHash, reason }], skipDuplicates: true });
  // Un rebond définitif l'emporte sur une plainte déjà notée : l'adresse n'existe plus.
  if (reason === "bounce") await prisma.emailSuppression.update({ where: { emailHash }, data: { reason } });
};

export class EmailSuppressedError extends Error {
  constructor(readonly reason: SuppressionReason = "suppressed") {
    super("email_suppressed");
    this.name = "EmailSuppressedError";
  }
}

const REASONS: readonly string[] = ["bounce", "complaint", "suppressed"];

// Un rebond bloque tout. Une plainte ou une désinscription laisse passer les e-mails de sécurité :
// personne ne doit perdre l'accès à son compte pour avoir signalé un résumé hebdomadaire.
export const assertEmailDeliverable = async (email: string, category: EmailCategory) => {
  const row = await prisma.emailSuppression.findUnique({ where: { emailHash: hashEmail(email) } });
  if (!row) return;
  // Une raison inconnue est traitée comme la plus prudente pour l'expéditeur : une plainte.
  const reason = (REASONS.includes(row.reason) ? row.reason : "complaint") as SuppressionReason;
  if (isBlockedBy(category, reason)) throw new EmailSuppressedError(reason);
};
