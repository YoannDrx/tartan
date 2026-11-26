import "server-only";
import { createHash } from "node:crypto";
import {
  prescriptionSchema,
  sessionThreadTextInput,
  uuid,
  type SessionThreadRoot,
  type SessionThreadView,
} from "@tartan/contracts";
import { applyOverride, blocksForVariant, resolveVariant } from "@tartan/domain";
import { m } from "@tartan/i18n";
import type { Prisma } from "@/generated/prisma/client";
import { AppError, consentRequired, forbidden, invalid, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readVoiceUpload } from "@/lib/voice-http";
import { readJsonBody } from "@/lib/zod-route";
import { accessCan, audit, requireOrgMember, requireVisibleAthlete } from "./access";
import { consentForAthletes } from "./consent.service";
import { effectiveSessionSnapshot } from "./effective-session-snapshot";
import { displayName } from "./me.service";
import { athleteAssignedWhere } from "./session-audience.service";

export type ThreadTarget = { athleteId?: string; itemRef?: string };
type Db = Prisma.TransactionClient;
type Scope = {
  sessionId: string;
  athleteId: string;
  itemRef: string | null;
  debriefLogId: string | null;
  instructionId: string | null;
  viewerIsAthlete: boolean;
};

async function threadScope(
  db: Db,
  userId: string,
  orgId: string,
  sessionId: string,
  target: ThreadTarget,
): Promise<Scope> {
  const access = await requireOrgMember(userId, orgId, undefined, db);
  const athleteId = target.athleteId ?? access.athleteId;
  if (access.personal || !athleteId || access.role === "guardian") throw forbidden();
  const viewerIsAthlete = access.role === "athlete";
  if (viewerIsAthlete) {
    if (athleteId !== access.athleteId) throw forbidden();
  } else {
    if (!accessCan(access, "viewTracking")) throw forbidden();
    await requireVisibleAthlete(access, athleteId, db);
  }
  const itemRef = target.itemRef ?? null;
  const where = { id: sessionId, AND: [{ organizationId: orgId }, await athleteAssignedWhere(athleteId, db)] };
  const scope = { sessionId, athleteId, itemRef, viewerIsAthlete, debriefLogId: null, instructionId: null };
  if (itemRef === null) {
    // Même ordre de prise de verrous que le remplacement du débrief vocal.
    await db.$queryRaw`SELECT id FROM athlete_consents WHERE athlete_id = ${athleteId}::uuid AND kind = 'health' FOR SHARE`;
    await db.$queryRaw`SELECT id FROM session_logs WHERE athlete_id = ${athleteId}::uuid AND scheduled_session_id = ${sessionId}::uuid FOR SHARE`;
    const session = await db.scheduledSession.findFirst({
      where,
      select: { logs: { where: { athleteId }, select: { id: true, status: true } } },
    });
    if (!session) throw notFound();
    const log = session.logs[0];
    if (log?.status !== "done") throw new AppError(409, "voice_requires_completion", m.errors.voiceRequiresCompletion);
    if (!(await consentForAthletes([athleteId], db)).get(athleteId)?.health) throw consentRequired();
    return { ...scope, debriefLogId: log.id };
  }
  const session = await db.scheduledSession.findFirst({
    where,
    select: {
      id: true,
      version: true,
      snapshot: true,
      prescriptionFrozenAt: true,
      overrides: { where: { athleteId }, select: { itemRef: true, prescription: true } },
      logs: {
        where: { athleteId },
        select: { sessionVersion: true, prescriptionSnapshot: true, variantDone: true },
      },
      attendance: { where: { athleteId }, select: { status: true } },
    },
  });
  if (!session) throw notFound();
  const log = session.logs[0] ?? null;
  const { snapshot, individualized } = await effectiveSessionSnapshot(db, session, athleteId, log);
  const variant = log?.variantDone ?? resolveVariant(session.attendance[0]?.status ?? "unknown", snapshot);
  const item = blocksForVariant(snapshot.blocks, variant)
    .flatMap((block) => block.items)
    .find((item) => item.ref === itemRef);
  if (!item || item.kind === "recovery") throw notFound();
  const overrides = new Map(session.overrides.map((o) => [o.itemRef, o.prescription]));
  const adapted = overrides.get(item.ref) ?? overrides.get(item.sourceRef ?? "");
  const prescription =
    !individualized && adapted
      ? applyOverride(item.prescription, prescriptionSchema.parse(adapted))
      : item.prescription;
  return { ...scope, instructionId: prescription.coachVoiceId ?? null };
}

