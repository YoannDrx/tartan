import { createElement } from "react";
import {
  historyShareInput,
  type HistoryShareInput,
  type HistoryShareSummary,
  type SharedHistory,
} from "@tartan/contracts";
import { historyShareWidens, normalizeHistoryScopes, readableHistoryScopes, type HistoryScope } from "@tartan/domain";
import { strengthTestLabel } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { HistorySharedEmail } from "@email/personal";
import { env } from "@/lib/env";
import { AppError, forbidden, invalid } from "@/lib/errors";
import { fromDbDate } from "@/lib/dates";
import { log } from "@/lib/logger";
import { sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { audit, requireAthleteAccess, requireOrgMember, requireVisibleAthlete } from "./access";
import { namesFor } from "./me.service";

// Le partage de l'historique personnel d'un athlète autonome avec l'espace d'un coach qu'il a rejoint
// (docs/plans/athlete-autonome.md, AA2). Par cases, révocable, en lecture seule, jamais la santé. Rien n'est copié :
// le coach lit l'espace personnel à travers la ligne `history_shares`, revérifiée à chaque lecture et tracée au
// journal comme les autres accès aux données sensibles.

const t = w.personal.share;

const personalSpaceOf = (userId: string) =>
  prisma.organization.findUnique({ where: { personalOwnerId: userId }, select: { id: true } });

// Après l'acceptation d'une invitation : l'écran de partage n'a de sens que pour un athlète qui a un espace personnel
// et ne partage pas déjà avec cet espace.
export const historyShareOffered = async (userId: string, organizationId: string): Promise<boolean> => {
  const [personal, athlete] = await Promise.all([
    personalSpaceOf(userId),
    prisma.athlete.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { id: true, organization: { select: { kind: true } }, historyShare: true },
    }),
  ]);
  if (!personal || !athlete || athlete.organization.kind !== "coach") return false;
  return readableHistoryScopes(athlete.historyShare).length === 0;
};

// L'écran de partage : à qui l'athlète partagerait, ou rien si l'écran n'a pas lieu d'être.
export const historyShareScreen = async (userId: string, organizationId: string): Promise<{ coach: string } | null> => {
  await requireOrgMember(userId, organizationId);
  if (!(await historyShareOffered(userId, organizationId))) return null;
  const space = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { ownerId: true, name: true },
  });
  return { coach: (await namesFor([space.ownerId])).get(space.ownerId) || space.name };
};

// Les coachs qui suivent cette fiche : le propriétaire de l'espace et les coachs de ses groupes.
const coachesOf = async (organizationId: string, athleteId: string, except: string): Promise<string[]> => {
  const [org, leads] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { ownerId: true } }),
    prisma.groupCoach.findMany({
      where: { group: { organizationId, members: { some: { athleteId } } } },
      select: { userId: true },
    }),
  ]);
  return [...new Set([org.ownerId, ...leads.map((lead) => lead.userId)])].filter((id) => id !== except);
};

const notifyCoaches = async (organizationId: string, athleteId: string, userId: string, scopes: HistoryScope[]) => {
  const coaches = await coachesOf(organizationId, athleteId, userId);
  const [names, accounts] = await Promise.all([
    namesFor([userId]),
    prisma.user.findMany({ where: { id: { in: coaches } }, select: { email: true } }),
  ]);
  const athlete = names.get(userId) ?? t.someone;
  const list = scopes.map((scope) => t.scopes[scope].toLowerCase()).join(", ");
  for (const coach of accounts) {
    await sendEmail({
      kind: "history_shared",
      to: coach.email,
      subject: w.personal.emails.historyShared.subject(athlete),
      react: createElement(HistorySharedEmail, {
        athlete,
        scopes: list,
        url: `${env().NEXT_PUBLIC_APP_URL}/athletes/${athleteId}?espace=${organizationId}#historique-partage`,
      }),
    }).catch(() => log.warn("history_shared_email_failed"));
  }
};

// Partager, ou changer ses cases. Aucune case : le partage est retiré.
export const shareHistory = async (userId: string, raw: HistoryShareInput): Promise<HistoryShareSummary | null> => {
  const input = historyShareInput.parse(raw);
  const access = await requireAthleteAccess(userId, input.organizationId);
  // On partage vers l'espace d'un coach, jamais vers son propre espace personnel.
  if (access.personal) throw invalid();
  const scopes = normalizeHistoryScopes(input.scopes);
  if (scopes.length === 0) {
    await revokeHistoryShare(userId, input.organizationId);
    return null;
  }
  const personal = await personalSpaceOf(userId);
  if (!personal) throw new AppError(409, "no_personal_space", t.noPersonalSpace);
  const now = new Date();
  const before = await prisma.historyShare.findUnique({ where: { athleteId: access.athleteId } });
  const share = await prisma.historyShare.upsert({
    where: { athleteId: access.athleteId },
    create: {
      personalOrganizationId: personal.id,
      userId,
      organizationId: input.organizationId,
      athleteId: access.athleteId,
      scopes,
      grantedAt: now,
    },
    update: { personalOrganizationId: personal.id, userId, scopes, grantedAt: now, revokedAt: null },
    include: { organization: { select: { name: true } } },
  });
  await audit({
    organizationId: input.organizationId,
    actorId: userId,
    action: "history_shared",
    entity: "athlete",
    entityId: access.athleteId,
  });
  if (historyShareWidens(readableHistoryScopes(before), scopes))
    await notifyCoaches(input.organizationId, access.athleteId, userId, scopes);
  return {
    organizationId: share.organizationId,
    organizationName: share.organization.name,
    scopes,
    grantedAt: share.grantedAt.toISOString(),
  };
};

