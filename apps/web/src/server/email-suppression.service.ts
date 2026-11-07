import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

const hashEmail = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

export const suppressEmail = async (email: string, reason: "bounce" | "complaint" | "suppressed") => {
  // Ni contenu, ni objet, ni adresse en clair dans la liste de blocage ; le rejeu est sans effet.
  await prisma.emailSuppression.createMany({ data: [{ emailHash: hashEmail(email), reason }], skipDuplicates: true });
};

export class EmailSuppressedError extends Error {
  constructor() {
    super("email_suppressed");
    this.name = "EmailSuppressedError";
  }
}

export const assertEmailDeliverable = async (email: string) => {
  if (await prisma.emailSuppression.findUnique({ where: { emailHash: hashEmail(email) } }))
    throw new EmailSuppressedError();
};
