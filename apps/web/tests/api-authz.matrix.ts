import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { CreatePlannerProposalInput } from "@tartan/contracts";
import { addDays } from "@tartan/domain";
import { latestRelease } from "@tartan/i18n";
import { todayIso } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { createPlannerProposal, preparePlannerDrafts } from "@/server/ai/proposal.service";
import { transcribePlannerAudio } from "@/server/ai/transcription.service";
import { addCoachNote } from "@/server/athlete.service";
import { logSession } from "@/server/athlete-view.service";
import { addComment } from "@/server/comm.service";
import { unsubscribeUrl } from "@/server/email-preferences.service";
import { saveExercise } from "@/server/exercise.service";
import { icalLink } from "@/server/ical.service";
import { groupInvitationLink } from "@/server/invitation.service";
import { addPerformance } from "@/server/performance.service";
import {
  getSessionForEdit,
  previewPrescriptionRefresh,
  publishSession,
  saveScheduledSession,
  saveTemplate,
} from "@/server/session.service";
import { saveTrainingPhase } from "@/server/training-phases.service";
import { buildPersonas, sessionCookie, type Personas } from "./personas";

// Matrice d'accès HTTP (T04 de docs/tests/automatisation.md).
// Une ligne par méthode et par route de app/**/route.ts, avec le code attendu pour chaque persona.
// tests/api-authz.test.ts exécute chaque case sur le vrai handler, avec une vraie session,
// et échoue dès qu'une route du dossier n'a pas de ligne ici.

export const PERSONAS = ["anonyme", "autreEspace", "admin", "athlete", "adjoint", "coach", "proprietaire"] as const;
export type PersonaKey = (typeof PERSONAS)[number];
// anonyme       sans session
// autreEspace   propriétaire d'un autre espace, qui vise les identifiants de l'espace principal
// admin         administrateur de la plateforme, membre d'aucun espace
// athlete       athlète du premier groupe, tous accords donnés
// adjoint       coach adjoint, limité au second groupe
// coach         coach invité, responsable du premier groupe
// proprietaire  propriétaire de l'espace principal

export type Call = {
  params?: Record<string, string | string[]>;
  query?: Record<string, string>;
  body?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
};
type Expected = Record<PersonaKey, number>;
export type Row = Expected & {
  route: string;
  call?: (w: World, qui: PersonaKey) => Call | Promise<Call>;
  // Contrôle du contenu d'une réponse acceptée, pour les routes où une fuite coûterait cher.
  verifie?: (texte: string, w: World, qui: PersonaKey) => unknown;
};
export type PublicRow = {
  route: string;
  // Ce qui protège la route à la place d'une session.
  pourquoi: string;
  anonyme: number;
  call?: (w: World) => Call | Promise<Call>;
};

// Textes posés en base : aucun ne doit sortir vers une persona qui n'y a pas droit.
export const SENTINELLES = {
  // Note privée du propriétaire sur l'athlète : lui seul la lit.
  notePrivee: "SENTINELLE-NOTE-PRIVEE",
  // Nom de l'athlète du second groupe, et de celui de l'autre espace.
  autreGroupe: "SENTINELLE-AUTRE-GROUPE",
  autreEspace: "SENTINELLE-AUTRE-ESPACE",
  // Blessure de l'athlète du premier groupe, qui a donné son accord santé.
  sante: "SENTINELLE-SANTE",
  // Blessure d'un athlète sans accord santé : personne d'autre que lui ne la lit.
  santeSansAccord: "SENTINELLE-SANS-ACCORD",
} as const;
const S = SENTINELLES;
export const INTERDITS: Record<PersonaKey, string[]> = {
  anonyme: Object.values(S),
  autreEspace: [S.notePrivee, S.autreGroupe, S.sante, S.santeSansAccord],
  admin: Object.values(S),
  athlete: [S.notePrivee, S.autreGroupe, S.autreEspace, S.santeSansAccord],
  adjoint: [S.notePrivee, S.autreEspace, S.sante, S.santeSansAccord],
  coach: [S.notePrivee, S.autreGroupe, S.autreEspace, S.santeSansAccord],
  proprietaire: [S.autreEspace, S.santeSansAccord],
};

const TODAY = todayIso();
const WEEK = { from: TODAY, to: addDays(TODAY, 6) };
const PLANNER_DAY = "2030-06-03";
const STAFF: readonly PersonaKey[] = ["adjoint", "coach", "proprietaire"];

export type PlannerMode = { reponse: "proposition" | "question" };
type ReadyProposal = {
  id: string;
  version: number;
  sessions: Awaited<ReturnType<typeof preparePlannerDrafts>>["sessions"];
};

const sessionDraftFor = (exerciseId: string) => ({
  title: "Séance de la matrice",
  type: "strength" as const,
  durationMin: 45,
  coachNote: null,
  blocks: [{ name: "Force", variant: "club" as const, items: [{ exerciseId, prescription: { sets: 3, reps: 5 } }] }],
});

