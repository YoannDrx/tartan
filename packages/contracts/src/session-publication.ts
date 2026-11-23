import { z } from "zod";
import { uuid } from "./session";

export const publishSessionsInput = z
  .object({
    sessions: z
      .array(z.object({ id: uuid, expectedVersion: z.number().int().positive() }).strict())
      .min(1)
      .max(14)
      .refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length),
  })
  .strict();
export type PublishSessionsInput = z.infer<typeof publishSessionsInput>;
export const publishSessionsResult = z.object({
  sessions: z.array(z.object({ id: uuid, version: z.number().int().positive() })),
});

// Ce que la publication d'une séance renvoie : qui la reçoit (`athletes`) et qui en est prévenu (`notified`, ceux qui
// ont un compte). Facultatif : un serveur plus ancien ne l'envoie pas, le message reste alors neutre.
export const publicationRecipients = z.object({
  athletes: z.number().int().min(0),
  notified: z.number().int().min(0),
});
export type PublicationRecipients = z.infer<typeof publicationRecipients>;
export const publishSessionResult = z.object({ id: z.string(), recipients: publicationRecipients.optional() });
export type PublishSessionResult = z.infer<typeof publishSessionResult>;
