import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import type { PlannerInterpretation, CreatePlannerProposalInput } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import {
  createPlannerProposal,
  clarifyPlannerProposal,
  getPlannerProposal,
  purgePlannerProposals,
  preparePlannerDrafts,
  confirmPlannerProposal,
  previewPlannerLoads,
} from "@/server/ai/proposal.service";
import { pseudonymizePlannerText, type PlannerBindings } from "@/server/ai/context";
import type { PlannerProvider, PlannerProviderContext } from "@/server/ai/provider";
import { expirePlannerOperations } from "@/server/ai/usage.service";
import { saveTrainingPhase } from "@/server/training-phases.service";
import { selectStrengthReference } from "@/server/strength.service";
import { addStaff, addAthlete, makeOrg } from "./helpers";
const flags = vi.hoisted(() => ({ AI_PLANNER_ENABLED: "true" }));
vi.mock("@/lib/env", async (original) => {
  const actual = await original<typeof import("@/lib/env")>();
  return { ...actual, env: () => ({ ...actual.env(), ...flags }) };
});
const now = new Date("2030-06-01T12:00:00Z"),
  clock = () => now;
beforeEach(() => {
  flags.AI_PLANNER_ENABLED = "true";
});
const clarification = (): PlannerInterpretation => ({
  status: "clarification",
  sessions: [],
  assumptions: [],
  suggestions: [],
  questions: [{ id: "rest", field: "rest", question: "Quelle récupération entre les séries ?", options: [] }],
});
const proposal = (context: PlannerProviderContext): PlannerInterpretation => ({
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
              instruction: context.instructions[0]!,
              prescription: {
                sets: 3,
                reps: 4,
                restS: 120,
                load: { type: "kg", value: 40 },
                intensityTarget: null,
                tempo: null,
                distanceM: null,
                durationS: null,
                contacts: null,
                notes: null,
              },
            },
          ],
        },
      ],
    },
  ],
});
const provider = (
  result: (context: PlannerProviderContext) => PlannerInterpretation = proposal,
): PlannerProvider & { interpret: ReturnType<typeof vi.fn<PlannerProvider["interpret"]>> } => ({
  interpret: vi.fn(async (context) => result(context)),
});
async function setup() {
  const a = await makeOrg("PropositionIA");
  await prisma.organization.update({ where: { id: a.organizationId }, data: { aiPlannerEnabled: true } });
  await prisma.group.update({ where: { id: a.groupId }, data: { name: "Vitesse (A)" } });
  const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: a.organizationId } });
  const input: CreatePlannerProposalInput = {
    id: randomUUID(),
    requestedAt: now.toISOString(),
    reviewed: true,
    selection: {
      period: { from: "2030-06-03", to: "2030-06-09" },
      groupIds: [a.groupId],
      athleteIds: [],
      exerciseIds: [exercise.id],
      phaseChoices: [],
    },
    text: `Vitesse (A) : ${exercise.name}, trois séries de quatre à quarante kilos, deux minutes de repos.`,
  };
  const create = (p = provider(), value = input) =>
    createPlannerProposal(a.owner.userId, a.organizationId, value, { provider: p, clock });
  return { ...a, input, exercise, create };
}
it("conserve une proposition privée, sans séance écrite, et retrouve la réponse perdue sans appel", async () => {
  const a = await setup(),
    p = provider();
  const first = await a.create(p),
    replay = await a.create(p);
  expect(first).toMatchObject({ state: "proposal", version: 2, clarificationCount: 0 });
  expect(replay).toEqual(first);
  expect(p.interpret).toHaveBeenCalledTimes(1);
  expect(p.interpret.mock.calls[0]![0].instructions[0]).toContain("group_1");
  expect(JSON.stringify(p.interpret.mock.calls[0]![0])).not.toContain("Vitesse (A)");
  expect(await prisma.scheduledSession.count({ where: { organizationId: a.organizationId } })).toBe(0);
  expect(
    await prisma.aiPlannerQuota.findUniqueOrThrow({
      where: { organizationId_month: { organizationId: a.organizationId, month: "2030-06" } },
    }),
  ).toMatchObject({ usedProposals: 1, reservedProposals: 0 });
});
it("ne lance qu’une génération pour deux demandes simultanées", async () => {
  const a = await setup();
  let finish!: () => void, began!: () => void;
  const started = new Promise<void>((resolve) => {
    began = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const p = {
    interpret: vi.fn(async (context: PlannerProviderContext) => {
      began();
      await blocked;
      return proposal(context);
    }),
  };
  const first = a.create(p);
  await started;
  try {
    expect((await a.create(p)).state).toBe("processing");
  } finally {
    finish();
  }
  expect((await first).state).toBe("proposal");
  expect(p.interpret).toHaveBeenCalledTimes(1);
});
it("inclut cinq clarifications, déduplique les réponses et bloque le sixième échange", async () => {
  const a = await setup(),
    p = provider(clarification);
  let current = await a.create(p);
  for (let i = 0; i < 5; i++) {
    const input = {
      operationId: randomUUID(),
      expectedVersion: current.version,
      text: `Réponse ${i + 1} : deux minutes.`,
      reviewed: true as const,
    };
    current = await clarifyPlannerProposal(a.owner.userId, a.organizationId, a.input.id, input, { provider: p, clock });
    const replay = await clarifyPlannerProposal(a.owner.userId, a.organizationId, a.input.id, input, {
      provider: p,
      clock,
    });
    expect(replay).toEqual(current);
  }
  expect(current).toMatchObject({ clarificationCount: 5, version: 7 });
  expect(p.interpret).toHaveBeenCalledTimes(6);
  expect(current.messages).toHaveLength(6);
  await expect(
    clarifyPlannerProposal(
      a.owner.userId,
      a.organizationId,
      a.input.id,
      { operationId: randomUUID(), expectedVersion: current.version, text: "Encore", reviewed: true },
      { provider: p, clock },
    ),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    await prisma.aiPlannerQuota.findUniqueOrThrow({
      where: { organizationId_month: { organizationId: a.organizationId, month: "2030-06" } },
    }),
  ).toMatchObject({ usedProposals: 1, reservedProposals: 0 });
});
it("un échec de clarification garde le résultat précédent, sans perdre un échange ni augmenter le quota", async () => {
  const a = await setup();
  const initial = await a.create(provider(clarification));
  const failing = {
    interpret: vi.fn(async () => {
      throw new Error("private provider failure");
    }),
  };
  const answer = {
    operationId: randomUUID(),
    expectedVersion: initial.version,
    text: "Deux minutes",
    reviewed: true as const,
  };
  await expect(
    clarifyPlannerProposal(a.owner.userId, a.organizationId, a.input.id, answer, { provider: failing, clock }),
  ).rejects.toMatchObject({ code: "planner_generation_failed" });
  const read = await getPlannerProposal(a.owner.userId, a.organizationId, a.input.id, now);
  expect(read).toMatchObject({ state: "clarification", version: initial.version, clarificationCount: 0 });
  expect(read.pendingText).toContain("Deux minutes");
  const ready = await clarifyPlannerProposal(
    a.owner.userId,
    a.organizationId,
    a.input.id,
    { ...answer, operationId: randomUUID() },
    { provider: provider(), clock },
  );
  expect(ready).toMatchObject({ state: "proposal", clarificationCount: 1 });
});
it("refuse un autre auteur, un autre espace et une cible révoquée sans révéler les textes", async () => {
  const a = await setup(),
    other = await makeOrg("AutreIA");
  await a.create();
  const coach = await addStaff(a.organizationId, "AutreAuteur", "coach", [a.groupId]);
  await expect(getPlannerProposal(coach.userId, a.organizationId, a.input.id, now)).rejects.toMatchObject({
    status: 403,
  });
  await expect(getPlannerProposal(other.owner.userId, a.organizationId, a.input.id, now)).rejects.toMatchObject({
    status: 403,
  });
  const coachInput = { ...a.input, id: randomUUID() };
  await createPlannerProposal(coach.userId, a.organizationId, coachInput, { provider: provider(), clock });
  await prisma.groupCoach.deleteMany({ where: { userId: coach.userId, groupId: a.groupId } });
  await expect(getPlannerProposal(coach.userId, a.organizationId, coachInput.id, now)).rejects.toMatchObject({
    status: 403,
  });
});
it("une modification d’exercice pendant la génération refuse le résultat et restitue le quota", async () => {
  const a = await setup();
  const p = {
    interpret: vi.fn(async (context: PlannerProviderContext) => {
      await prisma.exercise.update({
        where: { id: a.exercise.id },
        data: { name: "Variante modifiée", updatedAt: new Date("2030-06-01T12:01:00Z") },
      });
      return proposal(context);
    }),
  };
  await expect(a.create(p)).rejects.toMatchObject({ status: 409, code: "planner_context_changed" });
  expect((await getPlannerProposal(a.owner.userId, a.organizationId, a.input.id, now)).state).toBe("failed");
  expect(
    await prisma.aiPlannerQuota.findUniqueOrThrow({
      where: { organizationId_month: { organizationId: a.organizationId, month: "2030-06" } },
    }),
  ).toMatchObject({ usedProposals: 0, reservedProposals: 0 });
});
it("expire les textes sous sept jours et ne recrée pas une vieille demande après purge", async () => {
  const a = await setup(),
    p = provider();
  await a.create(p);
  const deadline = new Date(now.getTime() + 7 * 86400000);
  await expect(getPlannerProposal(a.owner.userId, a.organizationId, a.input.id, deadline)).rejects.toMatchObject({
    status: 410,
  });
  flags.AI_PLANNER_ENABLED = "false";
  await purgePlannerProposals(deadline);
  expect(await prisma.aiPlannerProposal.count({ where: { id: a.input.id } })).toBe(0);
  await expirePlannerOperations(new Date("2030-07-10T00:00:00Z"));
  flags.AI_PLANNER_ENABLED = "true";
  await expect(
    createPlannerProposal(a.owner.userId, a.organizationId, a.input, {
      provider: p,
      clock: () => new Date("2030-07-10T00:00:00Z"),
    }),
  ).rejects.toMatchObject({ status: 410 });
  expect(p.interpret).toHaveBeenCalledTimes(1);
});
it("le drapeau coupe toute préparation et un quota épuisé ne conserve aucun nouveau texte", async () => {
  const a = await setup(),
    p = provider();
  flags.AI_PLANNER_ENABLED = "false";
  await expect(a.create(p)).rejects.toMatchObject({ code: "planner_disabled" });
  flags.AI_PLANNER_ENABLED = "true";
  await prisma.aiPlannerQuota.create({
    data: { organizationId: a.organizationId, month: "2030-06", usedProposals: 30 },
  });
  await expect(a.create(p)).rejects.toMatchObject({ status: 429 });
  expect(p.interpret).not.toHaveBeenCalled();
  expect(await prisma.aiPlannerProposal.count({ where: { organizationId: a.organizationId } })).toBe(0);
});
it("pseudonymise les noms connus avec accents et ponctuation, sans attribuer un prénom ambigu", () => {
  const bindings: PlannerBindings = {
    today: "2030-06-01",
    timeZone: "Europe/Paris",
    exercises: [],
    phaseReviews: [],
    phaseCalendar: [],
    targets: [
      { token: "group_1", type: "group", id: randomUUID(), label: "Vitesse (A)", aliases: ["Vitesse (A)"] },
      { token: "athlete_1", type: "athlete", id: randomUUID(), label: "Léa Martin", aliases: ["Léa Martin", "Léa"] },
      { token: "athlete_2", type: "athlete", id: randomUUID(), label: "Léa Dupont", aliases: ["Léa Dupont", "Léa"] },
    ],
  };
  expect(pseudonymizePlannerText("Vitesse (A), LÉA MARTIN et Léa. Cléa reste un autre nom.", bindings)).toBe(
    "group_1, athlete_1 et Léa. Cléa reste un autre nom.",
  );
});

it("confirme des brouillons modifiés une seule fois, sans publication, puis purge les échanges sous 24 heures", async () => {
  const a = await setup(),
    generated = await a.create();
  const review = await preparePlannerDrafts(a.owner.userId, a.organizationId, a.input.id, generated.version, now);
  expect(review.sessions[0]!.draft.blocks[0]!.items[0]!.prescription.load).toEqual({ type: "kg", value: 40 });
  review.sessions[0]!.draft.title = "Force relue par le coach";
  const confirmation = { expectedVersion: review.version, confirmed: true as const, sessions: review.sessions };
  const confirm = () => confirmPlannerProposal(a.owner.userId, a.organizationId, a.input.id, confirmation, now);
  const [one, two] = await Promise.all([confirm(), confirm()]);
  expect(two).toEqual(one);
  const rows = await prisma.scheduledSession.findMany({ where: { organizationId: a.organizationId } });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ title: "Force relue par le coach", publishedAt: null, publishAt: null });
  expect(
    await prisma.notification.count({ where: { payload: { path: ["organizationId"], equals: a.organizationId } } }),
  ).toBe(0);
  expect((await getPlannerProposal(a.owner.userId, a.organizationId, a.input.id, now)).state).toBe("committed");
  const changed = structuredClone(confirmation);
  changed.sessions[0]!.draft.title = "Autre contenu au rejeu";
  await expect(
    confirmPlannerProposal(a.owner.userId, a.organizationId, a.input.id, changed, now),
  ).rejects.toMatchObject({ status: 409 });
  await purgePlannerProposals(new Date(now.getTime() + 86400000));
  expect(await prisma.aiPlannerProposal.count({ where: { id: a.input.id } })).toBe(0);
  expect(await prisma.scheduledSession.count({ where: { organizationId: a.organizationId } })).toBe(1);
});

