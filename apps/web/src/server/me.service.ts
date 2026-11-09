import {
  calendarView,
  type CalendarView,
  type MeResponse,
  type PreferencesInput,
  type ProfileInput,
  type SpaceSummary,
} from "@tartan/contracts";
import { can, plannerServerEnabled } from "@tartan/domain";
import { put } from "@vercel/blob";
import { fromDbDateOrNull, toDbDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { invalid, notFound } from "@/lib/errors";
import { ageRestricted, ageStatusOfUser, assertAdultDate, confirmBirthDate, parentalFlowEnabled } from "./age.service";
import { AppError } from "@/lib/errors";
import { m } from "@tartan/i18n";
import { prisma } from "@/lib/prisma";
import { setEmailPreference } from "./email-preferences.service";

export const listSpaces = async (userId: string): Promise<SpaceSummary[]> => {
  const rows = await prisma.organizationMember.findMany({
    where: { userId, status: "active" },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
          progressionEnabled: true,
          phasesEnabled: true,
          aiPlannerEnabled: true,
          plan: true,
        },
      },
    },
  });
  const athletes = await prisma.athlete.findMany({ where: { userId }, select: { id: true, organizationId: true } });
  return rows.map((r) => ({
    organizationId: r.organization.id,
    organizationName: r.organization.name,
    progressionEnabled: r.organization.progressionEnabled,
    phasesEnabled: r.organization.phasesEnabled,
    aiPlannerEnabled:
      plannerServerEnabled(env()) &&
      r.organization.aiPlannerEnabled &&
      r.organization.plan !== "discovery" &&
      can(r.role, "manageSessions"),
    aiPlannerUpgrade:
      plannerServerEnabled(env()) &&
      r.organization.aiPlannerEnabled &&
      r.organization.plan === "discovery" &&
      can(r.role, "manageSessions"),
    role: r.role,
    athleteId: r.role === "athlete" ? (athletes.find((a) => a.organizationId === r.organization.id)?.id ?? null) : null,
  }));
};

export const getMe = async (userId: string): Promise<MeResponse> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, profile: true },
  });
  if (!user) throw notFound();
  return {
    id: user.id,
    email: user.email,
    firstName: user.profile?.firstName ?? null,
    lastName: user.profile?.lastName ?? null,
    birthDate: fromDbDateOrNull(user.profile?.birthDate),
    avatarUrl: user.profile?.avatarUrl ?? null,
    units: user.profile?.units ?? "kg",
    locale: user.profile?.locale ?? "fr",
    spaces: await listSpaces(userId),
    preferences: {
      calendarView: parseCalendarView(user.profile?.calendarView),
      calendarViewUpdatedAt: user.profile?.calendarViewUpdatedAt?.toISOString() ?? null,
      notifications: {
        sessions: user.profile?.pushSessions ?? true,
        feedback: user.profile?.pushFeedback ?? true,
        group: user.profile?.pushGroup ?? true,
        product: user.profile?.pushProductUpdates ?? true,
      },
      email: {
        digest: user.profile?.emailDigest ?? true,
        notifications: user.profile?.emailNotifications ?? true,
      },
    },
  };
};

const parseCalendarView = (value: string | null | undefined): CalendarView | null => {
  const parsed = calendarView.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const getCalendarView = async (userId: string): Promise<CalendarView | null> => {
  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { calendarView: true } });
  return parseCalendarView(profile?.calendarView);
};

// Dernier choix gagnant : un appareil revenu du hors-ligne n'écrase pas un choix plus récent.
export const updatePreferences = async (userId: string, input: PreferencesInput): Promise<void> => {
  if (input.email) {
    if (input.email.digest !== undefined) await setEmailPreference(userId, "digest", input.email.digest);
    if (input.email.notifications !== undefined)
      await setEmailPreference(userId, "notifications", input.email.notifications);
  }
  if (input.notifications) {
    const { sessions, feedback, group, product } = input.notifications;
    const data = {
      ...(sessions !== undefined ? { pushSessions: sessions } : {}),
      ...(feedback !== undefined ? { pushFeedback: feedback } : {}),
      ...(group !== undefined ? { pushGroup: group } : {}),
      ...(product !== undefined ? { pushProductUpdates: product } : {}),
    };
    await prisma.profile.upsert({ where: { id: userId }, create: { id: userId, ...data }, update: data });
  }
  if (!input.calendarView) return;
  const at = input.calendarViewUpdatedAt ? new Date(input.calendarViewUpdatedAt) : new Date();
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, calendarView: input.calendarView, calendarViewUpdatedAt: at },
    update: {},
  });
  await prisma.profile.updateMany({
    where: { id: userId, OR: [{ calendarViewUpdatedAt: null }, { calendarViewUpdatedAt: { lte: at } }] },
    data: { calendarView: input.calendarView, calendarViewUpdatedAt: at },
  });
};

export const updateProfile = async (userId: string, input: ProfileInput): Promise<void> => {
  // V1 majeurs : une date ne s'efface pas, et une date mineure ne s'efface pas par une autre.
  const parental = parentalFlowEnabled();
  if (!parental) {
    if ((await ageStatusOfUser(userId)) === "minor") throw ageRestricted();
    if (input.birthDate) {
      const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { birthDate: true } });
      if (!profile?.birthDate) await confirmBirthDate(userId, input.birthDate);
      else if (fromDbDateOrNull(profile.birthDate) !== input.birthDate) {
        await assertAdultDate(input.birthDate, { actorId: userId });
        throw new AppError(409, "age_already_set", m.age.alreadySet);
      }
    }
  }
  const birthDate = !parental
    ? undefined
    : input.birthDate
      ? toDbDate(input.birthDate)
      : input.birthDate === null && parental
        ? null
        : undefined;
  const data = {
    firstName: input.firstName,
    lastName: input.lastName,
    birthDate,
    units: input.units,
    locale: input.locale,
    avatarUrl: input.avatarUrl,
  };
  await prisma.$transaction([
    prisma.profile.upsert({ where: { id: userId }, create: { id: userId, ...data }, update: data }),
    prisma.user.update({ where: { id: userId }, data: { name: `${input.firstName} ${input.lastName}`.trim() } }),
  ]);
};

export const displayName = (p: { firstName?: string | null; lastName?: string | null } | null | undefined): string =>
  [p?.firstName, p?.lastName].filter(Boolean).join(" ");

export const namesFor = async (userIds: string[]): Promise<Map<string, string>> => {
  const rows = await prisma.user.findMany({
    where: { id: { in: [...new Set(userIds)] } },
    select: { id: true, name: true, profile: { select: { firstName: true, lastName: true } } },
  });
  return new Map(rows.map((r) => [r.id, displayName(r.profile) || r.name]));
};

export const firstNameOf = async (userId: string): Promise<string> => {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, profile: { select: { firstName: true } } },
  });
  return row?.profile?.firstName || row?.name.split(" ")[0] || "Ton coach";
};

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

export const saveAvatar = async (userId: string, file: File): Promise<void> => {
  if (!env().BLOB_READ_WRITE_TOKEN) throw invalid("L'envoi de photos n'est pas configuré sur ce serveur.");
  if (!AVATAR_TYPES.includes(file.type)) throw invalid("Choisis une image JPEG, PNG ou WebP.");
  if (file.size > MAX_AVATAR_BYTES) throw invalid("Cette image dépasse 4 Mo.");
  const blob = await put(`avatars/${userId}/${crypto.randomUUID()}`, file, {
    access: "public",
    contentType: file.type,
  });
  await prisma.profile.update({ where: { id: userId }, data: { avatarUrl: blob.url } });
};