export const buildWorld = async (planner: PlannerMode) => {
  const p = await buildPersonas();
  const org = p.main.organizationId;
  const owner = p.proprietaire.userId;

  // Progression, phases et planificateur ouverts : sinon le drapeau répondrait à la place du contrôle d'accès.
  await prisma.organization.update({
    where: { id: org },
    data: { progressionEnabled: true, phasesEnabled: true, aiPlannerEnabled: true },
  });
  await prisma.profile.updateMany({
    where: { id: { in: [owner, p.coach.userId, p.adjoint.userId] } },
    data: { aiConsentAt: new Date() },
  });
  await prisma.athlete.update({
    where: { id: p.athleteAutreGroupe.athleteId },
    data: { lastName: SENTINELLES.autreGroupe },
  });
  await prisma.athlete.update({
    where: { id: p.other.athlete.athleteId },
    data: { lastName: SENTINELLES.autreEspace },
  });
  await addCoachNote(owner, org, p.athlete.athleteId, SENTINELLES.notePrivee);
  const injury = { organizationId: org, bodyArea: "knee", startDate: new Date(`${TODAY}T00:00:00Z`) };
  await prisma.injury.createMany({
    data: [
      { ...injury, athleteId: p.athlete.athleteId, description: SENTINELLES.sante },
      { ...injury, athleteId: p.athleteSansAccord.athleteId, description: SENTINELLES.santeSansAccord },
    ],
  });

  const exercise = await saveExercise(owner, org, {
    name: "Squat de la matrice",
    category: "strength",
    cues: [],
    strengthLoadKind: "external_total",
  });
  const session = await saveScheduledSession(owner, org, {
    date: TODAY,
    startTime: "18:00",
    location: null,
    draft: sessionDraftFor(exercise.id),
    assignments: [{ targetType: "group", targetId: p.main.groups.first }],
    overrides: [],
    publishAt: null,
  });
  await publishSession(owner, org, session.id);
  // Le second groupe a aussi sa séance validée : l'export du suivi a donc de quoi fuir vers le coach du premier.
  const otherSession = await saveScheduledSession(owner, org, {
    date: TODAY,
    startTime: null,
    location: null,
    draft: sessionDraftFor(exercise.id),
    assignments: [{ targetType: "group", targetId: p.main.groups.second }],
    overrides: [],
    publishAt: null,
  });
  await publishSession(owner, org, otherSession.id);
  await logSession(p.athleteAutreGroupe.userId, org, otherSession.id, {
    clientId: "matrice-second-groupe",
    status: "done",
    variantDone: "club",
  });
  const comment = await addComment(owner, org, {
    entityType: "session",
    entityId: session.id,
    body: "Commentaire de la matrice",
  });
  const video = await prisma.video.create({
    data: {
      organizationId: org,
      athleteId: p.athlete.athleteId,
      uploadedBy: owner,
      status: "ready",
      sharedWithAthlete: true,
      scheduledSessionId: session.id,
    },
    select: { id: true },
  });
  const pendingVideo = await prisma.video.create({
    data: { organizationId: org, athleteId: p.athlete.athleteId, uploadedBy: owner, status: "uploading" },
    select: { id: true },
  });
  const club = p.offres.club;
  const invitation = await groupInvitationLink(club.owner.userId, club.organizationId, club.groupId);

  const cookies = {
    anonyme: null,
    autreEspace: await sessionCookie(p.autreEspace.email),
    admin: await sessionCookie(p.admin.email),
    athlete: await sessionCookie(p.athlete.email),
    adjoint: await sessionCookie(p.adjoint.email),
    coach: await sessionCookie(p.coach.email),
    proprietaire: await sessionCookie(p.proprietaire.email),
  } satisfies Record<PersonaKey, string | null>;
  const userIds: Record<Exclude<PersonaKey, "anonyme">, string> = {
    autreEspace: p.autreEspace.userId,
    admin: p.admin.userId,
    athlete: p.athlete.userId,
    adjoint: p.adjoint.userId,
    coach: p.coach.userId,
    proprietaire: owner,
  };

  // Identités que chaque persona n'a aucune raison de recevoir : adresses et fiches hors de sa portée.
  const emails = {
    staff: [p.proprietaire.email, p.coach.email, p.adjoint.email],
    firstGroup: [p.athlete.email, p.athleteSansAccord.email],
    secondGroup: [p.athleteAutreGroupe.email, p.deuxEspaces.email],
  };
  const everyone = [...emails.staff, ...emails.firstGroup, ...emails.secondGroup];
  const hors: Record<PersonaKey, string[]> = {
    anonyme: everyone,
    autreEspace: everyone.filter((email) => email !== p.deuxEspaces.email),
    admin: everyone,
    athlete: [...emails.staff, p.athleteSansAccord.email, ...emails.secondGroup, p.athleteSansAccord.athleteId],
    adjoint: [...emails.firstGroup, p.athleteSansAccord.athleteId],
    coach: [...emails.secondGroup, p.athleteAutreGroupe.athleteId],
    proprietaire: [],
  };

  return {
    p,
    org,
    owner,
    cookies,
    userIds,
    hors,
    planner,
    exerciseId: exercise.id,
    sessionId: session.id,
    commentId: comment.id,
    videoId: video.id,
    pendingVideoId: pendingVideo.id,
    athleteId: p.athlete.athleteId,
    invitationToken: invitation.link.split("/").pop()!,
    icalPath: new URL(await icalLink(p.athleteAutreGroupe.userId, org)).pathname.split("/").slice(-2),
    unsubscribeToken: unsubscribeUrl(p.athleteAutreGroupe.userId, "digest").split("/").pop()!,
    audio: new Uint8Array(await readFile(new URL("./fixtures/planner-audio/silence.m4a", import.meta.url))),
    proposals: new Map<string, ReadyProposal>(),
    transcriptions: new Map<string, string>(),
    phaseWeek: 0,
  };
};
export type World = Awaited<ReturnType<typeof buildWorld>>;

// L'auteur d'une ressource jetable : la persona elle-même si elle encadre, sinon le propriétaire.
// Un adjoint ne gère que ses propres séances : il reçoit donc la sienne, dans son groupe.
const authorOf = (w: World, qui: PersonaKey) => (STAFF.includes(qui) ? w.userIds[qui as "coach"] : w.owner);
const groupOf = (w: World, qui: PersonaKey) => (qui === "adjoint" ? w.p.main.groups.second : w.p.main.groups.first);

