import {
  calendarView,
  type AvatarPreset,
  type CalendarView,
  type MeResponse,
  type PreferencesInput,
  type ProfileInput,
  type SpaceSummary,
} from "@tartan/contracts";
import { isStaff, canIn, knownAvatarPreset, plannerServerEnabled } from "@tartan/domain";
import { put } from "@vercel/blob";
import { fromDbDateOrNull, toDbDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { invalid, notFound } from "@/lib/errors";
import { checkedSquareImage, extensionOf } from "@/lib/image-check";
import { w } from "@tartan/i18n/web";
import { ageRestricted, ageStatusOfUser, assertAdultDate, confirmBirthDate, parentalFlowEnabled } from "./age.service";
import { AppError } from "@/lib/errors";
import { m } from "@tartan/i18n";
import { prisma } from "@/lib/prisma";
import { setEmailPreference } from "./email-preferences.service";

// L'espace de démonstration ne se liste que pour la web app, qui sait l'annoncer (bandeau, réglages) : l'API du
// mobile et `/me` ne le montrent pas. Il vient toujours après les espaces réels.
export const listSpaces = async (userId: string, options: { includeDemo?: boolean } = {}): Promise<SpaceSummary[]> => {
  const rows = await prisma.organizationMember.findMany({
    where: { userId, status: "active", ...(options.includeDemo ? {} : { organization: { isDemo: false } }) },
    orderBy: [{ organization: { isDemo: "asc" } }, { createdAt: "asc" }],
    select: {
      role: true,
      user: { select: { profile: { select: { homeOrganizationId: true } } } },
      organization: {
        select: {
          id: true,
          name: true,
          progressionEnabled: true,
          phasesEnabled: true,
          aiPlannerEnabled: true,
          plan: true,
          isDemo: true,
          demoExpiresAt: true,
          kind: true,
        },
      },
    },
  });
  const athletes = await prisma.athlete.findMany({ where: { userId }, select: { id: true, organizationId: true } });
  // Le tri stable garde le premier club rejoint à priorité égale.
  const priority = (row: (typeof rows)[number]) => {
    if (row.organization.isDemo) return 5;
    if (row.organization.kind === "personal") return 4;
    if (row.organization.id === row.user.profile?.homeOrganizationId) return 0;
    if (row.role === "owner") return 1;
    return isStaff(row.role) ? 2 : 3;
  };
  return rows
    .sort((a, b) => priority(a) - priority(b))
    .map((r) => {
      // Le planificateur est coupé dans la démonstration, offre comprise : ni l'onglet, ni l'invitation à payer.
      const planner = plannerServerEnabled(env()) && r.organization.aiPlannerEnabled && !r.organization.isDemo;
      return {
        organizationId: r.organization.id,
        organizationName: r.organization.name,
        progressionEnabled: r.organization.progressionEnabled,
        phasesEnabled: r.organization.phasesEnabled,
        aiPlannerEnabled:
          planner && r.organization.plan !== "discovery" && canIn(r.organization.kind, r.role, "manageSessions"),
        aiPlannerUpgrade:
          planner && r.organization.plan === "discovery" && canIn(r.organization.kind, r.role, "manageSessions"),
        role: r.role,
        athleteId:
          r.role === "athlete" ? (athletes.find((a) => a.organizationId === r.organization.id)?.id ?? null) : null,
        ...(r.organization.isDemo
          ? { isDemo: true, demoExpiresAt: r.organization.demoExpiresAt?.toISOString() ?? null }
          : {}),
        // L'app native en circulation l'ignore et y voit un espace d'athlète : elle valide ses séances sans le reste.
        ...(r.organization.kind === "personal"
          ? { kind: "personal" as const, organizationName: m.personalSpace.name }
          : {}),
      };
    });
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
    avatarPreset: knownAvatarPreset(user.profile?.avatarPreset),
    units: user.profile?.units ?? "kg",
    locale: user.profile?.locale ?? "fr",
    spaces: await listSpaces(userId),
    preferences: {
      homeTone: readTone(user.profile?.homeTone),
      sessionTone: readTone(user.profile?.sessionTone),
      aiConsent: Boolean(user.profile?.aiConsentAt),
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

const readTone = (value: string | null | undefined) => (value === "off" || value === "energetic" ? value : "calm");

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
  if (input.homeOrganizationId) {
    const spaces = await listSpaces(userId);
    if (!spaces.some((s) => s.organizationId === input.homeOrganizationId && s.kind !== "personal")) throw invalid();
    const data = { homeOrganizationId: input.homeOrganizationId };
    await prisma.profile.upsert({ where: { id: userId }, create: { id: userId, ...data }, update: data });
  }
  if (input.homeTone !== undefined || input.sessionTone !== undefined) {
    const data = { homeTone: input.homeTone, sessionTone: input.sessionTone };
    await prisma.profile.upsert({ where: { id: userId }, create: { id: userId, ...data }, update: data });
  }
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
  if (input.aiConsent !== undefined) {
    const aiConsentAt = input.aiConsent ? new Date() : null;
    await prisma.profile.upsert({
      where: { id: userId },
      create: { id: userId, aiConsentAt },
      update: { aiConsentAt },
    });
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
  // Une photo et un avatar prédéfini ne coexistent pas : choisir l'un efface l'autre.
  const avatar = input.avatarPreset
    ? { avatarPreset: input.avatarPreset, avatarUrl: null }
    : input.avatarUrl
      ? { avatarUrl: input.avatarUrl, avatarPreset: null }
      : { avatarUrl: input.avatarUrl, avatarPreset: input.avatarPreset };
  const data = {
    firstName: input.firstName,
    lastName: input.lastName,
    birthDate,
    units: input.units,
    locale: input.locale,
    ...avatar,
  };
  await prisma.$transaction([
    prisma.profile.upsert({ where: { id: userId }, create: { id: userId, ...data }, update: data }),
    prisma.user.update({ where: { id: userId }, data: { name: `${input.firstName} ${input.lastName}`.trim() } }),
  ]);
};

export const displayName = (p: { firstName?: string | null; lastName?: string | null } | null | undefined): string =>
  [p?.firstName, p?.lastName].filter(Boolean).join(" ");

// Ce qu'il faut pour présenter quelqu'un : son nom et de quoi dessiner son avatar.
// Lu par les services qui ont déjà vérifié l'accès à l'espace (`requireOrgMember`).
export type Person = { name: string; avatarUrl: string | null; avatarPreset: AvatarPreset | null };

export const peopleFor = async (userIds: string[]): Promise<Map<string, Person>> => {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const rows = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      profile: { select: { firstName: true, lastName: true, avatarUrl: true, avatarPreset: true } },
    },
  });
  return new Map(
    rows.map((r) => [
      r.id,
      {
        name: displayName(r.profile) || r.name,
        avatarUrl: r.profile?.avatarUrl ?? null,
        avatarPreset: knownAvatarPreset(r.profile?.avatarPreset),
      },
    ]),
  );
};

