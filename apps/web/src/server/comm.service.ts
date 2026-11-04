import {
  type AnnouncementInput,
  type AnnouncementItem,
  announcementInput,
  type CommentInput,
  type CommentItem,
  reportContentInput,
} from "@tartan/contracts";
import { isStaff } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { createElement } from "react";
import type { z } from "zod";
import { NotificationEmail } from "@email/auth";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { sendEmail } from "@/lib/mail";
import { deleteAsset, videoEnabled } from "@/lib/mux";
import { forbidden, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { audit, coachGroupIds, requireGroupInScope, requireOrgMember, visibleAthleteIds, type Access } from "./access";
import { firstNameOf, namesFor } from "./me.service";
import { notify } from "./notify.service";
import { coachesOfAthlete } from "./org.service";
import { audienceAthleteIds } from "./session.service";

const myGroupIds = async (access: Access): Promise<string[] | null> => {
  if (access.role === "owner") return null;
  if (access.role === "athlete" && access.athleteId) {
    const rows = await prisma.groupMember.findMany({
      where: { athleteId: access.athleteId },
      select: { groupId: true },
    });
    return rows.map((r) => r.groupId);
  }
  return coachGroupIds(access);
};

export const listAnnouncements = async (userId: string, organizationId: string): Promise<AnnouncementItem[]> => {
  const access = await requireOrgMember(userId, organizationId);
  const groups = await myGroupIds(access);
  const blocked = await blockedUserIds(userId);
  const rows = await prisma.announcement.findMany({
    where: { organizationId, ...(groups ? { groupId: { in: groups } } : {}), authorId: { notIn: blocked } },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: { group: { select: { name: true } } },
  });
  const names = await namesFor(rows.map((r) => r.authorId));
  return rows.map((a) => ({
    id: a.id,
    groupId: a.groupId,
    groupName: a.group.name,
    body: a.body,
    pinned: a.pinned,
    authorName: names.get(a.authorId) ?? null,
    createdAt: a.createdAt.toISOString(),
  }));
};

export const publishAnnouncement = async (userId: string, organizationId: string, raw: AnnouncementInput) => {
  const input = announcementInput.parse(raw);
  const access = await requireOrgMember(userId, organizationId, "publishAnnouncement");
  await requireGroupInScope(access, [input.groupId]);
  const created = await prisma.announcement.create({
    data: { organizationId, groupId: input.groupId, authorId: userId, body: input.body, pinned: input.pinned },
    include: { group: { select: { name: true } } },
  });
  const members = await prisma.groupMember.findMany({
    where: { groupId: input.groupId, athlete: { userId: { not: null } } },
    select: { athlete: { select: { userId: true } } },
  });
  await notify(
    members.map((r) => r.athlete.userId as string),
    "announcement",
    { coach: await firstNameOf(userId), group: created.group.name, organizationId, link: "/annonces" },
  );
  return { id: created.id };
};

export const setAnnouncementPinned = async (userId: string, organizationId: string, id: string, pinned: boolean) => {
  const access = await requireOrgMember(userId, organizationId, "publishAnnouncement");
  const row = await prisma.announcement.findFirst({ where: { id, organizationId } });
  if (!row) throw notFound();
  await requireGroupInScope(access, [row.groupId]);
  await prisma.announcement.update({ where: { id }, data: { pinned } });
};

export const deleteAnnouncement = async (userId: string, organizationId: string, id: string) => {
  const access = await requireOrgMember(userId, organizationId, "publishAnnouncement");
  const row = await prisma.announcement.findFirst({ where: { id, organizationId } });
  if (!row) throw notFound();
  await requireGroupInScope(access, [row.groupId]);
  await prisma.announcement.delete({ where: { id } });
};

// Un fil appartient à une séance, une validation ou une vidéo : on vérifie l'accès à cet objet.
const resolveThread = async (access: Access, entityType: CommentInput["entityType"], entityId: string) => {
  const staffIds = isStaff(access.role) ? await visibleAthleteIds(access) : [];
  if (entityType === "video") {
    const video = await prisma.video.findFirst({
      where: { id: entityId, organizationId: access.organizationId },
      select: { athleteId: true, sharedWithAthlete: true, uploadedBy: true, athlete: { select: { userId: true } } },
    });
    if (!video) throw notFound();
    const allowed = isStaff(access.role)
      ? staffIds.includes(video.athleteId)
      : access.athleteId === video.athleteId && video.sharedWithAthlete;
    if (!allowed) throw notFound();
    return { athleteIds: [video.athleteId], link: `/videos/${entityId}`, athleteLink: `/mes-sauts/${entityId}` };
  }
  if (entityType === "log") {
    const entry = await prisma.sessionLog.findFirst({
      where: { id: entityId, session: { organizationId: access.organizationId } },
      select: { athleteId: true, scheduledSessionId: true },
    });
    if (!entry) throw notFound();
    const allowed = isStaff(access.role) ? staffIds.includes(entry.athleteId) : access.athleteId === entry.athleteId;
    if (!allowed) throw notFound();
    return {
      athleteIds: [entry.athleteId],
      link: `/seances/${entry.scheduledSessionId}/suivi`,
      athleteLink: `/seance/${entry.scheduledSessionId}`,
    };
  }
  const session = await prisma.scheduledSession.findFirst({
    where: { id: entityId, organizationId: access.organizationId },
    select: { id: true, createdBy: true },
  });
  if (!session) throw notFound();
  const audience = await audienceAthleteIds(entityId);
  // Le propriétaire et l'auteur gardent l'accès, même si le groupe est encore vide.
  const allowed = isStaff(access.role)
    ? access.role === "owner" || session.createdBy === access.userId || audience.some((id) => staffIds.includes(id))
    : Boolean(access.athleteId && audience.includes(access.athleteId));
  if (!allowed) throw notFound();
  return { athleteIds: audience, link: `/seances/${entityId}/suivi`, athleteLink: `/seance/${entityId}` };
};

export const listComments = async (
  userId: string,
  organizationId: string,
  entityType: CommentInput["entityType"],
  entityId: string,
): Promise<CommentItem[]> => {
  const access = await requireOrgMember(userId, organizationId);
  await resolveThread(access, entityType, entityId);
  const blocked = await blockedUserIds(userId);
  const rows = await prisma.comment.findMany({
    where: { organizationId, entityType, entityId, authorId: { notIn: blocked } },
    orderBy: { createdAt: "asc" },
  });
  const names = await namesFor(rows.map((r) => r.authorId));
  return rows.map((c) => ({
    id: c.id,
    body: c.body,
    authorId: c.authorId,
    authorName: names.get(c.authorId) ?? null,
    createdAt: c.createdAt.toISOString(),
  }));
};

export const addComment = async (userId: string, organizationId: string, input: CommentInput) => {
  await enforceRateLimit(`comment:${userId}`, 120, 3600);
  const access = await requireOrgMember(userId, organizationId);
  if (access.role === "guardian") throw forbidden();
  const thread = await resolveThread(access, input.entityType, input.entityId);
  if (input.clientId) {
    const replayed = await prisma.comment.findUnique({ where: { clientId: input.clientId }, select: { id: true } });
    if (replayed) return replayed;
  }
  const created = await prisma.comment.create({
    data: {
      clientId: input.clientId ?? null,
      organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      authorId: userId,
      body: input.body,
    },
    select: { id: true },
  });
  const author = await firstNameOf(userId);
  if (access.role === "athlete" && access.athleteId) {
    const coaches = await coachesOfAthlete(organizationId, access.athleteId);
    await notify(coaches, "comment", { athlete: author, organizationId, link: thread.link });
  } else {
    const athletes = await prisma.athlete.findMany({
      where: { id: { in: thread.athleteIds.slice(0, input.entityType === "session" ? 0 : 1) }, userId: { not: null } },
      select: { userId: true },
    });
    await notify(
      athletes.map((a) => a.userId as string),
      "comment",
      { coach: author, organizationId, link: thread.athleteLink },
    );
  }
  return created;
};

export const blockedUserIds = async (userId: string): Promise<string[]> => {
  const rows = await prisma.userBlock.findMany({ where: { blockerId: userId }, select: { blockedId: true } });
  return rows.map((r) => r.blockedId);
};

export const blockUser = async (userId: string, blockedId: string) => {
  if (userId === blockedId) throw forbidden();
  await enforceRateLimit(`block:${userId}`, 30, 3600);
  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: userId, blockedId } },
    create: { blockerId: userId, blockedId },
    update: {},
  });
  await audit({ actorId: userId, action: "user_blocked", entity: "user", entityId: blockedId });
};

