import { createHash, randomInt } from "node:crypto";
import {
  gameEraseInput,
  gameLeaderboardQuery,
  gameRunInput,
  gameScoreInput,
  type GameEventId,
} from "@tartan/contracts";
import { containsBlockedWord, startOfWeek } from "@tartan/domain";
import { SIM_VERSION, TICK_HZ, isPlausibleScore, replay, type GameEvent, type SimState } from "@tartan/game";
import { EVENTS } from "@tartan/game/events";
import { m } from "@tartan/i18n";
import { todayIso, toDbDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { AppError, invalid } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "./admin.service";
import { platformSettings } from "./platform-settings.service";

// Le classement du jeu du site. Service public : ni compte ni espace, il ne lit et n'écrit que ses propres tables
// (game_runs, game_scores, game_bans), ce que la matrice d'accès consigne. Il reste fermé tant que le réglage
// `gameLeaderboardEnabled` est éteint dans la console.
//
// Un score n'est jamais cru : le navigateur envoie le journal de ses appuis, le serveur rejoue la partie avec la
// graine qu'il a lui-même tirée, et calcule le score. Ce rejeu prouve qu'un score découle d'appuis valides, pas qu'un
// humain a joué : d'où le jeton à usage unique, le contrôle de durée réelle, le plafond par épreuve, la limitation de
// débit et le bannissement depuis la console.

// Un jeton d'essai vaut 15 minutes ; un score ne peut pas arriver plus vite que la partie ne se joue.
const RUN_TTL_MS = 15 * 60 * 1000;
const PACE_TOLERANCE = 0.9;
const LEADERBOARD_SIZE = 20;
// L'empreinte d'adresse IP n'est gardée que 30 jours.
export const IP_RETENTION_DAYS = 30;

const closed = () => new AppError(404, "game_closed", m.game.leaderboard.closed);

// Empreintes salées par le secret du serveur : ni l'appareil ni l'adresse ne se retrouvent en clair.
const fingerprint = (kind: string, value: string) =>
  createHash("sha256").update(`${kind}:${env().BETTER_AUTH_SECRET}:${value}`).digest("hex");

const eventOf = (id: GameEventId) => EVENTS[id] as unknown as GameEvent<SimState>;

const requireOpen = async () => {
  if (!(await platformSettings()).gameLeaderboardEnabled) throw closed();
};

// Le départ d'un essai : une graine tirée par le serveur, et un jeton qui ne servira qu'une fois.
export const startGameRun = async (raw: unknown, ip: string) => {
  const parsed = gameRunInput.safeParse(raw);
  if (!parsed.success) throw invalid();
  await requireOpen();
  await enforceRateLimit(`game-run:${fingerprint("ip", ip)}`, 120, 3600);
  const run = await prisma.gameRun.create({
    data: {
      eventId: parsed.data.event,
      seed: randomInt(0, 2_147_483_647),
      deviceHash: fingerprint("device", parsed.data.device),
    },
  });
  return { token: run.id, seed: run.seed, event: parsed.data.event };
};

export const submitGameScore = async (raw: unknown, ip: string, now: Date = new Date()) => {
  const parsed = gameScoreInput.safeParse(raw);
  if (!parsed.success) throw new AppError(400, "game_invalid", m.game.leaderboard.invalid);
  await requireOpen();
  const ipHash = fingerprint("ip", ip);
  await enforceRateLimit(`game-score:${ipHash}`, 30, 3600);
  const { token, device, pseudo, log } = parsed.data;
  if (containsBlockedWord(pseudo)) throw new AppError(422, "game_pseudo", m.game.leaderboard.pseudoRefused);
  const deviceHash = fingerprint("device", device);
  if (await prisma.gameBan.findUnique({ where: { deviceHash } })) throw closed();

  // Le jeton est consommé avant tout calcul : un second envoi, même identique, est refusé.
  const used = await prisma.gameRun.updateMany({
    where: { id: token, deviceHash, usedAt: null, createdAt: { gt: new Date(now.getTime() - RUN_TTL_MS) } },
    data: { usedAt: now },
  });
  if (used.count !== 1) throw new AppError(409, "game_token", m.game.leaderboard.tokenUsed);
  const run = await prisma.gameRun.findUniqueOrThrow({ where: { id: token } });

  const event = eventOf(run.eventId as GameEventId);
  const result = replay(event, run.seed, log);
  if (!result.ok || !isPlausibleScore(event, result.score)) {
    throw new AppError(422, "game_replay", m.game.leaderboard.invalid);
  }
  // Une partie ne se joue pas plus vite que son horloge.
  const elapsed = now.getTime() - run.createdAt.getTime();
  if (elapsed < ((result.ticks * 1000) / TICK_HZ) * PACE_TOLERANCE) {
    throw new AppError(422, "game_pace", m.game.leaderboard.invalid);
  }
  // Une marque nulle (mordu, aucune barre) n'entre pas au classement.
  if (result.score <= 0) return { saved: false as const, score: result.score };
  await prisma.gameScore.create({
    data: {
      eventId: run.eventId,
      score: result.score,
      pseudo,
      deviceHash,
      ipHash,
      simVersion: SIM_VERSION,
      ticks: result.ticks,
    },
  });
  return { saved: true as const, score: result.score };
};

// Le classement d'une épreuve, sur la semaine en cours ou depuis toujours : le meilleur score de chaque appareil.
export const gameLeaderboard = async (raw: unknown, now: Date = new Date()) => {
  const parsed = gameLeaderboardQuery.safeParse(raw);
  if (!parsed.success) throw invalid();
  if (!(await platformSettings()).gameLeaderboardEnabled) return { enabled: false as const, rows: [] };
  const { event, period } = parsed.data;
  const lowerIsBetter = eventOf(event).lowerIsBetter;
  const scores = await prisma.gameScore.findMany({
    where: {
      eventId: event,
      hidden: false,
      ...(period === "week" ? { createdAt: { gte: toDbDate(startOfWeek(todayIso(now))) } } : {}),
    },
    orderBy: [{ score: lowerIsBetter ? "asc" : "desc" }, { createdAt: "asc" }],
    take: 500,
    select: { pseudo: true, score: true, createdAt: true, deviceHash: true },
  });
  const seen = new Set<string>();
  const rows = scores
    .filter((row) => (seen.has(row.deviceHash) ? false : (seen.add(row.deviceHash), true)))
    .slice(0, LEADERBOARD_SIZE)
    .map((row, index) => ({ rank: index + 1, pseudo: row.pseudo, score: row.score, at: row.createdAt.toISOString() }));
  return { enabled: true as const, rows };
};

// L'effacement, sans compte : l'appareil qui a joué efface tous ses scores.
export const eraseGameScores = async (raw: unknown) => {
  const parsed = gameEraseInput.safeParse(raw);
  if (!parsed.success) throw invalid();
  const deviceHash = fingerprint("device", parsed.data.device);
  const [scores] = await prisma.$transaction([
    prisma.gameScore.deleteMany({ where: { deviceHash } }),
    prisma.gameRun.deleteMany({ where: { deviceHash } }),
  ]);
  return { erased: scores.count };
};

// La tâche quotidienne : les empreintes d'adresse IP tombent à 30 jours, les jetons inutilisés à une journée.
export const purgeGameData = async (now: Date) => {
  const [ips, runs] = await prisma.$transaction([
    prisma.gameScore.updateMany({
      where: { ipHash: { not: null }, createdAt: { lt: new Date(now.getTime() - IP_RETENTION_DAYS * 86_400_000) } },
      data: { ipHash: null },
    }),
    prisma.gameRun.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 86_400_000) } } }),
  ]);
  return { ips: ips.count, runs: runs.count };
};

// La console : les derniers scores, à masquer ou dont l'appareil est à bannir.
export const adminGameScores = async (actor: { email: string }) => {
  await requireAdmin(actor.email);
  return prisma.gameScore.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, eventId: true, score: true, pseudo: true, hidden: true, createdAt: true },
  });
};

export const adminHideGameScore = async (actor: { email: string }, id: string, hidden: boolean) => {
  await requireAdmin(actor.email);
  await prisma.gameScore.update({ where: { id }, data: { hidden } });
};

export const adminBanGameDevice = async (actor: { email: string; userId: string }, scoreId: string) => {
  await requireAdmin(actor.email);
  const score = await prisma.gameScore.findUniqueOrThrow({ where: { id: scoreId }, select: { deviceHash: true } });
  await prisma.$transaction([
    prisma.gameBan.upsert({
      where: { deviceHash: score.deviceHash },
      create: { deviceHash: score.deviceHash, createdById: actor.userId },
      update: {},
    }),
    prisma.gameScore.updateMany({ where: { deviceHash: score.deviceHash }, data: { hidden: true } }),
  ]);
};