it("un brouillon invalide annule tout le lot ; ni publication programmée ni confirmation implicite", async () => {
  const a = await setup(),
    generated = await a.create();
  const review = await preparePlannerDrafts(a.owner.userId, a.organizationId, a.input.id, generated.version, now);
  const bad = structuredClone(review.sessions[0]!);
  bad.date = "2030-06-20";
  await expect(
    confirmPlannerProposal(
      a.owner.userId,
      a.organizationId,
      a.input.id,
      { expectedVersion: review.version, confirmed: true, sessions: [review.sessions[0]!, bad] },
      now,
    ),
  ).rejects.toMatchObject({ status: 409 });
  expect(await prisma.scheduledSession.count({ where: { organizationId: a.organizationId } })).toBe(0);
  const base = { expectedVersion: review.version, confirmed: true as const, sessions: review.sessions };
  await expect(
    confirmPlannerProposal(
      a.owner.userId,
      a.organizationId,
      a.input.id,
      { ...base, confirmed: false } as unknown as typeof base,
      now,
    ),
  ).rejects.toThrow();
  const scheduled = { ...base, sessions: base.sessions.map((s) => ({ ...s, publishAt: "2030-06-02T12:00:00Z" })) };
  await expect(
    confirmPlannerProposal(a.owner.userId, a.organizationId, a.input.id, scheduled as unknown as typeof base, now),
  ).rejects.toThrow();
  expect(await prisma.scheduledSession.count({ where: { organizationId: a.organizationId } })).toBe(0);
});