// Retirer : effet immédiat, la lecture suivante du coach ne trouve plus rien.
export const revokeHistoryShare = async (userId: string, organizationId: string): Promise<void> => {
  const share = await prisma.historyShare.findFirst({ where: { userId, organizationId, revokedAt: null } });
  if (!share) return;
  await prisma.historyShare.update({ where: { id: share.id }, data: { revokedAt: new Date() } });
  await audit({
    organizationId,
    actorId: userId,
    action: "history_share_revoked",
    entity: "athlete",
    entityId: share.athleteId,
  });
};

// Ses partages en cours, pour Réglages, Confidentialité.
export const listMyHistoryShares = async (userId: string): Promise<HistoryShareSummary[]> => {
  const rows = await prisma.historyShare.findMany({
    where: { userId, revokedAt: null },
    orderBy: { grantedAt: "desc" },
    include: { organization: { select: { name: true } } },
  });
  return rows
    .map((row) => ({
      organizationId: row.organizationId,
      organizationName: row.organization.name,
      scopes: readableHistoryScopes(row),
      grantedAt: row.grantedAt.toISOString(),
    }))
    .filter((row) => row.scopes.length > 0);
};

// Ce que lit un coach sur la fiche de l'athlète : contrôle de l'accès, puis du partage, à chaque lecture.
export const getSharedHistory = async (
  userId: string,
  organizationId: string,
  athleteId: string,
): Promise<SharedHistory> => {
  const access = await requireOrgMember(userId, organizationId, "viewTracking");
  // L'athlète lit son historique dans son propre espace ; ce chemin est celui de ses coachs.
  if (access.role === "athlete" || access.role === "guardian") throw forbidden();
  await requireVisibleAthlete(access, athleteId);
  const share = await prisma.historyShare.findUnique({
    where: { athleteId },
    include: {
      athlete: { select: { userId: true } },
      personalOrganization: { select: { kind: true, personalOwnerId: true } },
    },
  });
  const scopes = readableHistoryScopes(share);
  // La fiche doit encore être celle du titulaire de l'espace personnel : un partage ne survit à aucun changement.
  if (
    !share ||
    scopes.length === 0 ||
    share.organizationId !== organizationId ||
    share.athlete.userId !== share.userId ||
    share.personalOrganization.kind !== "personal" ||
    share.personalOrganization.personalOwnerId !== share.userId
  )
    return null;
  const source = await prisma.athlete.findUnique({
    where: { organizationId_userId: { organizationId: share.personalOrganizationId, userId: share.userId } },
    select: { id: true },
  });
  if (!source) return null;
  await audit({
    organizationId,
    actorId: userId,
    action: "history_share_read",
    entity: "athlete",
    entityId: athleteId,
  });
  const [records, tests, logs] = await Promise.all([
    scopes.includes("records")
      ? prisma.performance.findMany({
          where: { athleteId: source.id },
          orderBy: { date: "desc" },
          take: 50,
          select: { discipline: true, mark: true, unit: true, date: true, isPb: true },
        })
      : null,
    scopes.includes("strength")
      ? prisma.strengthTest.findMany({
          where: { athleteId: source.id },
          orderBy: { date: "desc" },
          take: 50,
          select: {
            exerciseKey: true,
            value: true,
            unit: true,
            kind: true,
            date: true,
            exercise: { select: { name: true } },
          },
        })
      : null,
    // L'historique des séances : la date, le titre et le statut. Ni effort ressenti, ni douleur, ni commentaire.
    scopes.includes("sessions")
      ? prisma.sessionLog.findMany({
          where: { athleteId: source.id },
          orderBy: { createdAt: "desc" },
          take: 60,
          select: { status: true, session: { select: { date: true, title: true, type: true } } },
        })
      : null,
  ]);
  return {
    scopes,
    grantedAt: share.grantedAt.toISOString(),
    ...(records
      ? {
          records: records.map((r) => ({
            discipline: r.discipline,
            mark: Number(r.mark),
            unit: r.unit,
            date: fromDbDate(r.date),
            isPb: r.isPb,
          })),
        }
      : {}),
    ...(tests
      ? {
          strength: tests.map((test) => ({
            exercise: test.exercise?.name ?? strengthTestLabel(test.exerciseKey),
            value: Number(test.value),
            unit: test.unit,
            kind: test.kind,
            date: fromDbDate(test.date),
          })),
        }
      : {}),
    ...(logs
      ? {
          sessions: logs.map((entry) => ({
            date: fromDbDate(entry.session.date),
            title: entry.session.title,
            type: entry.session.type,
            status: entry.status,
          })),
        }
      : {}),
  };
};