export const reportContent = async (
  userId: string,
  organizationId: string,
  input: z.infer<typeof reportContentInput>,
) => {
  await enforceRateLimit(`report:${userId}`, 30, 3600);
  await requireOrgMember(userId, organizationId);
  await prisma.contentReport.create({
    data: {
      organizationId,
      reporterId: userId,
      entityType: input.entityType,
      entityId: input.entityId,
      reason: input.reason,
      detail: input.detail ?? null,
    },
  });
  await audit({
    organizationId,
    actorId: userId,
    action: "content_reported",
    entity: input.entityType,
    entityId: input.entityId,
  });
  // Un signalement doit être lu : le responsable de l'espace et l'éditeur sont prévenus (§ 16.2).
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true, ownerId: true },
  });
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: organization.ownerId }, select: { email: true } });
  const subject = `Contenu signalé dans ${organization.name}`;
  const editor = env().EMAIL_CONTACT;
  const appUrl = env().NEXT_PUBLIC_APP_URL;
  const mails = [
    {
      to: owner.email,
      url: `${appUrl}/reglages?espace=${organizationId}#signalements`,
      detail: m.settings.reportsEmailBody,
    },
    // L'éditeur traite depuis sa console, et voit le motif sans ouvrir l'espace.
    { to: editor, url: `${appUrl}/admin#signalements`, detail: m.settings.reportsEmailReason(input.reason) },
  ].filter((mail, index) => index === 1 || mail.to !== editor);
  for (const mail of mails) {
    await sendEmail({
      to: mail.to,
      subject,
      react: createElement(NotificationEmail, {
        body: subject,
        detail: mail.detail,
        url: mail.url,
        cta: m.email.reportCta,
      }),
    }).catch(() => log.error("report_email_failed"));
  }
};