it("un contexte de phase ambigu exige un choix et aucune note privée ne part au modèle", async () => {
  const a = await setup();
  await prisma.organization.update({ where: { id: a.organizationId }, data: { phasesEnabled: true } });
  const other = await prisma.group.create({ data: { organizationId: a.organizationId, name: "Second" } });
  const athlete = await addAthlete(a.organizationId, a.groupId, "PersonnePrivée");
  await prisma.groupMember.create({
    data: { groupId: other.id, athleteId: athlete.athleteId, createdAt: new Date("2020-01-01") },
  });
  for (const groupId of [a.groupId, other.id])
    await saveTrainingPhase(a.owner.userId, a.organizationId, {
      id: randomUUID(),
      expectedVersion: 0,
      name: "Phase privée",
      kind: "development",
      target: { type: "group", id: groupId },
      startDate: "2030-06-03",
      endDate: "2030-06-09",
      objective: "Objectif libre non transmis",
      description: "Description non transmise",
      privateNote: "SECRET_NOTE_IA",
    });
  const p = provider(),
    input = structuredClone(a.input);
  input.selection.groupIds.push(other.id);
  await expect(a.create(p, input)).rejects.toMatchObject({ code: "phase_choice_required" });
  expect(p.interpret).not.toHaveBeenCalled();
  input.selection.phaseChoices = [{ athleteId: athlete.athleteId, groupId: a.groupId }];
  const created = await a.create(p, input);
  const sent = JSON.stringify(p.interpret.mock.calls[0]![0]);
  for (const privateText of [
    "SECRET_NOTE_IA",
    "Objectif libre non transmis",
    "Description non transmise",
    "PersonnePrivée",
    athlete.athleteId,
  ])
    expect(sent).not.toContain(privateText);
  expect(p.interpret.mock.calls[0]![0].phaseCalendar).toHaveLength(14);
  const review = await preparePlannerDrafts(a.owner.userId, a.organizationId, input.id, created.version, now);
  expect(review.sessions[0]!.phaseReview).toBeDefined();
  const confirmed = await confirmPlannerProposal(
    a.owner.userId,
    a.organizationId,
    input.id,
    { expectedVersion: review.version, confirmed: true, sessions: review.sessions },
    now,
  );
  const draft = await prisma.scheduledSession.findUniqueOrThrow({ where: { id: confirmed.sessions[0]!.id } });
  expect(draft.phaseContext).not.toBeNull();
  expect(draft.publishedAt).toBeNull();
});

