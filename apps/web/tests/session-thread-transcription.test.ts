import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { sessionThreadTranscriptionInput } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { readThreadTranscriptionSource, saveThreadTranscript } from "@/server/session-thread.service";
import { transcribeSessionThreadVoice } from "@/server/session-thread-transcription.service";

vi.mock("@/server/session-thread.service", () => ({
  readThreadTranscriptionSource: vi.fn(),
  saveThreadTranscript: vi.fn(),
}));

async function fixture() {
  const version = randomUUID();
  const bytes = new Uint8Array(await readFile(new URL("./fixtures/planner-audio/silence.m4a", import.meta.url)));
  let saved: string | null = null;
  vi.mocked(readThreadTranscriptionSource).mockImplementation(async () => ({
    bytes,
    mimeType: "audio/mp4",
    transcript: saved,
  }));
  vi.mocked(saveThreadTranscript).mockImplementation(async (...args) => (saved = args[6]));
  const args = [randomUUID(), randomUUID(), randomUUID(), {}, "root", { consent: true, version }] as const;
  return { args, version };
}

it("requiert un accord positif pour la version du vocal affichée", () => {
  const version = randomUUID();
  for (const input of [{ version }, { version, consent: false }, { consent: true }])
    expect(sessionThreadTranscriptionInput.safeParse(input).success).toBe(false);
});

it("ne transcrit qu’une fois une demande concurrente ou rejouée", async () => {
  const { args, version } = await fixture();
  let started!: () => void;
  let finish!: (text: string) => void;
  const firstCall = new Promise<void>((resolve) => (started = resolve));
  const result = new Promise<string>((resolve) => (finish = resolve));
  const provider = {
    transcribe: vi.fn(async () => {
      started();
      return result;
    }),
  };
  const request = transcribeSessionThreadVoice(...args, provider);
  await firstCall;
  await expect(transcribeSessionThreadVoice(...args, provider)).rejects.toMatchObject({ status: 409 });
  finish("Quatre foulées.");
  expect(await request).toBe("Quatre foulées.");
  expect(await transcribeSessionThreadVoice(...args, provider)).toBe("Quatre foulées.");
  expect(provider.transcribe).toHaveBeenCalledTimes(1);
  expect(await prisma.sessionTranscriptionLease.count({ where: { voiceVersion: version } })).toBe(0);
});

it("permet de réessayer après une panne et revalide la source avant d’enregistrer", async () => {
  const { args, version } = await fixture();
  const provider = { transcribe: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue("Consigne.") };
  await expect(transcribeSessionThreadVoice(...args, provider)).rejects.toMatchObject({ status: 503 });
  vi.mocked(saveThreadTranscript).mockRejectedValueOnce(new Error("source retirée"));
  await expect(transcribeSessionThreadVoice(...args, provider)).rejects.toThrow("source retirée");
  expect(await prisma.sessionTranscriptionLease.count({ where: { voiceVersion: version } })).toBe(0);
});
