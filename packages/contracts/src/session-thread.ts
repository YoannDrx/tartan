import { z } from "zod";

export const sessionThreadVoice = z.object({
  version: z.uuid(),
  transcript: z.string().nullable(),
  canTranscribe: z.boolean(),
  durationSeconds: z.number().nonnegative().nullable(),
});
export type SessionThreadVoice = z.infer<typeof sessionThreadVoice>;

const author = {
  authorName: z.string(),
  authorRole: z.enum(["coach", "athlete"]),
  mine: z.boolean(),
};
export const sessionThreadRoot = sessionThreadVoice.extend(author);
export type SessionThreadRoot = z.infer<typeof sessionThreadRoot>;
export const sessionThreadMessage = z.object({
  id: z.uuid(),
  ...author,
  createdAt: z.iso.datetime(),
  text: z.string().nullable(),
  voice: sessionThreadVoice.nullable(),
});
export type SessionThreadMessage = z.infer<typeof sessionThreadMessage>;

export const sessionThreadView = z.object({
  root: sessionThreadRoot.nullable(),
  messages: z.array(sessionThreadMessage),
});
export type SessionThreadView = z.infer<typeof sessionThreadView>;
export const sessionThreadTextInput = z
  .object({ clientId: z.uuid(), text: z.string().trim().min(1).max(2000) })
  .strict();
export const sessionThreadTranscriptionInput = z.object({ consent: z.literal(true), version: z.uuid() }).strict();