it("une semaine conserve un choix par date quand un cycle de groupe se termine en cours de période", async () => {
  const a = await setup();
  await prisma.organization.update({ where: { id: a.organizationId }, data: { phasesEnabled: true } });
  const other = await prisma.group.create({ data: { organizationId: a.organizationId, name: "Second contexte" } });
  const athlete = await addAthlete(a.organizationId, a.groupId, "Athlète fictif");
  await prisma.groupMember.create({
    data: { groupId: other.id, athleteId: athlete.athleteId, createdAt: new Date("2020-01-01") },
  });
  for (const [groupId, endDate, kind] of [
    [a.groupId, "2030-06-03", "development"],
    [other.id, "2030-06-09", "recovery"],
  ] as const)
    await saveTrainingPhase(a.owner.userId, a.organizationId, {
      id: randomUUID(),
      expectedVersion: 0,
      name: "Phase",
      kind,
      target: { type: "group", id: groupId },
      startDate: "2030-06-03",
      endDate,
      objective: "",
      description: "",
      privateNote: "",
    });
  const input = structuredClone(a.input);
  input.selection.groupIds = [];
  input.selection.athleteIds = [athlete.athleteId];
  input.selection.phaseChoicesByDate = [
    { date: "2030-06-03", choices: [{ athleteId: athlete.athleteId, groupId: a.groupId }] },
  ];
  const p = provider((context) => {
    const result = proposal(context);
    return { ...result, sessions: [result.sessions[0]!, { ...result.sessions[0]!, date: "2030-06-04" }] };
  });
  const created = await a.create(p, input);
  expect(p.interpret.mock.calls[0]![0].phaseCalendar?.map((day) => day.phase?.kind)).toEqual([
    "development",
    "recovery",
    "recovery",
    "recovery",
    "recovery",
    "recovery",
    "recovery",
  ]);
  const review = await preparePlannerDrafts(a.owner.userId, a.organizationId, input.id, created.version, now);
  expect(review.sessions[0]?.phaseReview?.choices).toEqual(input.selection.phaseChoicesByDate[0]!.choices);
  expect(review.sessions[1]?.phaseReview?.choices).toEqual([]);
  const confirmed = await confirmPlannerProposal(
    a.owner.userId,
    a.organizationId,
    input.id,
    { expectedVersion: created.version, confirmed: true, sessions: review.sessions },
    now,
  );
  expect(confirmed.sessions).toHaveLength(2);
  const rows = await prisma.scheduledSession.findMany({
    where: { id: { in: confirmed.sessions.map((s) => s.id) } },
    orderBy: { date: "asc" },
  });
  expect(rows.every((row) => row.publishedAt === null)).toBe(true);
  expect(rows.map((row) => (row.phaseContext as { review: { choices: unknown[] } }).review.choices)).toEqual([
    input.selection.phaseChoicesByDate[0]!.choices,
    [],
  ]);
});

