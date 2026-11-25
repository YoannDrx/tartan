import type { Prescription, SaveScheduledSessionInput, SessionDraft } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";

export function draftPrescriptions(draft: SessionDraft, overrides: SaveScheduledSessionInput["overrides"] = []) {
  return [
    ...draft.blocks.flatMap((block) =>
      block.items.flatMap((item) =>
        item.autonomous ? [item.prescription, item.autonomous.prescription] : [item.prescription],
      ),
    ),
    ...overrides.map((override) => override.prescription),
  ];
}

export function voiceIds(prescriptions: Prescription[]) {
  return [...new Set(prescriptions.flatMap((p) => (p.coachVoiceId ? [p.coachVoiceId] : [])))];
}

// La suppression du compte du coach efface sa voix. Retirer la référence
// des copies en mémoire pour que la séance reste lisible et modifiable.
export async function dropDeletedInstructions(orgId: string, prescriptions: Prescription[]) {
  const ids = voiceIds(prescriptions);
  if (!ids.length) return;
  const clips = await prisma.coachVoiceInstruction.findMany({
    where: { organizationId: orgId, id: { in: ids } },
    select: { id: true },
  });
  const existing = new Set(clips.map((clip) => clip.id));
  for (const prescription of prescriptions) {
    if (prescription.coachVoiceId && !existing.has(prescription.coachVoiceId)) delete prescription.coachVoiceId;
  }
}
