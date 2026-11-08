import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createApiClient } from "@tartan/api-client";
import { prisma } from "@/lib/prisma";
import type { CreatePlannerProposalInput } from "@tartan/contracts";
import type { PlannerProviderContext } from "@/server/ai/provider";
import { POST as create } from "../app/api/v1/orgs/[orgId]/planner/route";
import { GET as usage } from "../app/api/v1/orgs/[orgId]/planner/usage/route";
import { GET as read } from "../app/api/v1/orgs/[orgId]/planner/proposals/[proposalId]/route";
import { GET as list } from "../app/api/v1/orgs/[orgId]/planner/proposals/route";
import { POST as clarify } from "../app/api/v1/orgs/[orgId]/planner/proposals/[proposalId]/clarify/route";
import { POST as prepare } from "../app/api/v1/orgs/[orgId]/planner/proposals/[proposalId]/prepare/route";
import { POST as confirm } from "../app/api/v1/orgs/[orgId]/planner/proposals/[proposalId]/confirm/route";
import { POST as preview } from "../app/api/v1/orgs/[orgId]/planner/proposals/[proposalId]/preview/route";
import { POST as transcribe } from "../app/api/v1/orgs/[orgId]/planner/transcriptions/route";
import { GET as readTranscription } from "../app/api/v1/orgs/[orgId]/planner/transcriptions/[transcriptionId]/route";
import { addAthlete, makeOrg } from "./helpers";
import { listSpaces } from "@/server/me.service";
const mocks = vi.hoisted(() => ({ enabled: "true", interpret: vi.fn(), transcribe: vi.fn() }));
vi.mock("@/lib/session", () => ({
  getActorFrom: async (headers: Headers) => {
    const userId = headers.get("x-test-actor");
    return userId ? { userId, email: "test@example.invalid" } : null;
  },
}));
vi.mock("@/lib/env", async (original) => {
  const actual = await original<typeof import("@/lib/env")>();
  return { ...actual, env: () => ({ ...actual.env(), AI_PLANNER_ENABLED: mocks.enabled }) };
});
vi.mock("@/server/ai/provider", async (original) => ({
  ...(await original<typeof import("@/server/ai/provider")>()),
  openAiPlannerProvider: () => ({ interpret: mocks.interpret }),
}));
vi.mock("@/server/ai/transcription-provider", () => ({
  openAiTranscriptionProvider: () => ({ transcribe: mocks.transcribe }),
}));
beforeEach(() => {
  mocks.enabled = "true";
  mocks.transcribe.mockReset().mockResolvedValue("Trois séries de quatre répétitions à quarante kilos.");
  mocks.interpret.mockReset().mockImplementation(async (context: PlannerProviderContext) => ({
    status: "clarification",
    sessions: [],
    assumptions: [],
    suggestions: [],
    questions: [{ id: "repos", field: "rest", question: "Quel repos ?", options: [] }],
  }));
});

it("n'annonce le planificateur qu'avec le rôle, l'offre et les deux drapeaux actifs", async () => {
  const org = await makeOrg();
  const enabled = async () => (await listSpaces(org.owner.userId))[0]?.aiPlannerEnabled;
  expect(await enabled()).toBe(false);
  await prisma.organization.update({ where: { id: org.organizationId }, data: { aiPlannerEnabled: true } });
  expect(await enabled()).toBe(true);
  const athlete = await addAthlete(org.organizationId, org.groupId, "Athlète fictif");
  expect((await listSpaces(athlete.userId))[0]?.aiPlannerEnabled).toBe(false);
  mocks.enabled = "false";
  expect(await enabled()).toBe(false);
  mocks.enabled = "true";
  await prisma.organization.update({ where: { id: org.organizationId }, data: { plan: "discovery" } });
  expect(await enabled()).toBe(false);
});