it("prévisualise les charges réelles de référence par pages, sans envoyer les maxima au modèle ni écrire de séance", async () => {
  const a = await setup();
  await prisma.organization.update({ where: { id: a.organizationId }, data: { progressionEnabled: true } });
  await prisma.exercise.update({
    where: { id: a.exercise.id },
    data: { strengthLoadKind: "external_total", loadStepKg: 2.5 },
  });
  const athletes: Awaited<ReturnType<typeof addAthlete>>[] = [];
  for (let i = 0; i < 12; i++) athletes.push(await addAthlete(a.organizationId, a.groupId, `Fictif ${i}`));
  await selectStrengthReference(a.owner.userId, a.organizationId, athletes[0]!.athleteId, a.exercise.id, {
    source: "working",
    valueKg: 100,
  });
  const p = provider(),
    created = await a.create(p);
  const review = await preparePlannerDrafts(a.owner.userId, a.organizationId, a.input.id, created.version, now);
  const session = review.sessions[0]!,
    item = session.draft.blocks[0]!.items[0]!;
  item.prescription.load = { type: "pct_1rm", value: 80, test: `exercise:${a.exercise.id}` };
  session.overrides = [
    { athleteId: athletes[1]!.athleteId, itemRef: item.ref!, prescription: { load: { type: "kg", value: 35 } } },
  ];
  const args = { expectedVersion: created.version, session };
  const first = await previewPlannerLoads(a.owner.userId, a.organizationId, a.input.id, args, now);
  expect(first.athletes).toHaveLength(10);
  expect(first.athleteCount).toBe(12);
  const second = await previewPlannerLoads(
    a.owner.userId,
    a.organizationId,
    a.input.id,
    { ...args, afterAthleteId: first.nextCursor! },
    now,
  );
  expect(second.athletes).toHaveLength(2);
  expect(second.nextCursor).toBeNull();
  const rows = [...first.athletes, ...second.athletes];
  expect(new Set(rows.map((r) => r.id)).size).toBe(12);
  expect(rows.find((r) => r.id === athletes[0]!.athleteId)?.items[0]).toMatchObject({
    resolvedLoadKg: 80,
    source: { value: 100, kind: "working" },
  });
  expect(rows.find((r) => r.id === athletes[1]!.athleteId)?.items[0]).toMatchObject({
    resolvedLoadKg: 35,
    source: null,
  });
  expect(rows.find((r) => r.id === athletes[2]!.athleteId)?.items[0]).toMatchObject({
    resolvedLoadKg: null,
    source: null,
  });
  expect(p.interpret).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(p.interpret.mock.calls[0]![0])).not.toContain("valueKg");
  expect(await prisma.scheduledSession.count({ where: { organizationId: a.organizationId } })).toBe(0);
  expect(await prisma.aiPlannerOperation.count({ where: { organizationId: a.organizationId } })).toBe(1);
  const large = structuredClone(session);
  large.overrides = [];
  large.draft.blocks = Array.from({ length: 12 }, (_, b) => ({
    ref: `large-b${b}`,
    name: "Bloc",
    variant: "club" as const,
    items: Array.from({ length: 60 }, (_, i) => ({
      ref: `large-b${b}-i${i}`,
      exerciseId: a.exercise.id,
      prescription: { sets: 3, reps: 4, load: { type: "kg" as const, value: 40 }, notes: "n".repeat(500) },
    })),
  }));
  const bounded = await previewPlannerLoads(
    a.owner.userId,
    a.organizationId,
    a.input.id,
    { expectedVersion: created.version, session: large },
    now,
  );
  expect(bounded.athletes).toHaveLength(2);
  expect(bounded.offset).toBe(0);
  expect(bounded.athletes.flatMap((athlete) => athlete.items)).toHaveLength(1440);
  expect(JSON.stringify(bounded).length).toBeLessThan(3 * 1024 * 1024);
  const late = await addAthlete(a.organizationId, a.groupId, "Arrivée tardive", { joinedAt: new Date("2030-06-04") });
  const same = await previewPlannerLoads(a.owner.userId, a.organizationId, a.input.id, args, now);
  expect(same.athleteCount).toBe(12);
  await expect(
    previewPlannerLoads(a.owner.userId, a.organizationId, a.input.id, { ...args, afterAthleteId: late.athleteId }, now),
  ).rejects.toMatchObject({ code: "invalid" });
});