export const listReports = async (userId: string, organizationId: string) => {
  await requireOrgMember(userId, organizationId, "manageOrganization");
  const reports = await prisma.contentReport.findMany({
    where: { organizationId, resolvedAt: null },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  const ids = (type: string) => reports.filter((r) => r.entityType === type).map((r) => r.entityId);
  const [comments, announcements, videos] = await Promise.all([
    prisma.comment.findMany({
      where: { id: { in: ids("comment") }, organizationId },
      select: { id: true, body: true },
    }),
    prisma.announcement.findMany({
      where: { id: { in: ids("announcement") }, organizationId },
      select: { id: true, body: true },
    }),
    prisma.video.findMany({
      where: { id: { in: ids("video") }, organizationId },
      select: { id: true, athlete: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  return reports.map((r) => {
    const video = videos.find((v) => v.id === r.entityId);
    const excerpt = [...comments, ...announcements].find((c) => c.id === r.entityId)?.body;
    return {
      id: r.id,
      entityType: r.entityType as "comment" | "video" | "announcement",
      excerpt: video ? `${video.athlete.firstName} ${video.athlete.lastName}`.trim() : (excerpt ?? null),
      link: video ? `/videos/${video.id}` : null,
      detail: r.detail,
    };
  });
};

export const resolveReport = async (
  userId: string,
  organizationId: string,
  input: { id: string; removeContent: boolean },
) => {
  await requireOrgMember(userId, organizationId, "manageOrganization");
  const report = await prisma.contentReport.findFirst({ where: { id: input.id, organizationId } });
  if (!report) throw notFound();
  if (input.removeContent) {
    if (report.entityType === "comment") {
      await prisma.comment.deleteMany({ where: { id: report.entityId, organizationId } });
    } else if (report.entityType === "announcement") {
      await prisma.announcement.deleteMany({ where: { id: report.entityId, organizationId } });
    } else {
      const video = await prisma.video.findFirst({
        where: { id: report.entityId, organizationId },
        select: { id: true, muxAssetId: true },
      });
      if (video) {
        if (video.muxAssetId && videoEnabled()) await deleteAsset(video.muxAssetId);
        await prisma.video.delete({ where: { id: video.id } });
      }
    }
  }
  await prisma.contentReport.updateMany({
    where: { organizationId, entityType: report.entityType, entityId: report.entityId, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  await audit({
    organizationId,
    actorId: userId,
    action: input.removeContent ? "report_content_removed" : "report_dismissed",
    entity: report.entityType,
    entityId: report.entityId,
  });
};
