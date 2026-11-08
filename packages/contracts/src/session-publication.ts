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