it("le client transmet l'annulation de la dictée au transport multipart sans renvoi automatique", async () => {
  const abort = new AbortController();
  const body = new FormData();
  body.append("audio", new Blob(["fiction"], { type: "audio/mp4" }), "dictee.m4a");
  const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
    expect(init?.body).toBe(body);
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
    expect(init?.signal).toBe(abort.signal);
    return await new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      abort.abort();
    });
  });
  const client = createApiClient({ baseUrl: "https://test.invalid", fetch: fetcher });
  await expect(client.transcribePlannerAudio(randomUUID(), body, abort.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
const transport = (userId?: string) =>
  createApiClient({
    baseUrl: "https://test.invalid",
    headers: (): Record<string, string> => (userId ? { "x-test-actor": userId } : {}),
    fetch: async (url, init) => {
      const request = new NextRequest(String(url), { ...init, signal: init?.signal ?? undefined });
      const parts = new URL(String(url)).pathname.split("/");
      const orgId = parts[4]!,
        proposalId = parts[7]!;
      const ctx = { params: Promise.resolve({ orgId, proposalId, transcriptionId: proposalId }) };
      const handler =
        parts[6] === "transcriptions"
          ? proposalId
            ? readTranscription
            : transcribe
          : parts[6] === "usage"
            ? usage
            : parts[6] !== "proposals"
              ? create
              : parts[8] === "clarify"
                ? clarify
                : parts[8] === "prepare"
                  ? prepare
                  : parts[8] === "confirm"
                    ? confirm
                    : parts[8] === "preview"
                      ? preview
                      : proposalId
                        ? read
                        : list;
      const response = await handler(request, ctx);
      if (response.ok) expect(response.headers.get("cache-control")).toBe("private, no-store");
      if (parts[6] === "transcriptions" && [401, 403].includes(response.status)) expect(request.bodyUsed).toBe(false);
      return response;
    },
  });
async function setup() {
  const a = await makeOrg("ApiPlanner");
  await prisma.organization.update({ where: { id: a.organizationId }, data: { aiPlannerEnabled: true } });
  const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: a.organizationId } });
  const input: CreatePlannerProposalInput = {
    id: randomUUID(),
    requestedAt: new Date().toISOString(),
    reviewed: true,
    selection: {
      period: { from: "2030-06-03", to: "2030-06-03" },
      groupIds: [a.groupId],
      athleteIds: [],
      exerciseIds: [exercise.id],
      phaseChoices: [],
    },
    text: "Trois séries de quatre répétitions à quarante kilos.",
  };
  return { ...a, input, api: transport(a.owner.userId) };
}
it("fait passer le parcours SDK et routes par les mêmes contrôles jusqu'aux brouillons", async () => {
  const a = await setup();
  const upload = new FormData();
  const metadata = { id: randomUUID(), requestedAt: new Date().toISOString(), audioProcessingAccepted: true };
  upload.set("metadata", JSON.stringify(metadata));
  upload.set(
    "audio",
    new Blob([new Uint8Array(await readFile(new URL("./fixtures/planner-audio/silence.m4a", import.meta.url)))], {
      type: "audio/mp4",
    }),
    "dictation.m4a",
  );
  const transcript = await a.api.transcribePlannerAudio(a.organizationId, upload);
  expect(transcript.state).toBe("ready");
  expect(await a.api.plannerTranscription(a.organizationId, transcript.id)).toEqual(transcript);
  expect(mocks.transcribe).toHaveBeenCalledTimes(1);
  a.input.text = transcript.text!;
  const first = await a.api.createPlannerProposal(a.organizationId, a.input);
  expect(first.state).toBe("clarification");
  expect((await a.api.plannerProposals(a.organizationId)).items.map((p) => p.id)).toEqual([first.id]);
  expect((await a.api.plannerProposals(a.organizationId, { before: first.id })).items).toEqual([]);
  await expect(transport().plannerProposals(a.organizationId)).rejects.toMatchObject({ status: 401 });
  mocks.enabled = "false";
  await expect(a.api.plannerProposals(a.organizationId)).rejects.toMatchObject({ status: 403 });
  mocks.enabled = "true";
  expect((await a.api.plannerProposal(a.organizationId, first.id)).version).toBe(first.version);
  mocks.interpret.mockImplementationOnce(async (context: PlannerProviderContext) => ({
    status: "proposal",
    questions: [],
    assumptions: [],
    suggestions: [],
    sessions: [
      {
        date: "2030-06-03",
        startTime: null,
        title: "Force",
        type: "strength",
        durationMin: 45,
        targetTokens: [context.targets[0]!.token],
        blocks: [
          {
            name: "Force",
            items: [
              {
                exerciseToken: context.exercises[0]!.token,
                instruction: context.instructions[0],
                prescription: {
                  sets: 3,
                  reps: 4,
                  load: { type: "kg", value: 40 },
                  restS: 120,
                  distanceM: null,
                  durationS: null,
                  intensityTarget: null,
                  tempo: null,
                  contacts: null,
                  notes: null,
                },
              },
            ],
          },
        ],
      },
    ],
  }));
  const ready = await a.api.clarifyPlannerProposal(a.organizationId, first.id, {
    operationId: randomUUID(),
    expectedVersion: first.version,
    reviewed: true,
    text: "Deux minutes de repos.",
  });
  const draft = await a.api.preparePlannerDrafts(a.organizationId, first.id, ready.version);
  const previewInput = { expectedVersion: ready.version, session: draft.sessions[0]! };
  expect((await a.api.previewPlannerLoads(a.organizationId, first.id, previewInput)).athleteCount).toBe(0);
  await expect(transport().previewPlannerLoads(a.organizationId, first.id, previewInput)).rejects.toMatchObject({
    status: 401,
  });
  mocks.enabled = "false";
  await expect(a.api.previewPlannerLoads(a.organizationId, first.id, previewInput)).rejects.toMatchObject({
    status: 403,
  });
  mocks.enabled = "true";
  const body = { expectedVersion: ready.version, confirmed: true as const, sessions: draft.sessions };
  const saved = await a.api.confirmPlannerProposal(a.organizationId, first.id, body);
  expect(await a.api.confirmPlannerProposal(a.organizationId, first.id, body)).toEqual(saved);
  expect((await a.api.plannerProposal(a.organizationId, first.id)).draftIds).toEqual(saved.sessions);
  expect(await prisma.scheduledSession.count({ where: { organizationId: a.organizationId, publishedAt: null } })).toBe(
    1,
  );
  expect((await a.api.plannerUsage(a.organizationId)).used.proposals).toBe(1);
  expect(mocks.interpret).toHaveBeenCalledTimes(2);
});
it("refuse non-connecté, athlète, autre espace, flag coupé et entrée non relue avant le fournisseur", async () => {
  const a = await setup();
  const athlete = await addAthlete(a.organizationId, a.groupId, "ApiAthlete");
  const other = await makeOrg("ApiOther");
  for (const [api, status] of [
    [transport(), 401],
    [transport(athlete.userId), 403],
    [transport(other.owner.userId), 403],
  ] as const)
    await expect(api.createPlannerProposal(a.organizationId, a.input)).rejects.toMatchObject({ status });
  mocks.enabled = "false";
  await expect(a.api.createPlannerProposal(a.organizationId, a.input)).rejects.toMatchObject({ status: 403 });
  mocks.enabled = "true";
  await expect(
    a.api.createPlannerProposal(a.organizationId, {
      ...a.input,
      reviewed: false,
    } as unknown as CreatePlannerProposalInput),
  ).rejects.toMatchObject({ status: 400 });
  expect(mocks.interpret).not.toHaveBeenCalled();
  expect(await prisma.aiPlannerOperation.count({ where: { organizationId: a.organizationId } })).toBe(0);
});

it("contrôle l'accès à l'envoi audio avant de lire le multipart et ne révèle pas le texte brut", async () => {
  const a = await setup();
  const athlete = await addAthlete(a.organizationId, a.groupId, "AudioApiAthlete");
  for (const [api, status] of [
    [transport(), 401],
    [transport(athlete.userId), 403],
  ] as const)
    await expect(api.transcribePlannerAudio(a.organizationId, new FormData())).rejects.toMatchObject({ status });
  mocks.enabled = "false";
  await expect(a.api.transcribePlannerAudio(a.organizationId, new FormData())).rejects.toMatchObject({
    code: "planner_disabled",
  });
  mocks.enabled = "true";
  await expect(a.api.transcribePlannerAudio(a.organizationId, new FormData())).rejects.toMatchObject({ status: 400 });
  expect(mocks.transcribe).not.toHaveBeenCalled();
});