const sessionInput = (w: World, qui: PersonaKey) => ({
  date: addDays(TODAY, 1),
  startTime: null,
  location: null,
  draft: sessionDraftFor(w.exerciseId),
  assignments: [{ targetType: "group" as const, targetId: groupOf(w, qui) }],
  overrides: [],
  publishAt: null,
});
const freshDraft = (w: World, qui: PersonaKey) => saveScheduledSession(authorOf(w, qui), w.org, sessionInput(w, qui));

// Deux phases d'une même cible ne se chevauchent pas : chaque création prend une semaine neuve.
const phaseInput = (w: World, qui: PersonaKey) => {
  const startDate = addDays("2031-01-06", 7 * w.phaseWeek++);
  return {
    id: randomUUID(),
    expectedVersion: 0,
    target: { type: "group" as const, id: groupOf(w, qui) },
    name: "Phase de la matrice",
    kind: "general" as const,
    startDate,
    endDate: addDays(startDate, 6),
    objective: "",
    description: "",
    privateNote: "",
  };
};
// Les phases se gèrent sans l'adjoint : la ressource jetable est celle du coach ou du propriétaire.
const freshPhase = (w: World, qui: PersonaKey) =>
  saveTrainingPhase(
    qui === "coach" ? w.userIds.coach : w.owner,
    w.org,
    phaseInput(w, qui === "coach" ? qui : "proprietaire"),
  );

const performanceInput = () => ({
  discipline: "high_jump",
  mark: 1.85,
  unit: "m" as const,
  date: TODAY,
});
const freshPerformance = (w: World) =>
  addPerformance(w.owner, w.org, { ...performanceInput(), athleteId: w.athleteId, clientId: randomUUID() });

const plannerInput = (w: World, qui: PersonaKey): CreatePlannerProposalInput => ({
  id: randomUUID(),
  requestedAt: new Date().toISOString(),
  reviewed: true,
  selection: {
    period: { from: PLANNER_DAY, to: PLANNER_DAY },
    groupIds: [groupOf(w, qui)],
    athleteIds: [],
    exerciseIds: [w.exerciseId],
    phaseChoices: [],
  },
  text: "Trois séries de cinq répétitions à quarante kilos.",
});
// Une proposition appartient à son auteur. Chaque encadrant reçoit la sienne, prête à devenir brouillon.
const readyProposal = async (w: World, qui: PersonaKey): Promise<ReadyProposal> => {
  const author = authorOf(w, qui);
  const known = w.proposals.get(author);
  if (known) return known;
  w.planner.reponse = "proposition";
  const proposal = await createPlannerProposal(
    author,
    w.org,
    plannerInput(w, STAFF.includes(qui) ? qui : "proprietaire"),
  );
  const drafts = await preparePlannerDrafts(author, w.org, proposal.id, proposal.version);
  const ready = { id: proposal.id, version: proposal.version, sessions: drafts.sessions };
  w.proposals.set(author, ready);
  return ready;
};

const org = { anonyme: 401, autreEspace: 403, admin: 403 } as const;
// Tout membre actif de l'espace.
const membres: Expected = { ...org, athlete: 200, adjoint: 200, coach: 200, proprietaire: 200 };
// Propriétaire, coach et adjoint.
const encadrants: Expected = { ...membres, athlete: 403 };
// Ressource du premier groupe : l'adjoint, limité au second, n'y a pas droit.
const encadrantsDuGroupe: Expected = { ...encadrants, adjoint: 403 };
// Propriétaire et coach : gestion des athlètes, invitations, phases.
const gestion = encadrantsDuGroupe;
const proprietaireSeul: Expected = { ...gestion, coach: 403 };
// Séance du premier groupe vue côté coach : elle n'existe ni pour l'athlète ni pour l'adjoint du second groupe.
const horsPortee: Expected = { ...encadrants, athlete: 404, adjoint: 404 };
const athleteSeul: Expected = { ...org, athlete: 200, adjoint: 403, coach: 403, proprietaire: 403 };
// Route de compte : toute personne connectée, sur ses propres données.
const compte = (code = 200): Expected => ({
  anonyme: 401,
  autreEspace: code,
  admin: code,
  athlete: code,
  adjoint: code,
  coach: code,
  proprietaire: code,
});

const athleteParams = (w: World): Call => ({ params: { athleteId: w.athleteId } });
const sessionParams = (w: World): Call => ({ params: { sessionId: w.sessionId } });
const videoParams = (w: World): Call => ({ params: { videoId: w.videoId } });