const messageWhere = (scope: Scope) => ({
  scheduledSessionId: scope.sessionId,
  athleteId: scope.athleteId,
  itemRef: scope.itemRef,
  debriefLogId: scope.debriefLogId,
});
const authorSelect = { name: true, profile: { select: { firstName: true, lastName: true } } } as const;
const voiceSelect = { mimeType: true, durationSeconds: true, transcript: true } as const;
type AudioSource = {
  kind: "instruction" | "debrief" | "reply";
  id: string;
  version: string;
  authorId: string | null;
  authorName: string;
  authorIsAthlete: boolean;
  mimeType: string;
  durationSeconds: number | null;
  transcript: string | null;
  bytes?: Uint8Array;
};

async function audioSource(
  db: Db,
  scope: Scope,
  orgId: string,
  messageId: string,
  includeBytes: boolean,
): Promise<AudioSource | null> {
  if (messageId !== "root") {
    const row = await db.sessionThreadMessage.findFirst({
      where: { ...messageWhere(scope), id: messageId, mimeType: { not: null } },
      select: {
        id: true,
        authorId: true,
        authorIsAthlete: true,
        author: { select: authorSelect },
        ...voiceSelect,
        bytes: includeBytes,
      },
    });
    return row?.mimeType
      ? {
          ...row,
          kind: "reply",
          version: row.id,
          mimeType: row.mimeType,
          bytes: row.bytes ?? undefined,
          authorName: displayName(row.author.profile) || row.author.name,
        }
      : null;
  }
  if (scope.debriefLogId) {
    const row = await db.sessionVoiceDebrief.findUnique({
      where: { sessionLogId: scope.debriefLogId },
      select: {
        ...voiceSelect,
        voiceVersion: true,
        bytes: includeBytes,
        authorId: true,
        author: { select: authorSelect },
      },
    });
    return row
      ? {
          ...row,
          kind: "debrief",
          id: scope.debriefLogId,
          version: row.voiceVersion,
          authorId: row.authorId,
          authorIsAthlete: true,
          authorName: displayName(row.author?.profile) || row.author?.name || m.sessionThread.athlete,
        }
      : null;
  }
  if (!scope.instructionId) return null;
  const clip = await db.coachVoiceInstruction.findFirst({
    where: { id: scope.instructionId, organizationId: orgId },
    select: { ...voiceSelect, bytes: includeBytes, id: true, createdBy: true, author: { select: authorSelect } },
  });
  return clip
    ? {
        ...clip,
        kind: "instruction",
        version: clip.id,
        authorId: clip.createdBy,
        authorIsAthlete: false,
        authorName: displayName(clip.author.profile) || clip.author.name,
      }
    : null;
}

const role = (isAthlete: boolean) => (isAthlete ? ("athlete" as const) : ("coach" as const));
function rootView(userId: string, source: AudioSource): SessionThreadRoot {
  const mine = source.authorId === userId;
  return {
    authorName: source.authorName,
    authorRole: role(source.authorIsAthlete),
    mine,
    canTranscribe: mine,
    durationSeconds: source.durationSeconds,
    version: source.version,
    transcript: source.transcript,
  };
}
async function auditDebriefRead(db: Db, scope: Scope, userId: string, organizationId: string) {
  if (scope.debriefLogId && !scope.viewerIsAthlete)
    await audit(
      { organizationId, actorId: userId, action: "health_read", entity: "athlete", entityId: scope.athleteId },
      db,
    );
}
export async function getSessionThread(
  userId: string,
  orgId: string,
  sessionId: string,
  target: ThreadTarget,
): Promise<SessionThreadView> {
  return prisma.$transaction(async (db) => {
    const scope = await threadScope(db, userId, orgId, sessionId, target);
    const root = await audioSource(db, scope, orgId, "root", false);
    const rows = await db.sessionThreadMessage.findMany({
      where: messageWhere(scope),
      orderBy: { position: "asc" },
      select: {
        id: true,
        author: { select: authorSelect },
        authorId: true,
        authorIsAthlete: true,
        createdAt: true,
        text: true,
        ...voiceSelect,
      },
    });
    if (root || rows.length) await auditDebriefRead(db, scope, userId, orgId);
    return {
      root: root && rootView(userId, root),
      messages: rows.map((row) => {
        const mine = row.authorId === userId;
        return {
          id: row.id,
          mine,
          authorName: displayName(row.author.profile) || row.author.name,
          authorRole: role(row.authorIsAthlete),
          createdAt: row.createdAt.toISOString(),
          text: row.text,
          voice: row.mimeType
            ? { version: row.id, canTranscribe: mine, durationSeconds: row.durationSeconds, transcript: row.transcript }
            : null,
        };
      }),
    };
  });
}