it("refuse un aperçu d'un autre auteur et une adaptation d'athlète hors destinataires, y compris à la confirmation", async () => {
  const a = await setup();
  const outside = await addAthlete(a.organizationId, null, "Hors destinataires");
  const colleague = await addStaff(a.organizationId, "Autre coach", "coach", [a.groupId]);
  const created = await a.create(),
    review = await preparePlannerDrafts(a.owner.userId, a.organizationId, a.input.id, created.version, now);
  const session = review.sessions[0]!;
  const missingRef = structuredClone(session);
  delete missingRef.draft.blocks[0]!.items[0]!.ref;
  await expect(
    previewPlannerLoads(
      a.owner.userId,
      a.organizationId,
      a.input.id,
      { expectedVersion: created.version, session: missingRef },
      now,
    ),
  ).rejects.toMatchObject({ code: "planner_proposal_conflict" });
  const unrelatedReference = structuredClone(session);
  unrelatedReference.draft.blocks[0]!.items[0]!.prescription.load = {
    type: "pct_1rm",
    value: 80,
    test: "unrelated_legacy_max",
  };
  await expect(
    previewPlannerLoads(
      a.owner.userId,
      a.organizationId,
      a.input.id,
      { expectedVersion: created.version, session: unrelatedReference },
      now,
    ),
  ).rejects.toMatchObject({ code: "planner_proposal_conflict" });
  await expect(
    previewPlannerLoads(
      colleague.userId,
      a.organizationId,
      a.input.id,
      { expectedVersion: created.version, session },
      now,
    ),
  ).rejects.toMatchObject({ code: "forbidden" });
  session.overrides = [
    {
      athleteId: outside.athleteId,
      itemRef: session.draft.blocks[0]!.items[0]!.ref!,
      prescription: { load: { type: "kg", value: 20 } },
    },
  ];
  await expect(
    previewPlannerLoads(
      a.owner.userId,
      a.organizationId,
      a.input.id,
      { expectedVersion: created.version, session },
      now,
    ),
  ).rejects.toMatchObject({ code: "forbidden" });
  await expect(
    confirmPlannerProposal(
      a.owner.userId,
      a.organizationId,
      a.input.id,
      { expectedVersion: created.version, confirmed: true, sessions: [session] },
      now,
    ),
  ).rejects.toMatchObject({ code: "forbidden" });
  expect(await prisma.scheduledSession.count({ where: { organizationId: a.organizationId } })).toBe(0);
});

it("la suppression du compte retire ses textes et la confirmation ne prolonge pas une demande déjà ancienne", async () => {
  const a = await setup(),
    coach = await addStaff(a.organizationId, "CréateurIA", "coach", [a.groupId]);
  const input = {
    ...a.input,
    id: randomUUID(),
    requestedAt: new Date(now.getTime() - 7 * 86400000 + 60000).toISOString(),
  };
  const created = await createPlannerProposal(coach.userId, a.organizationId, input, { provider: provider(), clock });
  const review = await preparePlannerDrafts(coach.userId, a.organizationId, input.id, created.version, now);
  await confirmPlannerProposal(
    coach.userId,
    a.organizationId,
    input.id,
    { expectedVersion: review.version, confirmed: true, sessions: review.sessions },
    now,
  );
  expect((await prisma.aiPlannerProposal.findUniqueOrThrow({ where: { id: input.id } })).expiresAt.toISOString()).toBe(
    new Date(now.getTime() + 60000).toISOString(),
  );
  await prisma.user.delete({ where: { id: coach.userId } });
  expect(await prisma.aiPlannerProposal.count({ where: { id: input.id } })).toBe(0);
});
