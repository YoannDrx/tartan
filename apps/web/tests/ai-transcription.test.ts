import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeEach, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  transcribePlannerAudio,
  getPlannerTranscription,
  purgePlannerTranscriptions,
} from "@/server/ai/transcription.service";
import { expirePlannerOperations, getPlannerUsage } from "@/server/ai/usage.service";
import { addAthlete, addStaff, makeOrg } from "./helpers";
const flags = vi.hoisted(() => ({ AI_PLANNER_ENABLED: "true" }));
vi.mock("@/lib/env", async (original) => {
  const actual = await original<typeof import("@/lib/env")>();
  return { ...actual, env: () => ({ ...actual.env(), ...flags }) };
});
const now = new Date("2030-06-01T12:00:00Z");
beforeEach(() => {
  flags.AI_PLANNER_ENABLED = "true";
});
async function setup() {
  const a = await makeOrg("TranscriptionIA");
  await prisma.organization.update({ where: { id: a.organizationId }, data: { aiPlannerEnabled: true } });
  const bytes = new Uint8Array(await readFile(new URL("./fixtures/planner-audio/silence.m4a", import.meta.url)));
  const input = { id: randomUUID(), requestedAt: now.toISOString(), audioProcessingAccepted: true as const };
  const transcribe = vi.fn(async () => "Trois séries de quatre squats à 40 kg.");
  const run = (value = input, userId = a.owner.userId, clock = () => now) =>
    transcribePlannerAudio(userId, a.organizationId, value, bytes, { provider: { transcribe }, clock });
  return { ...a, bytes, input, transcribe, run };
}
it("enregistre le texte et les secondes atomiquement puis retrouve une réponse perdue", async () => {
  const a = await setup();
  const first = await a.run();
  expect(first).toMatchObject({
    state: "ready",
    version: 2,
    text: "Trois séries de quatre squats à 40 kg.",
    expiresAt: "2030-06-02T12:00:00.000Z",
  });
  expect(await a.run()).toEqual(first);
  expect(a.transcribe).toHaveBeenCalledTimes(1);
  const usage = await getPlannerUsage(a.owner.userId, a.organizationId, now);
  expect(usage.used).toEqual({ proposals: 0, audioSeconds: first.audioSeconds });
  expect(usage.reserved).toEqual({ proposals: 0, audioSeconds: 0 });
  const op = await prisma.aiPlannerOperation.findUniqueOrThrow({
    where: { organizationId_id: { organizationId: a.organizationId, id: a.input.id } },
  });
  expect(op.result).toEqual({ transcriptionId: first.id, version: 2 });
  expect(JSON.stringify(op)).not.toContain("squats");
  await expect(a.run({ ...a.input, requestedAt: new Date(now.getTime() - 1000).toISOString() })).rejects.toMatchObject({
    status: 409,
  });
  expect(a.transcribe).toHaveBeenCalledTimes(1);
});
it("ne transmet l'audio qu'une fois pour deux requêtes concurrentes", async () => {
  const a = await setup();
  let release!: (value: string) => void, started!: () => void;
  const begun = new Promise<void>((resolve) => {
    started = resolve;
  });
  a.transcribe.mockImplementation(async () => {
    started();
    return new Promise<string>((resolve) => {
      release = resolve;
    });
  });
  const first = a.run();
  await begun;
  expect((await a.run()).state).toBe("processing");
  expect(a.transcribe).toHaveBeenCalledTimes(1);
  release("Trois séries de quatre squats.");
  expect((await first).state).toBe("ready");
});
it("restitue les secondes après échec sans rejouer le fournisseur sous le même identifiant", async () => {
  const a = await setup();
  a.transcribe.mockRejectedValueOnce(new Error("ne doit pas être affiché"));
  await expect(a.run()).rejects.toMatchObject({ status: 502, code: "planner_transcription_failed" });
  expect(await a.run()).toMatchObject({ state: "failed", text: null });
  expect(a.transcribe).toHaveBeenCalledTimes(1);
  expect((await getPlannerUsage(a.owner.userId, a.organizationId, now)).used.audioSeconds).toBe(0);
  a.transcribe.mockResolvedValueOnce("Nouvelle dictée.");
  expect((await a.run({ ...a.input, id: randomUUID() })).state).toBe("ready");
});
it("refuse un résultat vide et ne conserve pas de texte après expiration du bail", async () => {
  const a = await setup();
  a.transcribe.mockResolvedValueOnce(" ");
  await expect(a.run()).rejects.toMatchObject({ code: "planner_transcription_failed" });
  const later = new Date(now.getTime() + 6 * 60000);
  let current = now;
  a.transcribe.mockImplementationOnce(async () => {
    current = later;
    await expirePlannerOperations(later);
    return "Texte tardif à ne pas conserver";
  });
  const input = { ...a.input, id: randomUUID() };
  await expect(a.run(input, a.owner.userId, () => current)).rejects.toMatchObject({
    code: "planner_transcription_failed",
  });
  const row = await prisma.aiPlannerTranscription.findUniqueOrThrow({ where: { id: input.id } });
  expect(row).toMatchObject({ state: "failed", text: null });
  expect((await getPlannerUsage(a.owner.userId, a.organizationId, later)).used.audioSeconds).toBe(0);
});
it("vérifie droits et flags avant de lire l'audio, et le quota avant le fournisseur", async () => {
  const a = await setup();
  const athlete = await addAthlete(a.organizationId, a.groupId, "SansAudio");
  const other = await makeOrg("SansAccesAudio");
  for (const userId of [athlete.userId, other.owner.userId])
    await expect(transcribePlannerAudio(userId, a.organizationId, a.input, new Uint8Array())).rejects.toMatchObject({
      status: 403,
    });
  flags.AI_PLANNER_ENABLED = "false";
  await expect(a.run()).rejects.toMatchObject({ code: "planner_disabled" });
  flags.AI_PLANNER_ENABLED = "true";
  await prisma.aiPlannerQuota.create({
    data: { organizationId: a.organizationId, month: "2030-06", usedAudioSeconds: 3600 },
  });
  await expect(a.run()).rejects.toMatchObject({ code: "planner_quota_exceeded" });
  expect(a.transcribe).not.toHaveBeenCalled();
  expect(await prisma.aiPlannerTranscription.count({ where: { organizationId: a.organizationId } })).toBe(0);
});
it("refuse la lecture par un autre coach et réévalue une révocation avant d'enregistrer", async () => {
  const a = await setup();
  const coach = await addStaff(a.organizationId, "CoachAudio", "coach", [a.groupId]);
  const saved = await a.run();
  await expect(getPlannerTranscription(coach.userId, a.organizationId, saved.id, now)).rejects.toMatchObject({
    status: 403,
  });
  a.transcribe.mockImplementationOnce(async () => {
    await prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: a.organizationId, userId: coach.userId } },
      data: { status: "suspended" },
    });
    return "Texte non autorisé";
  });
  const input = { ...a.input, id: randomUUID() };
  await expect(a.run(input, coach.userId)).rejects.toMatchObject({ status: 403 });
  expect((await prisma.aiPlannerTranscription.findUniqueOrThrow({ where: { id: input.id } })).text).toBeNull();
  await expirePlannerOperations(new Date(now.getTime() + 6 * 60000));
  expect((await getPlannerUsage(a.owner.userId, a.organizationId, now)).reserved.audioSeconds).toBe(0);
});
it("purge sous 24 heures même IA coupée et ne recrée pas une demande expirée", async () => {
  const a = await setup();
  await a.run();
  const expired = new Date(now.getTime() + 86400000);
  await expect(getPlannerTranscription(a.owner.userId, a.organizationId, a.input.id, expired)).rejects.toMatchObject({
    status: 410,
  });
  flags.AI_PLANNER_ENABLED = "false";
  await purgePlannerTranscriptions(expired);
  expect(await prisma.aiPlannerTranscription.findUnique({ where: { id: a.input.id } })).toBeNull();
  flags.AI_PLANNER_ENABLED = "true";
  await expect(a.run(a.input, a.owner.userId, () => expired)).rejects.toMatchObject({ status: 410 });
  expect(a.transcribe).toHaveBeenCalledTimes(1);
});
it("la suppression du compte efface le texte brut sans effacer la consommation de l'espace", async () => {
  const a = await setup();
  const coach = await addStaff(a.organizationId, "CoachAudio", "coach", [a.groupId]);
  const saved = await a.run(a.input, coach.userId);
  await prisma.user.delete({ where: { id: coach.userId } });
  expect(await prisma.aiPlannerTranscription.findUnique({ where: { id: saved.id } })).toBeNull();
  expect((await getPlannerUsage(a.owner.userId, a.organizationId, now)).used.audioSeconds).toBe(saved.audioSeconds);
});
