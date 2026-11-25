import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { m } from "@tartan/i18n";
import { AppError, consentRequired, forbidden, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readVoiceUpload } from "@/lib/voice-http";
import { accessCan, audit, requireOrgMember, requireVisibleAthlete } from "./access";
import { getAthleteSession } from "./athlete-view.service";
import { consentForAthletes } from "./consent.service";
import { athleteAssignedWhere } from "./session-audience.service";
import { requireEditableVoiceInstructions } from "./session.service";

export async function uploadVoiceInstruction(userId: string, orgId: string, request: Request) {
  await requireOrgMember(userId, orgId, "manageSessions");
  await enforceRateLimit(`session-voice/${userId}`, 60, 600);
  const { bytes, mimeType } = await readVoiceUpload(request);
  return prisma.$transaction(async (tx) => {
    await requireOrgMember(userId, orgId, "manageSessions", tx);
    return tx.coachVoiceInstruction.create({
      data: { organizationId: orgId, createdBy: userId, mimeType, bytes },
      select: { id: true },
    });
  });
}

export async function readVoiceInstruction(userId: string, orgId: string, clipId: string, sessionId?: string) {
  const access = await requireOrgMember(userId, orgId);
  if (access.role === "athlete" && sessionId) {
    // La variante, les adaptations individuelles et la version après validation
    // doivent être exactement celles que cet athlète voit sur sa fiche.
    const detail = await getAthleteSession(userId, orgId, sessionId);
    if (!detail.blocks.some((b) => b.items.some((item) => item.prescription.coachVoiceId === clipId))) throw notFound();
  } else {
    if (!accessCan(access, "manageSessions")) throw forbidden();
    await requireEditableVoiceInstructions(access, [clipId]);
  }
  const clip = await prisma.coachVoiceInstruction.findFirst({
    where: { id: clipId, organizationId: orgId },
    select: { mimeType: true, bytes: true },
  });
  if (!clip) throw notFound();
  return clip;
}

async function debriefLog(
  userId: string,
  orgId: string,
  sessionId: string,
  athleteId?: string,
  db: Prisma.TransactionClient = prisma,
) {
  const access = await requireOrgMember(userId, orgId, undefined, db);
  const targetId = athleteId ?? access.athleteId;
  if (!targetId) throw forbidden();
  if (targetId !== access.athleteId) {
    if (!accessCan(access, "viewTracking") || access.role === "athlete" || access.role === "guardian")
      throw forbidden();
    await requireVisibleAthlete(access, targetId, db);
  }
  const log = await db.sessionLog.findFirst({
    where: {
      scheduledSessionId: sessionId,
      athleteId: targetId,
      session: { AND: [{ organizationId: orgId }, await athleteAssignedWhere(targetId, db)] },
    },
    select: { id: true, status: true, athleteId: true },
  });
  return { log, access, targetId };
}

async function checkDebriefWrite(
  userId: string,
  orgId: string,
  sessionId: string,
  db: Prisma.TransactionClient = prisma,
) {
  const { log, targetId } = await debriefLog(userId, orgId, sessionId, undefined, db);
  if (!log || log.status !== "done")
    throw new AppError(409, "voice_requires_completion", m.errors.voiceRequiresCompletion);
  if (!(await consentForAthletes([targetId], db)).get(targetId)?.health) throw consentRequired();
  return log;
}

export async function putVoiceDebrief(userId: string, orgId: string, sessionId: string, request: Request) {
  const log = await checkDebriefWrite(userId, orgId, sessionId);
  await enforceRateLimit(`session-voice/${userId}`, 60, 600);
  const { mimeType, bytes } = await readVoiceUpload(request);
  await prisma.$transaction(async (tx) => {
    // Un retrait du consentement ou une correction du statut concurrent doit toujours l’emporter.
    await tx.$queryRaw`SELECT id FROM athlete_consents WHERE athlete_id = ${log.athleteId}::uuid AND kind = 'health' FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM session_logs WHERE id = ${log.id}::uuid FOR UPDATE`;
    const current = await checkDebriefWrite(userId, orgId, sessionId, tx);
    await tx.sessionVoiceDebrief.upsert({
      where: { sessionLogId: current.id },
      create: { sessionLogId: current.id, mimeType, bytes },
      update: { mimeType, bytes },
      select: { sessionLogId: true },
    });
  });
}

export async function readVoiceDebrief(userId: string, orgId: string, sessionId: string, athleteId?: string) {
  const { log, access, targetId } = await debriefLog(userId, orgId, sessionId, athleteId);
  if (!log || log.status !== "done" || !(await consentForAthletes([targetId])).get(targetId)?.health) throw notFound();
  const clip = await prisma.sessionVoiceDebrief.findUnique({
    where: { sessionLogId: log.id },
    select: { bytes: true, mimeType: true },
  });
  if (!clip) throw notFound();
  if (access.athleteId !== targetId)
    await audit({
      organizationId: orgId,
      actorId: userId,
      action: "health_read",
      entity: "athlete",
      entityId: targetId,
    });
  return clip;
}

export async function deleteVoiceDebrief(userId: string, orgId: string, sessionId: string) {
  const { log } = await debriefLog(userId, orgId, sessionId);
  if (log) await prisma.sessionVoiceDebrief.deleteMany({ where: { sessionLogId: log.id } });
}