export const MATRICE: Row[] = [
  // Console de l'éditeur : même l'administrateur est refusé tant que sa passkey n'est pas vérifiée dans la session.
  // Le cas accepté et le contenu du fichier sont dans tests/admin-accounting-export.test.ts.
  { route: "GET /admin/revenus/export", ...compte(403) },
  // Compte : chacun n'agit que sur lui-même.
  { route: "GET /api/v1/me", ...compte() },
  { route: "PATCH /api/v1/me", ...compte(), call: () => ({ body: { firstName: "Prénom", lastName: "Test" } }) },
  {
    route: "GET /api/v1/me/export",
    ...compte(),
    verifie: (texte, w, qui) => {
      // L'export ne contient que le compte qui le demande.
      for (const [other, id] of Object.entries(w.userIds)) if (other !== qui) expectAbsent(texte, id);
    },
  },
  // La date de naissance ne s'écrit qu'une fois : le compte connecté reçoit 409, jamais une réécriture.
  { route: "POST /api/v1/me/age", ...compte(409), call: () => ({ body: { birthDate: "2000-01-01" } }) },
  { route: "PATCH /api/v1/me/preferences", ...compte(), call: () => ({ body: { calendarView: "week" } }) },
  { route: "GET /api/v1/consents", ...compte() },
  { route: "PUT /api/v1/consents", ...compte(), call: () => ({ body: { kind: "video", granted: true } }) },
  {
    route: "POST /api/v1/devices",
    ...compte(),
    call: (_w, qui) => ({ body: { pushToken: `jeton-de-la-matrice-${qui}`, platform: "ios" } }),
  },
  {
    route: "DELETE /api/v1/devices",
    ...compte(),
    call: (_w, qui) => ({ body: { pushToken: `jeton-de-la-matrice-${qui}` } }),
  },
  {
    route: "POST /api/v1/client/check-in",
    ...compte(),
    call: () => ({ body: { installationId: randomUUID(), platform: "ios", appVersion: "1.1.0" } }),
  },
  { route: "GET /api/v1/notifications", ...compte() },
  { route: "POST /api/v1/notifications/read", ...compte(), call: () => ({ body: { all: true } }) },
  { route: "GET /api/v1/releases", ...compte() },
  {
    route: "POST /api/v1/releases/seen",
    ...compte(),
    call: () => ({ body: { releaseId: latestRelease("web")?.id ?? "aucune" } }),
  },
  {
    route: "POST /api/v1/blocks",
    ...compte(),
    call: (w) => ({ body: { userId: w.p.athleteSansAccord.userId } }),
  },
  {
    route: "DELETE /api/v1/blocks",
    ...compte(),
    call: (w) => ({ body: { userId: w.p.athleteSansAccord.userId } }),
  },
  // Inscriptions ouvertes dans la configuration de test : un compte majeur crée son premier espace gratuit.
  {
    route: "POST /api/v1/orgs",
    ...compte(),
    call: () => ({ body: { name: "Espace de la matrice", type: "independent", firstGroupName: "Groupe" } }),
  },
  // Le lien de groupe d'un troisième espace : il ne donne jamais accès à l'espace principal.
  {
    route: "POST /api/v1/invitations/[token]/accept",
    ...compte(),
    call: (w) => ({
      params: { token: w.invitationToken },
      body: {
        firstName: "Invité",
        lastName: "Test",
        birthDate: "2000-01-01",
        consents: { terms: true, health: true, video: true },
      },
    }),
  },

  // Espace.
  { route: "GET /api/v1/orgs/[orgId]", ...membres },
  {
    route: "PATCH /api/v1/orgs/[orgId]",
    ...proprietaireSeul,
    call: () => ({ body: { name: "Coaching Proprio", overdueReminders: true } }),
  },
  { route: "GET /api/v1/orgs/[orgId]/billing", ...encadrants },
  {
    route: "GET /api/v1/orgs/[orgId]/export",
    ...proprietaireSeul,
    // Portabilité de la programmation : ni note privée ni santé, même pour le propriétaire.
    verifie: (texte) => [S.notePrivee, S.sante].forEach((interdit) => expectAbsent(texte, interdit)),
  },
  { route: "GET /api/v1/orgs/[orgId]/offline-urls", ...membres },
  { route: "GET /api/v1/orgs/[orgId]/groups", ...membres },
  {
    route: "POST /api/v1/orgs/[orgId]/groups/[groupId]/link",
    ...gestion,
    call: (w) => ({ params: { groupId: w.p.main.groups.first } }),
  },
  { route: "GET /api/v1/orgs/[orgId]/invitations", ...gestion },
  {
    route: "POST /api/v1/orgs/[orgId]/invitations",
    ...gestion,
    call: (w) => ({ body: { kind: "group_link", groupIds: [w.p.main.groups.first] } }),
  },

  // Vue de l'athlète : réservée à l'athlète, sur lui-même.
  { route: "GET /api/v1/orgs/[orgId]/athlete/today", ...athleteSeul },
  { route: "GET /api/v1/orgs/[orgId]/athlete/calendar", ...athleteSeul, call: () => ({ query: WEEK }) },
  { route: "GET /api/v1/orgs/[orgId]/athlete/file", ...athleteSeul },
  {
    route: "PUT /api/v1/orgs/[orgId]/athlete/consents",
    ...athleteSeul,
    call: () => ({ body: { kind: "video", granted: true } }),
  },
  // Parcours parental fermé en V1 : tout compte connecté reçoit le même refus, sans lecture de l'espace.
  { route: "POST /api/v1/orgs/[orgId]/athlete/parental-consent", ...compte(400) },
  { route: "GET /api/v1/orgs/[orgId]/sessions/[sessionId]/me", ...athleteSeul, call: sessionParams },
  {
    route: "POST /api/v1/orgs/[orgId]/sessions/[sessionId]/attendance",
    ...athleteSeul,
    call: (w) => ({ ...sessionParams(w), body: { status: "present" } }),
  },
  {
    route: "POST /api/v1/orgs/[orgId]/sessions/[sessionId]/log",
    ...athleteSeul,
    call: (w) => ({
      ...sessionParams(w),
      body: { clientId: "matrice-validation", status: "done", variantDone: "club" },
    }),
  },

  // Fiches des athlètes : l'athlète lit la sienne, l'encadrant celles de ses groupes.
  {
    route: "GET /api/v1/orgs/[orgId]/athletes",
    ...membres,
    // Le propriétaire voit les deux groupes ; l'absence du second ailleurs prouve donc quelque chose.
    verifie: (texte, _w, qui) => qui === "proprietaire" && expectPresent(texte, S.autreGroupe),
  },
  {
    route: "GET /api/v1/orgs/[orgId]/athletes/[athleteId]",
    ...membres,
    adjoint: 403,
    call: athleteParams,
    verifie: (texte, _w, qui) => {
      // La blessure sort pour l'athlète et ses coachs, la note privée pour son seul auteur.
      expectPresent(texte, S.sante);
      if (qui === "proprietaire") expectPresent(texte, S.notePrivee);
    },
  },
  {
    route: "GET /api/v1/orgs/[orgId]/athletes/[athleteId]/stats",
    ...membres,
    adjoint: 403,
    call: athleteParams,
  },
  {
    route: "GET /api/v1/orgs/[orgId]/athletes/[athleteId]/exercise-history",
    ...membres,
    adjoint: 403,
    call: athleteParams,
  },
  {
    route: "GET /api/v1/orgs/[orgId]/athletes/[athleteId]/exercise-history/context",
    ...membres,
    adjoint: 403,
    call: athleteParams,
  },
  {
    route: "GET /api/v1/orgs/[orgId]/athletes/[athleteId]/exercise-history/[exerciseId]",
    ...membres,
    adjoint: 403,
    call: (w) => ({ params: { athleteId: w.athleteId, exerciseId: w.exerciseId }, query: WEEK }),
  },
  {
    route: "POST /api/v1/orgs/[orgId]/athletes/[athleteId]/performances",
    ...gestion,
    call: (w) => ({ ...athleteParams(w), body: { ...performanceInput(), clientId: randomUUID() } }),
  },
  {
    route: "PUT /api/v1/orgs/[orgId]/athletes/[athleteId]/performances/[performanceId]",
    ...gestion,
    call: async (w) => {
      const performance = await freshPerformance(w);
      return {
        params: { athleteId: w.athleteId, performanceId: performance.id },
        body: { ...performanceInput(), mark: 1.9, expectedVersion: performance.version },
      };
    },
  },
  {
    route: "DELETE /api/v1/orgs/[orgId]/athletes/[athleteId]/performances/[performanceId]",
    ...gestion,
    call: async (w) => {
      const performance = await freshPerformance(w);
      return {
        params: { athleteId: w.athleteId, performanceId: performance.id },
        query: { expectedVersion: String(performance.version) },
      };
    },
  },
  {
    route: "POST /api/v1/orgs/[orgId]/athletes/[athleteId]/strength-tests",
    ...gestion,
    call: (w) => ({
      ...athleteParams(w),
      body: { exerciseKey: "back_squat", exerciseId: w.exerciseId, value: 100, kind: "one_rm", date: TODAY },
    }),
  },
  {
    route: "GET /api/v1/orgs/[orgId]/athletes/[athleteId]/strength/[exerciseId]",
    ...membres,
    adjoint: 403,
    call: (w) => ({ params: { athleteId: w.athleteId, exerciseId: w.exerciseId } }),
  },
  {
    route: "PUT /api/v1/orgs/[orgId]/athletes/[athleteId]/strength/[exerciseId]",
    ...gestion,
    call: (w) => ({
      params: { athleteId: w.athleteId, exerciseId: w.exerciseId },
      body: { source: "working", valueKg: 80 },
    }),
  },
  { route: "GET /api/v1/orgs/[orgId]/strength-mappings", ...proprietaireSeul },
  {
    route: "POST /api/v1/orgs/[orgId]/strength-mappings",
    ...proprietaireSeul,
    call: (w) => ({
      body: {
        legacyKey: "back_squat",
        exerciseId: w.exerciseId,
        reason: "Rattachement confirmé pour la matrice",
        confirmed: true,
      },
    }),
  },

  // Suivi.
  { route: "GET /api/v1/orgs/[orgId]/tracking", ...membres },
  {
    route: "GET /api/v1/orgs/[orgId]/tracking/export",
    ...encadrants,
    call: () => ({ query: WEEK }),
    // Le fichier du propriétaire couvre tout l'espace, celui du coach son seul groupe.
    verifie: (texte, _w, qui) => qui === "proprietaire" && expectPresent(texte, S.autreGroupe),
  },
  { route: "GET /api/v1/orgs/[orgId]/alerts", ...membres },
  { route: "GET /api/v1/orgs/[orgId]/calendar", ...membres, call: () => ({ query: WEEK }) },
  { route: "GET /api/v1/orgs/[orgId]/analysis/context", ...membres },
  { route: "GET /api/v1/orgs/[orgId]/analysis", ...membres, call: () => ({ query: WEEK }) },

  // Exercices et séances.
  { route: "GET /api/v1/orgs/[orgId]/exercises", ...encadrants },
  {
    route: "POST /api/v1/orgs/[orgId]/exercises",
    ...encadrants,
    call: (_w, qui) => ({ body: { name: `Exercice de la matrice ${qui}`, category: "strength" } }),
  },
  { route: "GET /api/v1/orgs/[orgId]/session-builder", ...encadrants },
  {
    route: "POST /api/v1/orgs/[orgId]/session-templates",
    ...encadrants,
    call: (w) => ({ body: sessionDraftFor(w.exerciseId) }),
  },
  {
    route: "DELETE /api/v1/orgs/[orgId]/session-templates/[templateId]",
    ...encadrants,
    call: async (w, qui) => {
      const template = await saveTemplate(authorOf(w, qui), w.org, sessionDraftFor(w.exerciseId));
      return { params: { templateId: template.id } };
    },
  },
  // Création dans le groupe de la persona : l'adjoint agit dans le sien.
  { route: "POST /api/v1/orgs/[orgId]/sessions", ...encadrants, call: (w, qui) => ({ body: sessionInput(w, qui) }) },
  {
    route: "POST /api/v1/orgs/[orgId]/sessions/publish-batch",
    ...encadrants,
    call: async (w, qui) => {
      const draft = await freshDraft(w, qui);
      return { body: { sessions: [{ id: draft.id, expectedVersion: draft.version }] } };
    },
  },
  // Séance publiée par le propriétaire pour le premier groupe : l'adjoint ne gère que les siennes.
  { route: "GET /api/v1/orgs/[orgId]/sessions/[sessionId]", ...encadrantsDuGroupe, call: sessionParams },
  {
    route: "PUT /api/v1/orgs/[orgId]/sessions/[sessionId]",
    ...encadrants,
    call: async (w, qui) => {
      const draft = await freshDraft(w, qui);
      // Une modification renvoie le brouillon relu, avec les références de ses blocs.
      const edit = await getSessionForEdit(authorOf(w, qui), w.org, draft.id);
      return {
        params: { sessionId: draft.id },
        body: { ...sessionInput(w, qui), draft: edit.draft, expectedVersion: edit.version },
      };
    },
  },
  {
    route: "DELETE /api/v1/orgs/[orgId]/sessions/[sessionId]",
    ...encadrants,
    call: async (w, qui) => ({ params: { sessionId: (await freshDraft(w, qui)).id } }),
  },
  {
    route: "POST /api/v1/orgs/[orgId]/sessions/[sessionId]/publish",
    ...encadrants,
    call: async (w, qui) => {
      const draft = await freshDraft(w, qui);
      return { params: { sessionId: draft.id }, body: { expectedVersion: draft.version } };
    },
  },
  {
    route: "POST /api/v1/orgs/[orgId]/sessions/[sessionId]/autonomous",
    ...encadrants,
    call: async (w, qui) => ({ params: { sessionId: (await freshDraft(w, qui)).id } }),
  },
  // Vue du coach : pour l'athlète comme pour l'adjoint d'un autre groupe, la séance n'existe pas.
  { route: "GET /api/v1/orgs/[orgId]/sessions/[sessionId]/coach", ...horsPortee, call: sessionParams },
  {
    route: "POST /api/v1/orgs/[orgId]/sessions/[sessionId]/roll-call",
    ...horsPortee,
    call: (w) => ({ ...sessionParams(w), body: { entries: [{ athleteId: w.athleteId, status: "present" }] } }),
  },
  {
    route: "POST /api/v1/orgs/[orgId]/sessions/[sessionId]/remind",
    ...horsPortee,
    call: (w) => ({ ...sessionParams(w), body: {} }),
  },
  {
    route: "GET /api/v1/orgs/[orgId]/sessions/[sessionId]/athletes/[athleteId]/log",
    ...encadrantsDuGroupe,
    call: (w) => ({ params: { sessionId: w.sessionId, athleteId: w.athleteId } }),
  },
  {
    route: "POST /api/v1/orgs/[orgId]/sessions/[sessionId]/athletes/[athleteId]/log",
    ...encadrantsDuGroupe,
    call: async (w, qui) => {
      // L'encadrant ne corrige que les séries : la saisie porte les versions de la séance et du retour.
      const [session, log] = await Promise.all([
        prisma.scheduledSession.findUniqueOrThrow({ where: { id: w.sessionId }, select: { version: true } }),
        prisma.sessionLog.findUnique({
          where: { scheduledSessionId_athleteId: { scheduledSessionId: w.sessionId, athleteId: w.athleteId } },
          select: { version: true },
        }),
      ]);
      return {
        params: { sessionId: w.sessionId, athleteId: w.athleteId },
        body: {
          clientId: `matrice-saisie-${qui}`,
          status: "done",
          variantDone: "club",
          detailedSets: [],
          expectedVersion: log?.version ?? 0,
          expectedSessionVersion: session.version,
        },
      };
    },
  },
  { route: "GET /api/v1/orgs/[orgId]/sessions/[sessionId]/refresh-loads", ...encadrantsDuGroupe, call: sessionParams },
  // 400 : accès accordé, puis aucune charge à actualiser dans cette séance sans pourcentage.
  {
    route: "POST /api/v1/orgs/[orgId]/sessions/[sessionId]/refresh-loads",
    ...encadrantsDuGroupe,
    coach: 400,
    proprietaire: 400,
    call: async (w) => {
      const preview = await previewPrescriptionRefresh(w.owner, w.org, w.sessionId);
      return {
        ...sessionParams(w),
        body: { expectedVersion: preview.sessionVersion, token: preview.token, confirmed: true },
      };
    },
  },

  // Phases d'entraînement.
  { route: "GET /api/v1/orgs/[orgId]/phases", ...membres, call: () => ({ query: WEEK }) },
  { route: "POST /api/v1/orgs/[orgId]/phases", ...gestion, call: (w, qui) => ({ body: phaseInput(w, qui) }) },
  { route: "GET /api/v1/orgs/[orgId]/phases/context", ...gestion },
  {
    route: "POST /api/v1/orgs/[orgId]/phases/planning",
    ...encadrants,
    call: (w, qui) => ({ body: { date: TODAY, groupIds: [groupOf(w, qui)], athleteIds: [] } }),
  },
  {
    route: "PUT /api/v1/orgs/[orgId]/phases/[phaseId]/visibility",
    ...gestion,
    call: async (w, qui) => {
      const phase = await freshPhase(w, qui);
      return { params: { phaseId: phase.id }, body: { expectedVersion: phase.version, shared: true } };
    },
  },
  {
    route: "DELETE /api/v1/orgs/[orgId]/phases/[phaseId]",
    ...gestion,
    call: async (w, qui) => {
      const phase = await freshPhase(w, qui);
      return { params: { phaseId: phase.id }, query: { expectedVersion: String(phase.version) } };
    },
  },

  // Vidéos : celle de l'athlète du premier groupe, partagée avec lui.
  {
    route: "GET /api/v1/orgs/[orgId]/videos",
    ...membres,
    verifie: (texte, w, qui) => {
      // L'adjoint du second groupe ne reçoit pas la vidéo du premier.
      if (qui === "adjoint") expectAbsent(texte, w.videoId);
    },
  },
  // 503 : accès accordé, puis Mux absent de la configuration de test. L'envoi réel relève de T10.
  {
    route: "POST /api/v1/orgs/[orgId]/videos",
    ...encadrantsDuGroupe,
    coach: 503,
    proprietaire: 503,
    call: (w) => ({ body: { athleteId: w.athleteId } }),
  },
  // 404 pour l'adjoint : une vidéo hors de sa portée n'existe pas pour lui.
  { route: "GET /api/v1/orgs/[orgId]/videos/[videoId]", ...membres, adjoint: 404, call: videoParams },
  {
    route: "POST /api/v1/orgs/[orgId]/videos/[videoId]/upload",
    ...encadrants,
    adjoint: 404,
    coach: 503,
    proprietaire: 503,
    call: (w) => ({ params: { videoId: w.pendingVideoId } }),
  },
  {
    route: "POST /api/v1/orgs/[orgId]/videos/[videoId]/share",
    ...encadrants,
    adjoint: 404,
    call: (w) => ({ ...videoParams(w), body: { withAthlete: true } }),
  },
  {
    route: "POST /api/v1/orgs/[orgId]/videos/[videoId]/exercise",
    ...encadrants,
    adjoint: 404,
    call: (w) => ({ ...videoParams(w), body: { exerciseId: w.exerciseId } }),
  },
  {
    route: "POST /api/v1/orgs/[orgId]/videos/[videoId]/annotations",
    ...encadrants,
    adjoint: 404,
    call: (w) => ({ ...videoParams(w), body: { tMs: 1200, text: "Remarque de la matrice" } }),
  },
  {
    route: "DELETE /api/v1/orgs/[orgId]/videos/[videoId]/annotations/[annotationId]",
    ...encadrants,
    adjoint: 404,
    call: async (w, qui) => {
      const annotation = await prisma.videoAnnotation.create({
        data: { videoId: w.videoId, authorId: authorOf(w, qui), tMs: 500, text: "À retirer" },
        select: { id: true },
      });
      return { params: { videoId: w.videoId, annotationId: annotation.id } };
    },
  },
  {
    route: "GET /api/v1/orgs/[orgId]/bar-sheet",
    ...membres,
    adjoint: 403,
    call: (w) => ({ query: { athleteId: w.athleteId } }),
  },
  {
    route: "POST /api/v1/orgs/[orgId]/jump-attempts",
    ...encadrantsDuGroupe,
    call: (w) => ({
      body: { athleteId: w.athleteId, barHeightCm: 180, attemptNo: 1, result: "O", clientId: randomUUID() },
    }),
  },

  // Échanges : le fil d'une séance reste à ceux qu'elle concerne.
  {
    route: "GET /api/v1/orgs/[orgId]/comments",
    ...membres,
    adjoint: 404,
    call: (w) => ({ query: { entityType: "session", entityId: w.sessionId } }),
  },
  {
    route: "POST /api/v1/orgs/[orgId]/comments",
    ...membres,
    adjoint: 404,
    call: (w, qui) => ({
      body: { entityType: "session", entityId: w.sessionId, body: `Réponse de la matrice ${qui}` },
    }),
  },
  { route: "GET /api/v1/orgs/[orgId]/announcements", ...membres },
  {
    route: "POST /api/v1/orgs/[orgId]/announcements",
    ...encadrantsDuGroupe,
    call: (w) => ({ body: { groupId: w.p.main.groups.first, body: "Annonce de la matrice" } }),
  },
  {
    route: "POST /api/v1/orgs/[orgId]/reports",
    ...membres,
    call: (w) => ({ body: { entityType: "comment", entityId: w.commentId, reason: "other" } }),
  },

  // Planificateur IA, prestataire simulé : seul le contrôle d'accès est éprouvé ici.
  { route: "GET /api/v1/orgs/[orgId]/planner/usage", ...encadrants },
  {
    route: "POST /api/v1/orgs/[orgId]/planner",
    ...encadrants,
    call: (w, qui) => {
      w.planner.reponse = "proposition";
      return { body: plannerInput(w, qui) };
    },
  },
  { route: "GET /api/v1/orgs/[orgId]/planner/proposals", ...encadrants },
  {
    route: "GET /api/v1/orgs/[orgId]/planner/proposals/[proposalId]",
    ...encadrants,
    call: async (w, qui) => ({ params: { proposalId: (await readyProposal(w, qui)).id } }),
  },
  {
    route: "POST /api/v1/orgs/[orgId]/planner/proposals/[proposalId]/clarify",
    ...encadrants,
    call: async (w, qui) => {
      w.planner.reponse = "question";
      const asked = await createPlannerProposal(
        authorOf(w, qui),
        w.org,
        plannerInput(w, STAFF.includes(qui) ? qui : "proprietaire"),
      );
      w.planner.reponse = "proposition";
      return {
        params: { proposalId: asked.id },
        body: { operationId: randomUUID(), expectedVersion: asked.version, reviewed: true, text: "Deux minutes." },
      };
    },
  },
  {
    route: "POST /api/v1/orgs/[orgId]/planner/proposals/[proposalId]/prepare",
    ...encadrants,
    call: async (w, qui) => {
      const proposal = await readyProposal(w, qui);
      return { params: { proposalId: proposal.id }, body: { expectedVersion: proposal.version } };
    },
  },
  {
    route: "POST /api/v1/orgs/[orgId]/planner/proposals/[proposalId]/preview",
    ...encadrants,
    call: async (w, qui) => {
      const proposal = await readyProposal(w, qui);
      return {
        params: { proposalId: proposal.id },
        body: { expectedVersion: proposal.version, session: proposal.sessions[0] },
      };
    },
  },
  {
    route: "POST /api/v1/orgs/[orgId]/planner/proposals/[proposalId]/confirm",
    ...encadrants,
    call: async (w, qui) => {
      const proposal = await readyProposal(w, qui);
      return {
        params: { proposalId: proposal.id },
        body: { expectedVersion: proposal.version, confirmed: true, sessions: proposal.sessions },
      };
    },
  },
  {
    route: "POST /api/v1/orgs/[orgId]/planner/transcriptions",
    ...encadrants,
    call: (w) => {
      const form = new FormData();
      form.set(
        "metadata",
        JSON.stringify({ id: randomUUID(), requestedAt: new Date().toISOString(), audioProcessingAccepted: true }),
      );
      form.set("audio", new Blob([w.audio], { type: "audio/mp4" }), "dictee.m4a");
      return { form };
    },
  },
  {
    route: "GET /api/v1/orgs/[orgId]/planner/transcriptions/[transcriptionId]",
    ...encadrants,
    call: async (w, qui) => {
      // Une dictée appartient à son auteur, comme une proposition.
      const author = authorOf(w, qui);
      const known =
        w.transcriptions.get(author) ??
        (
          await transcribePlannerAudio(
            author,
            w.org,
            { id: randomUUID(), requestedAt: new Date().toISOString(), audioProcessingAccepted: true },
            w.audio,
          )
        ).id;
      w.transcriptions.set(author, known);
      return { params: { transcriptionId: known } };
    },
  },

  // En dernier : chaque persona supprime réellement son propre compte.
  { route: "DELETE /api/v1/me", ...compte() },
];