async function readMessage(request: Request) {
  if (request.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() === "application/json") {
    const { clientId, text } = await readJsonBody(request, sessionThreadTextInput);
    return { clientId, text, contentHash: createHash("sha256").update("text:").update(text).digest("hex") };
  }
  const id = uuid.safeParse(request.headers.get("Idempotency-Key"));
  if (!id.success) throw invalid();
  const { bytes, mimeType, durationSeconds } = await readVoiceUpload(request);
  return {
    clientId: id.data,
    bytes,
    mimeType,
    durationSeconds,
    contentHash: createHash("sha256").update("audio:").update(bytes).digest("hex"),
  };
}
export async function postSessionThread(
  userId: string,
  orgId: string,
  sessionId: string,
  target: ThreadTarget,
  request: Request,
) {
  await prisma.$transaction((db) => threadScope(db, userId, orgId, sessionId, target));
  await enforceRateLimit(`session-thread/${userId}`, 60, 600);
  const content = await readMessage(request);
  return prisma.$transaction(async (db) => {
    const scope = await threadScope(db, userId, orgId, sessionId, target);
    const fields = messageWhere(scope);
    // Deux appareils peuvent rejouer simultanément le même envoi après une coupure.
    await db.sessionThreadMessage.createMany({
      data: [{ ...fields, ...content, authorId: userId, authorIsAthlete: scope.viewerIsAthlete }],
      skipDuplicates: true,
    });
    const row = await db.sessionThreadMessage.findUniqueOrThrow({
      where: { authorId_clientId: { authorId: userId, clientId: content.clientId } },
      select: { id: true, contentHash: true, scheduledSessionId: true, athleteId: true, itemRef: true },
    });
    if (
      row.scheduledSessionId !== sessionId ||
      row.athleteId !== scope.athleteId ||
      row.itemRef !== scope.itemRef ||
      row.contentHash !== content.contentHash
    )
      throw new AppError(409, "client_id_conflict", m.errors.invalid);
    return { id: row.id };
  });
}

export async function readThreadAudio(
  userId: string,
  orgId: string,
  sessionId: string,
  target: ThreadTarget,
  messageId: string,
) {
  return prisma.$transaction(async (db) => {
    const scope = await threadScope(db, userId, orgId, sessionId, target);
    const source = await audioSource(db, scope, orgId, messageId, true);
    if (!source?.bytes) throw notFound();
    await auditDebriefRead(db, scope, userId, orgId);
    return { mimeType: source.mimeType, bytes: source.bytes };
  });
}

const changed = () => new AppError(409, "voice_changed", m.sessionThread.sourceChanged);
function ownSource(source: AudioSource | null, userId: string, version: string) {
  if (!source) throw notFound();
  if (source.authorId !== userId) throw forbidden();
  if (source.version !== version) throw changed();
  return source;
}
export async function readThreadTranscriptionSource(
  userId: string,
  orgId: string,
  sessionId: string,
  target: ThreadTarget,
  messageId: string,
  version: string,
) {
  return prisma.$transaction(async (db) => {
    const scope = await threadScope(db, userId, orgId, sessionId, target);
    const source = ownSource(await audioSource(db, scope, orgId, messageId, true), userId, version);
    if (!source.bytes) throw notFound();
    await auditDebriefRead(db, scope, userId, orgId);
    return { bytes: source.bytes, mimeType: source.mimeType, transcript: source.transcript };
  });
}
export async function saveThreadTranscript(
  userId: string,
  orgId: string,
  sessionId: string,
  target: ThreadTarget,
  messageId: string,
  version: string,
  transcript: string,
) {
  return prisma.$transaction(async (db) => {
    const scope = await threadScope(db, userId, orgId, sessionId, target);
    const source = ownSource(await audioSource(db, scope, orgId, messageId, false), userId, version);
    if (source.transcript !== null) return source.transcript;
    const data = { transcript };
    const result =
      source.kind === "debrief"
        ? await db.sessionVoiceDebrief.updateMany({ where: { sessionLogId: source.id, voiceVersion: version }, data })
        : source.kind === "instruction"
          ? await db.coachVoiceInstruction.updateMany({
              where: { id: source.id, organizationId: orgId, createdBy: userId },
              data,
            })
          : await db.sessionThreadMessage.updateMany({
              where: { ...messageWhere(scope), id: source.id, authorId: userId },
              data,
            });
    if (result.count !== 1) throw changed();
    return transcript;
  });
}
