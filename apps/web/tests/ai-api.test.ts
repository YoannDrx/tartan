import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createApiClient } from "@tartan/api-client";
import { prisma } from "@/lib/prisma";
import type { CreatePlannerProposalInput } from "@tartan/contracts";
import type { PlannerProviderContext } from "@/server/ai/provider";
import { POST as create } from "../app/api/v1/orgs/[orgId]/planner/route";
import { GET as usage } from "../app/api/v1/orgs/[orgId]/planner/usage/route";
import { GET as read } from "../app/api/v1/orgs/[orgId]/planner/proposals/[proposalId]/route";
import { POST as clarify } from "../app/api/v1/orgs/[orgId]/planner/proposals/[proposalId]/clarify/route";
import { POST as prepare } from "../app/api/v1/orgs/[orgId]/planner/proposals/[proposalId]/prepare/route";
import { POST as confirm } from "../app/api/v1/orgs/[orgId]/planner/proposals/[proposalId]/confirm/route";
import { addAthlete, makeOrg } from "./helpers";
const mocks = vi.hoisted(() => ({ enabled: "true", interpret: vi.fn() }));
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
beforeEach(() => {
  mocks.enabled = "true";
  mocks.interpret.mockReset().mockImplementation(async (context: PlannerProviderContext) => ({
    status: "clarification",
    sessions: [],
    assumptions: [],
    suggestions: [],
    questions: [{ id: "repos", field: "rest", question: "Quel repos ?", options: [] }],
  }));
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
      const ctx = { params: Promise.resolve({ orgId, proposalId }) };
      const handler =
        parts[6] === "usage"
          ? usage
          : parts[6] !== "proposals"
            ? create
            : parts[8] === "clarify"
              ? clarify
              : parts[8] === "prepare"
                ? prepare
                : parts[8] === "confirm"
                  ? confirm
                  : read;
      const response = await handler(request, ctx);
      if (response.ok) expect(response.headers.get("cache-control")).toBe("private, no-store");
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
  const first = await a.api.createPlannerProposal(a.organizationId, a.input);
  expect(first.state).toBe("clarification");
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