// Routes sans session, par construction. Toute entrée dit ce qui la protège à la place.
export const ROUTES_PUBLIQUES: PublicRow[] = [
  { route: "GET /api/live", pourquoi: "Sonde de disponibilité, sans donnée ni lecture de base.", anonyme: 200 },
  { route: "GET /api/health", pourquoi: "Sonde de la base : un statut, aucune donnée.", anonyme: 200 },
  { route: "GET /api/v1/version", pourquoi: "Identifiant du build, lu par tout onglet ouvert.", anonyme: 200 },
  {
    route: "GET /api/v1/releases/status",
    pourquoi: "Version minimale de l'application, lue avant la connexion.",
    anonyme: 200,
    call: () => ({ query: { platform: "ios", version: "1.0.0" } }),
  },
  {
    route: "GET /api/auth/[...all]",
    pourquoi: "Better Auth : la bibliothèque porte ses propres contrôles. Sans session, elle répond null.",
    anonyme: 200,
    call: () => ({ params: { all: ["get-session"] } }),
  },
  {
    route: "POST /api/auth/[...all]",
    pourquoi: "Better Auth : connexion et inscription. Un mot de passe faux est refusé.",
    anonyme: 401,
    call: () => ({
      params: { all: ["sign-in", "email"] },
      body: { email: "inconnu@test.tartan.coach", password: "mot-de-passe-inconnu" },
      headers: { origin: "http://localhost:3000" },
    }),
  },
  { route: "GET /api/cron/hourly", pourquoi: "Jeton CRON_SECRET en en-tête, comparé à temps constant.", anonyme: 401 },
  { route: "GET /api/cron/notifications", pourquoi: "Jeton CRON_SECRET en en-tête.", anonyme: 401 },
  {
    route: "POST /api/webhooks/stripe",
    pourquoi:
      "Signature Stripe du corps brut. Sans secret configuré, comme ici : 503, pour que Stripe renvoie. Avec secret et sans signature : 400. Détail dans T01.",
    anonyme: 503,
    call: () => ({ body: {} }),
  },
  {
    route: "POST /api/webhooks/mux",
    pourquoi: "Signature Mux du corps brut. Sans elle : 400.",
    anonyme: 400,
    call: () => ({ body: {} }),
  },
  {
    route: "POST /api/webhooks/resend",
    pourquoi: "Signature Svix. Sans secret configuré, la route est fermée : 503.",
    anonyme: 503,
    call: () => ({ body: {} }),
  },
  {
    route: "POST /api/webhooks/revenuecat",
    pourquoi: "Jeton partagé en en-tête Authorization. Sans lui : 401. Détail dans T02.",
    anonyme: 401,
    call: () => ({ body: {} }),
  },
  {
    route: "POST /api/email/desinscription/[kind]/[token]",
    pourquoi: "Jeton dérivé du compte, présent dans chaque e-mail. Il ne coupe qu'une famille d'e-mails.",
    anonyme: 200,
    call: (w) => ({ params: { kind: "digest", token: w.unsubscribeToken } }),
  },
  {
    route: "GET /api/ical/[athleteId]/[token]",
    pourquoi: "Lien d'agenda secret et révocable, sans donnée de santé.",
    anonyme: 200,
    call: (w) => ({ params: { athleteId: w.icalPath[0]!, token: w.icalPath[1]! } }),
  },
  {
    route: "GET /api/v1/invitations/[token]",
    pourquoi: "Aperçu d'une invitation avant la connexion : nom de l'espace et du groupe, rien d'autre.",
    anonyme: 200,
    call: (w) => ({ params: { token: w.invitationToken } }),
  },
  {
    route: "GET /r/[code]",
    pourquoi: "Lien de parrainage : pose un cookie et redirige vers le site.",
    anonyme: 307,
    call: () => ({ params: { code: "CODE-INCONNU" } }),
  },
  {
    route: "GET /.well-known/apple-app-site-association",
    pourquoi: "Fichier public exigé par Apple pour les liens universels.",
    anonyme: 200,
  },
  {
    route: "GET /.well-known/assetlinks.json",
    pourquoi: "Fichier public exigé par Android pour les liens d'application.",
    anonyme: 200,
  },
];

// Routes protégées dont l'exécution demande un autre banc : la raison renvoie au test qui les couvre.
export const ROUTES_REPORTEES: { route: string; pourquoi: string }[] = [];

function expectPresent(texte: string, attendu: string) {
  if (!texte.includes(attendu)) throw new Error(`La réponse devait contenir « ${attendu} ».`);
}
function expectAbsent(texte: string, interdit: string) {
  if (texte.includes(interdit)) throw new Error(`La réponse contient « ${interdit} », qui ne devait pas sortir.`);
}