export const namesFor = async (userIds: string[]): Promise<Map<string, string>> =>
  new Map([...(await peopleFor(userIds))].map(([id, person]) => [id, person.name]));

// Les champs d'avatar d'un auteur, tels que les contrats les exposent.
export const authorAvatar = (person: Person | undefined) => ({
  authorAvatarUrl: person?.avatarUrl ?? null,
  authorAvatarPreset: person?.avatarPreset ?? null,
});

export const firstNameOf = async (userId: string): Promise<string> => {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, profile: { select: { firstName: true } } },
  });
  return row?.profile?.firstName || row?.name.split(" ")[0] || "Ton coach";
};

// La photo arrive recadrée par le navigateur ; le serveur revérifie type, poids et dimensions avant de la stocker.
export const saveAvatar = async (userId: string, file: File): Promise<void> => {
  if (!env().BLOB_READ_WRITE_TOKEN) throw invalid(w.profile.errors.unconfigured);
  const { bytes, info } = await checkedSquareImage(file);
  const blob = await put(`avatars/${userId}/${crypto.randomUUID()}.${extensionOf(info.type)}`, Buffer.from(bytes), {
    access: "public",
    contentType: info.type,
  });
  // L'ancienne photo part en file de suppression par le déclencheur `profiles_enqueue_avatar`.
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, avatarUrl: blob.url },
    update: { avatarUrl: blob.url, avatarPreset: null },
  });
};

// Un avatar prédéfini, ou null pour revenir aux initiales. Dans les deux cas, la photo est retirée.
export const setAvatarPreset = async (userId: string, preset: AvatarPreset | null): Promise<void> => {
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, avatarPreset: preset },
    update: { avatarPreset: preset, avatarUrl: null },
  });
};
