import { z } from "zod";
import { snapshotItem, uuid } from "./session";

const loadState = z.object({
  kg: z.number().nullable(),
  reference: snapshotItem.shape.strengthReference.unwrap(),
});
export const prescriptionRefreshPreview = z.object({
  sessionId: uuid,
  sessionVersion: z.number().int().positive(),
  token: z.string().regex(/^[a-f0-9]{64}$/),
  athletes: z.array(
    z.object({
      athleteId: uuid,
      name: z.string(),
      status: z.enum(["ready", "recorded", "unfrozen", "unchanged"]),
      changes: z.array(
        z.object({
          itemRef: z.string(),
          exerciseName: z.string(),
          percentage: z.number(),
          before: loadState,
          after: loadState,
        }),
      ),
      incompatible: z.array(z.object({ itemRef: z.string(), exerciseName: z.string() })),
    }),
  ),
});
export type PrescriptionRefreshPreview = z.infer<typeof prescriptionRefreshPreview>;
export const confirmPrescriptionRefresh = z
  .object({
    expectedVersion: z.number().int().positive(),
    token: z.string().regex(/^[a-f0-9]{64}$/),
    confirmed: z.literal(true),
  })
  .strict();
export type ConfirmPrescriptionRefresh = z.infer<typeof confirmPrescriptionRefresh>;
