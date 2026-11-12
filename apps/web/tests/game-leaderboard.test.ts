import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encodeLog } from "@tartan/game";
import { prisma } from "@/lib/prisma";
import {
  adminBanGameDevice,
  eraseGameScores,
  gameLeaderboard,
  purgeGameData,
  startGameRun,
  submitGameScore,
} from "@/server/game.service";
import { makeUser } from "./helpers";

const setOpen = (value: boolean) =>
  prisma.platformSetting.upsert({
    where: { key: "gameLeaderboardEnabled" },
    create: { key: "gameLeaderboardEnabled", value },
    update: { value },
  });

const device = () => `appareil-${randomUUID()}`;
const ip = () => `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

// Une course sans appui finit toujours : les haies sont percutées, mais la marque est valable.
const play = async (who = device(), address = ip()) => {
  const run = await startGameRun({ event: "hurdles", device: who }, address);
  const later = new Date(Date.now() + 60_000);
  return { run, who, address, later };
};

beforeEach(() => setOpen(true));
afterEach(() => setOpen(false));

describe("classement du jeu", () => {
  it("fermé, il refuse tout essai et ne montre aucune ligne", async () => {
    await setOpen(false);
    await expect(startGameRun({ event: "hurdles", device: device() }, ip())).rejects.toMatchObject({ status: 404 });
    expect(await gameLeaderboard({ event: "hurdles" })).toEqual({ enabled: false, rows: [] });
  });

  it("rejoue la partie et classe la marque calculée par le serveur, pas celle du navigateur", async () => {
    const { run, who, address, later } = await play();
    const result = await submitGameScore({ token: run.token, device: who, pseudo: "Inès", log: [] }, address, later);
    expect(result.saved).toBe(true);
    expect(result.score).toBeGreaterThan(15_000);
    const board = await gameLeaderboard({ event: "hurdles", period: "all" });
    expect(board.rows.find((row) => row.pseudo === "Inès")?.score).toBe(result.score);
  });

  it("refuse un jeton rejoué, un journal falsifié, une partie trop rapide et un pseudo refusé", async () => {
    const { run, who, address, later } = await play();
    await submitGameScore({ token: run.token, device: who, pseudo: "Malo", log: [] }, address, later);
    await expect(
      submitGameScore({ token: run.token, device: who, pseudo: "Malo", log: [] }, address, later),
    ).rejects.toMatchObject({ status: 409 });

    // Des appuis après l'arrivée : le rejeu les refuse.
    const forged = await play();
    const log = encodeLog([
      { tick: 5_000, channel: 0, press: true },
      { tick: 5_010, channel: 0, press: false },
    ]);
    await expect(
      submitGameScore(
        { token: forged.run.token, device: forged.who, pseudo: "Awa", log },
        forged.address,
        forged.later,
      ),
    ).rejects.toMatchObject({ status: 422 });

    // Une course de quinze secondes envoyée au bout d'une seconde.
    const fast = await play();
    await expect(
      submitGameScore(
        { token: fast.run.token, device: fast.who, pseudo: "Noé", log: [] },
        fast.address,
        new Date(Date.now() + 1_000),
      ),
    ).rejects.toMatchObject({ status: 422 });

    const rude = await play();
    await expect(
      submitGameScore(
        { token: rude.run.token, device: rude.who, pseudo: "connard", log: [] },
        rude.address,
        rude.later,
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("limite le débit d'envoi par adresse", async () => {
    const address = ip();
    const attempts = Array.from({ length: 31 }, () =>
      submitGameScore({ token: randomUUID(), device: device(), pseudo: "Lila", log: [] }, address).catch(
        (error: { status: number }) => error.status,
      ),
    );
    const statuses = [];
    for (const attempt of attempts) statuses.push(await attempt);
    expect(statuses).toContain(429);
  });

  it("efface les scores d'un appareil, bannit un appareil, purge les empreintes d'adresse à 30 jours", async () => {
    const first = await play();
    await submitGameScore(
      { token: first.run.token, device: first.who, pseudo: "Mehdi", log: [] },
      first.address,
      first.later,
    );
    expect((await eraseGameScores({ device: first.who })).erased).toBe(1);

    const banned = await play();
    await submitGameScore(
      { token: banned.run.token, device: banned.who, pseudo: "Sami", log: [] },
      banned.address,
      banned.later,
    );
    const score = await prisma.gameScore.findFirstOrThrow({ where: { pseudo: "Sami" } });
    const admin = await makeUser("Console");
    await prisma.platformAdmin.create({ data: { email: admin.email } });
    await adminBanGameDevice({ email: admin.email, userId: admin.userId }, score.id);
    expect((await gameLeaderboard({ event: "hurdles", period: "all" })).rows.some((row) => row.pseudo === "Sami")).toBe(
      false,
    );
    // L'appareil banni n'entre plus au classement.
    const again = await startGameRun({ event: "hurdles", device: banned.who }, banned.address);
    await expect(
      submitGameScore(
        { token: again.token, device: banned.who, pseudo: "Sami", log: [] },
        banned.address,
        banned.later,
      ),
    ).rejects.toMatchObject({ status: 404 });

    await prisma.gameScore.update({
      where: { id: score.id },
      data: { createdAt: new Date(Date.now() - 31 * 86_400_000) },
    });
    await purgeGameData(new Date());
    expect((await prisma.gameScore.findUniqueOrThrow({ where: { id: score.id } })).ipHash).toBeNull();
  });
});
