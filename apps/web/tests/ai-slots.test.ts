import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmPlannerProposalInput,
  PLANNER_SLOT_EXERCISE_ID,
  type CreatePlannerProposalInput,
  type PlannerCapability,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { prisma } from "@/lib/prisma";
import { listExerciseTermAliases } from "@/server/ai/alias.service";
import { fakePlannerProvider } from "@/server/ai/fake-provider";
import {
  clarifyPlannerProposal,
  confirmPlannerProposal,
  createPlannerProposal,
  getPlannerProposal,
  matchPlannerTerms,
  preparePlannerDrafts,
  resolvePlannerExercise,
} from "@/server/ai/proposal.service";
import { plannerVocabulary } from "@/server/ai/transcription.service";
import { saveExercise } from "@/server/exercise.service";
import { makeOrg } from "./helpers";

// Le service du planificateur en quatre étapes, avec sa base : emplacements à compléter, alias appris, clients
// d'avant, pannes par étape. Le prestataire est le prestataire simulé : les règles du serveur s'appliquent à lui.

const flags = vi.hoisted(() => ({ AI_PLANNER_ENABLED: "true" }));
vi.mock("@/server/ai/consent.service", () => ({
  requireAiConsent: async () => undefined,
  hasAiConsent: async () => true,
}));
vi.mock("@/lib/env", async (original) => {
  const actual = await original<typeof import("@/lib/env")>();
  return { ...actual, env: () => ({ ...actual.env(), ...flags }) };
});
// Samedi 1er juin 2030 ; la demande vise le lundi 3 juin, choisi à l'écran.
const now = new Date("2030-06-01T12:00:00Z"),
  clock = () => now;
beforeEach(() => {
  flags.AI_PLANNER_ENABLED = "true";
});

const spied = () => {
  const provider = fakePlannerProvider();
  return {
    provider,
    understand: vi.spyOn(provider, "understand"),
    match: vi.spyOn(provider, "match"),
    compose: vi.spyOn(provider, "compose"),
    repair: vi.spyOn(provider, "repair"),
  };
};
async function setup(name: string) {
  const a = await makeOrg(name);
  await prisma.organization.update({ where: { id: a.organizationId }, data: { aiPlannerEnabled: true } });
  const exercise = async (label: string) => ({
    name: label,
    id: (
      await saveExercise(a.owner.userId, a.organizationId, {
        name: label,
        category: "strength",
        classification: { movement: null, equipment: [] },
      })
    ).id,
  });
  const sled = await exercise(`Poussée traîneau ${name}`);
  const rope = await exercise(`Tirage corde ${name}`);
  const input = (text: string, accepts?: PlannerCapability[], groupIds = [a.groupId]): CreatePlannerProposalInput => ({
    id: randomUUID(),
    requestedAt: now.toISOString(),
    reviewed: true,
    text,
    ...(accepts ? { accepts } : {}),
    selection: {
      period: { from: "2030-06-03", to: "2030-06-03" },
      groupIds,
      athleteIds: [],
      exerciseIds: [],
      phaseChoices: [],
    },
  });
  const create = (text: string, accepts?: PlannerCapability[], provider = fakePlannerProvider(), groupIds?: string[]) =>
    createPlannerProposal(a.owner.userId, a.organizationId, input(text, accepts, groupIds), { provider, clock });
  return { ...a, sled, rope, input, create };
}
const NEW: PlannerCapability[] = ["slots", "checks"];
const tokensOf = (proposal: Awaited<ReturnType<typeof getPlannerProposal>>) =>
  proposal.interpretation!.sessions.flatMap((s) => s.blocks.flatMap((b) => b.items.map((i) => i.exerciseToken)));
const nameOf = (proposal: Awaited<ReturnType<typeof getPlannerProposal>>, token: string) =>
  proposal.exercises.find((exercise) => exercise.token === token)?.name;
const resolve = (
  a: Awaited<ReturnType<typeof setup>>,
  proposal: { id: string; version: number },
  choice: Parameters<typeof resolvePlannerExercise>[3]["choice"],
  slot = "slot_1",
  requestedName = "Saut du dragon",
) =>
  resolvePlannerExercise(
    a.owner.userId,
    a.organizationId,
    proposal.id,
    { operationId: randomUUID(), expectedVersion: proposal.version, questionId: slot, requestedName, choice },
    now,
  );

describe("emplacement à compléter", () => {
  it("garde la séance écrite, refuse le brouillon tant qu'il reste, se remplit sans modèle, puis l'alias est relu", async () => {
    const a = await setup("Emplacement");
    const calls = spied();
    const text = `${a.sled.name}, 3 séries de 8, puis Saut du dragon, 3 séries de 5.`;
    const created = await a.create(text, NEW, calls.provider);
    // Une fiche absente ne bloque pas : la séance est écrite, l'exercice attend sa fiche à sa place.
    expect(created).toMatchObject({ state: "proposal", clarificationCount: 0 });
    expect(created.interpretation!.questions).toEqual([]);
    expect(tokensOf(created).at(-1)).toBe("slot_1");
    expect(nameOf(created, tokensOf(created)[0]!)).toBe(a.sled.name);
    expect(created.slots).toMatchObject([
      { id: "slot_1", said: "Saut du dragon", session: 0, suggestion: { name: "Saut du dragon" } },
    ]);
    expect(created.understanding).toMatchObject({
      intent: "described",
      movements: [
        { said: a.sled.name, confidence: "exact", exercise: { exerciseId: a.sled.id } },
        { said: "Saut du dragon", confidence: "absent", exercise: null },
      ],
    });
    const drafts = await preparePlannerDrafts(a.owner.userId, a.organizationId, created.id, created.version, now);
    const items = drafts.sessions[0]!.draft.blocks[0]!.items;
    expect(items.at(-1)).toMatchObject({ exerciseId: PLANNER_SLOT_EXERCISE_ID, prescription: { sets: 3, reps: 8 } });
    expect(drafts.slots).toMatchObject([{ id: "slot_1", said: "Saut du dragon", itemRef: items.at(-1)!.ref }]);
    // Le serveur refuse le brouillon tant qu'un emplacement reste, même si le client a mis une fiche à la main.
    const forced = confirmPlannerProposalInput.parse({
      expectedVersion: created.version,
      confirmed: true,
      sessions: drafts.sessions.map((session) => ({
        ...session,
        draft: {
          ...session.draft,
          blocks: session.draft.blocks.map((block) => ({
            ...block,
            items: block.items.map((item) =>
              item.exerciseId === PLANNER_SLOT_EXERCISE_ID ? { ...item, exerciseId: a.rope.id } : item,
            ),
          })),
        },
      })),
    });
    await expect(confirmPlannerProposal(a.owner.userId, a.organizationId, created.id, forced, now)).rejects.toMatchObject(
      { status: 409, code: "planner_slots_open", message: m.aiPlanner.slotsOpen },
    );
    // Le coach choisit une fiche : aucun appel au modèle, aucune réponse écrite, la prescription dite reste.
    const before = [calls.understand, calls.match, calls.compose, calls.repair].map((spy) => spy.mock.calls.length);
    const filled = await resolve(a, created, { kind: "existing", exerciseId: a.rope.id });
    expect([calls.understand, calls.match, calls.compose, calls.repair].map((spy) => spy.mock.calls.length)).toEqual(
      before,
    );
    expect(filled).toMatchObject({ state: "proposal", version: created.version + 1, clarificationCount: 0, slots: [] });
    expect(filled.messages).toEqual([text]);
    expect(nameOf(filled, tokensOf(filled).at(-1)!)).toBe(a.rope.name);
    const ready = await preparePlannerDrafts(a.owner.userId, a.organizationId, created.id, filled.version, now);
    expect(ready.slots).toEqual([]);
    expect(ready.sessions[0]!.draft.blocks[0]!.items.at(-1)).toMatchObject({
      exerciseId: a.rope.id,
      prescription: { sets: 3, reps: 8 },
    });
    const confirmed = await confirmPlannerProposal(
      a.owner.userId,
      a.organizationId,
      created.id,
      confirmPlannerProposalInput.parse({ expectedVersion: filled.version, confirmed: true, sessions: ready.sessions }),
      now,
    );
    expect(confirmed.sessions).toHaveLength(1);

    // Le choix est retenu : à la demande suivante, le terme est reconnu avant tout modèle.
    expect((await listExerciseTermAliases(a.owner.userId, a.organizationId)).aliases).toMatchObject([
      { said: "Saut du dragon", exerciseId: a.rope.id, exerciseName: a.rope.name },
    ]);
    const matchCalls = calls.match.mock.calls.length;
    const again = await a.create("Saut du dragon, 3 séries de 5.", NEW, calls.provider);
    expect(calls.match.mock.calls.length).toBe(matchCalls);
    expect(again).toMatchObject({ state: "proposal", slots: [] });
    expect(nameOf(again, tokensOf(again)[0]!)).toBe(a.rope.name);
    expect(again.understanding!.movements).toMatchObject([{ confidence: "exact", exercise: { exerciseId: a.rope.id } }]);

    // Un alias appris ne quitte jamais son espace : ailleurs, le même terme reste sans fiche.
    const other = await setup("AutreEspace");
    const elsewhere = await other.create("Saut du dragon, 3 séries de 5.", NEW);
    expect(elsewhere.slots).toMatchObject([{ said: "Saut du dragon" }]);
    expect((await listExerciseTermAliases(other.owner.userId, other.organizationId)).aliases).toEqual([]);
    expect(await matchPlannerTerms(other.owner.userId, other.organizationId, ["Saut du dragon"], {
        provider: fakePlannerProvider(),
      })).toMatchObject([
      { confidence: "absent", exercise: null },
    ]);
    expect(await matchPlannerTerms(a.owner.userId, a.organizationId, ["saut du dragon"], { provider: fakePlannerProvider() })).toMatchObject([
      { confidence: "exact", exercise: { exerciseId: a.rope.id } },
    ]);
  });

  it("crée la fiche depuis l'emplacement avec les valeurs proposées, que le coach peut changer, sans case à cocher", async () => {
    const a = await setup("Creation");
    const created = await a.create("Saut du dragon, 3 séries de 5.", NEW);
    expect(created.slots![0]!.suggestion).toEqual({
      name: "Saut du dragon",
      category: "strength",
      movement: "other",
      loadKind: "bodyweight",
    });
    // Rien de rempli : le nom, la catégorie et le type de charge proposés font la fiche.
    const filled = await resolve(a, created, { kind: "create", exercise: {} });
    expect(filled.slots).toEqual([]);
    const fiche = await prisma.exercise.findFirstOrThrow({
      where: { organizationId: a.organizationId, name: "Saut du dragon" },
    });
    expect(fiche).toMatchObject({ category: "strength", strengthLoadKind: "bodyweight", createdBy: a.owner.userId });
    expect(nameOf(filled, tokensOf(filled)[0]!)).toBe("Saut du dragon");
    // Le coach change le nom et la catégorie : le terme dit reste un autre nom de sa fiche.
    const second = await a.create("Saut du dragon bis, 3 séries de 5.", NEW);
    await resolve(
      a,
      second,
      { kind: "create", exercise: { name: "Bond du dragon", category: "plyo" } },
      "slot_1",
      "Saut du dragon bis",
    );
    expect(
      await prisma.exercise.findFirstOrThrow({ where: { organizationId: a.organizationId, name: "Bond du dragon" } }),
    ).toMatchObject({ category: "plyo", aliases: ["Saut du dragon bis"] });
  });

  it("se retire sans toucher au reste ; le seul exercice d'une séance ne se retire pas", async () => {
    const a = await setup("Retrait");
    const created = await a.create(`${a.sled.name}, 3 séries de 8, puis Saut du dragon, 3 séries de 5.`, NEW);
    const removed = await resolve(a, created, { kind: "remove" });
    expect(removed).toMatchObject({ state: "proposal", slots: [] });
    expect(tokensOf(removed).map((token) => nameOf(removed, token))).toEqual([a.sled.name]);
    const drafts = await preparePlannerDrafts(a.owner.userId, a.organizationId, created.id, removed.version, now);
    await expect(
      confirmPlannerProposal(
        a.owner.userId,
        a.organizationId,
        created.id,
        confirmPlannerProposalInput.parse({ expectedVersion: removed.version, confirmed: true, sessions: drafts.sessions }),
        now,
      ),
    ).resolves.toMatchObject({ sessions: [{}] });
    // Aucun alias n'est appris d'un retrait.
    expect((await listExerciseTermAliases(a.owner.userId, a.organizationId)).aliases).toEqual([]);
    const alone = await a.create("Saut du dragon, 3 séries de 5.", NEW);
    await expect(resolve(a, alone, { kind: "remove" })).rejects.toMatchObject({
      status: 400,
      message: m.aiPlanner.slotLastExercise,
    });
  });

  it("un client d'avant reçoit l'ancienne forme : une question nommée, un choix, une réponse, puis la séance", async () => {
    const a = await setup("ClientAncien");
    const text = `${a.sled.name}, 3 séries de 8, puis Saut du dragon, 3 séries de 5.`;
    const pending = await a.create(text);
    expect(pending.state).toBe("clarification");
    expect(pending.slots).toBeUndefined();
    expect(pending.interpretation).toMatchObject({
      sessions: [],
      questions: [
        { id: "slot_1", field: "exercise", exerciseName: "Saut du dragon", question: m.aiPlanner.unknownExercise("Saut du dragon") },
      ],
    });
    // Retirer n'existe pas dans l'ancienne forme.
    await expect(resolve(a, pending, { kind: "remove" })).rejects.toMatchObject({ status: 409 });
    const linked = await resolve(a, pending, { kind: "existing", exerciseId: a.rope.id });
    expect(linked).toMatchObject({
      state: "clarification",
      exerciseResolutions: [{ questionId: "slot_1", exerciseId: a.rope.id }],
    });
    const resumed = await clarifyPlannerProposal(
      a.owner.userId,
      a.organizationId,
      pending.id,
      { operationId: randomUUID(), expectedVersion: linked.version, text: "C'est bien cette fiche.", reviewed: true },
      { provider: fakePlannerProvider(), clock },
    );
    expect(resumed.state).toBe("proposal");
    expect(tokensOf(resumed).map((token) => nameOf(resumed, token))).toEqual([a.sled.name, a.rope.name]);
    // Les nouveaux points « À vérifier » ne partent pas vers un client qui ne les connaît pas.
    const drafts = await preparePlannerDrafts(a.owner.userId, a.organizationId, pending.id, resumed.version, now);
    expect(drafts.slots).toBeUndefined();
  });
});

describe("fiche probable", () => {
  it("est posée et signalée ; la fiche que le coach met à sa place devient un alias appris", async () => {
    const a = await setup("Probable");
    const named = async (name: string) => ({
      name,
      id: (await saveExercise(a.owner.userId, a.organizationId, { name, category: "strength" })).id,
    });
    const front = await named("Zigzag fictif avant");
    const back = await named("Zigzag fictif arrière");
    const created = await a.create("Zigzag fictif, 3 séries de 8.", NEW);
    expect(created).toMatchObject({ state: "proposal", slots: [] });
    const drafts = await preparePlannerDrafts(a.owner.userId, a.organizationId, created.id, created.version, now);
    const item = drafts.sessions[0]!.draft.blocks[0]!.items[0]!;
    // Deux fiches conviennent autant : l'une est posée, l'autre proposée, le tout « À vérifier ».
    const [posed, offered] = item.exerciseId === back.id ? [back, front] : [front, back];
    expect(item.exerciseId).toBe(posed.id);
    expect(drafts.warnings![0]).toEqual([
      {
        code: "approximate_exercise",
        field: "exercise",
        itemRef: item.ref,
        detail: posed.name,
        alternatives: [{ exerciseId: offered.id, name: offered.name }],
        // Le terme dit accompagne la fiche rapprochée, pour que l'écran le montre et le retienne.
        said: "Zigzag fictif",
      },
    ]);
    const replaced = drafts.sessions.map((session) => ({
      ...session,
      draft: {
        ...session.draft,
        blocks: session.draft.blocks.map((block) => ({
          ...block,
          items: block.items.map((entry) => ({ ...entry, exerciseId: offered.id })),
        })),
      },
    }));
    await confirmPlannerProposal(
      a.owner.userId,
      a.organizationId,
      created.id,
      confirmPlannerProposalInput.parse({ expectedVersion: created.version, confirmed: true, sessions: replaced }),
      now,
    );
    expect((await listExerciseTermAliases(a.owner.userId, a.organizationId)).aliases).toMatchObject([
      { said: "Zigzag fictif", exerciseId: offered.id },
    ]);
    // La fois suivante, le terme désigne la fiche choisie, sans doute.
    const again = await a.create("Zigzag fictif, 3 séries de 8.", NEW);
    expect(again.understanding!.movements).toMatchObject([{ confidence: "exact", exercise: { exerciseId: offered.id } }]);
  });
});

describe("demande sans destinataire", () => {
  it("devient une question, puis lit le groupe que la demande cite", async () => {
    const a = await setup("SansDestinataire");
    const asked = await a.create(`${a.sled.name}, 3 séries de 8.`, NEW, fakePlannerProvider(), []);
    expect(asked).toMatchObject({ state: "clarification", selection: { groupIds: [], athleteIds: [] } });
    expect(asked.interpretation!.questions).toMatchObject([
      { field: "target", question: m.aiPlanner.askRecipient, options: ["group_1"] },
    ]);
    // Aucun nom de groupe ni d'athlète n'a quitté le serveur : la demande part en jetons.
    const named = await a.create(`Pour Hauteur Élite : ${a.sled.name}, 3 séries de 8.`, NEW, fakePlannerProvider(), []);
    expect(named.state).toBe("proposal");
    expect(named.interpretation!.sessions).toMatchObject([{ date: "2030-06-03", targetTokens: ["group_1"] }]);
    const drafts = await preparePlannerDrafts(a.owner.userId, a.organizationId, named.id, named.version, now);
    expect(drafts.sessions[0]!.assignments).toEqual([{ targetType: "group", targetId: a.groupId }]);
  });
});

describe("panne d'une étape", () => {
  it("est lisible, dit son étape, et n'est pas décomptée du quota", async () => {
    const a = await setup("Panne");
    const input = a.input("Saut du dragon, 3 séries de 5, #panne-match-timeout", NEW);
    const error = await createPlannerProposal(a.owner.userId, a.organizationId, input, {
      provider: fakePlannerProvider(),
      clock,
    }).catch((cause: unknown) => cause);
    expect(error).toMatchObject({
      status: 504,
      code: "planner_timeout",
      message: m.aiPlanner.failures.timeout,
      step: "match",
    });
    expect(
      await prisma.aiPlannerOperation.findUniqueOrThrow({
        where: { organizationId_id: { organizationId: a.organizationId, id: input.id } },
      }),
    ).toMatchObject({ state: "refunded", failureCode: "timeout", failureStep: "match" });
    expect(
      await prisma.aiPlannerQuota.findUniqueOrThrow({
        where: { organizationId_month: { organizationId: a.organizationId, month: "2030-06" } },
      }),
    ).toMatchObject({ usedProposals: 0, reservedProposals: 0 });
    expect(await getPlannerProposal(a.owner.userId, a.organizationId, input.id, now)).toMatchObject({
      state: "failed",
      failure: { code: "timeout", message: m.aiPlanner.failures.timeout, step: "match" },
    });
  });
});

describe("jour cité dans la demande", () => {
  it("l'emporte sur le jour choisi à l'écran par un client d'avant, dans une période que ce client sait lire", async () => {
    const a = await setup("JourCite");
    // « Demain » : dimanche 2 juin 2030, alors que l'écran dit lundi 3.
    const created = await a.create(`Demain, ${a.sled.name}, 3 séries de 8.`);
    expect(created.state).toBe("proposal");
    expect(created.interpretation!.sessions).toMatchObject([{ date: "2030-06-02" }]);
    expect(created.selection.period).toEqual({ from: "2030-06-02", to: "2030-06-02" });
  });
});

describe("bibliothèque de 700 fiches", () => {
  it("entre entière dans la demande : la 650e se retrouve par son nom", async () => {
    const a = await setup("Grande");
    await prisma.exercise.createMany({
      data: Array.from({ length: 700 }, (_, i) => ({
        organizationId: a.organizationId,
        name: `Mouvement privé ${i + 1}`,
        category: "strength" as const,
      })),
    });
    const created = await a.create("Mouvement privé 650, 3 séries de 8.", NEW);
    expect(created.state).toBe("proposal");
    expect(created.exercises.filter((exercise) => exercise.name.startsWith("Mouvement privé "))).toHaveLength(700);
    expect(nameOf(created, tokensOf(created)[0]!)).toBe("Mouvement privé 650");
  });
});

describe("vocabulaire de la dictée", () => {
  it("contient les termes appris de l'espace et les fiches communes, jamais les termes d'un autre espace", async () => {
    const a = await setup("Dictee");
    const other = await setup("DicteeAutre");
    const common = await prisma.exercise.create({
      data: { name: `Fiche commune ${randomUUID().slice(0, 8)}`, category: "strength" },
    });
    try {
      const mine = await a.create("Saut du dragon, 3 séries de 5.", NEW);
      await resolve(a, mine, { kind: "existing", exerciseId: a.rope.id });
      const theirs = await other.create("Bond du tigre, 3 séries de 5.", NEW);
      await resolve(other, theirs, { kind: "existing", exerciseId: other.rope.id }, "slot_1", "Bond du tigre");
      const words = await plannerVocabulary(a.organizationId);
      // Ce que le coach dit vraiment passe d'abord : c'est ce qu'un modèle de transcription connaît le moins.
      expect(words[0]).toBe("Saut du dragon");
      expect(words).toEqual(expect.arrayContaining([a.sled.name, a.rope.name]));
      // Les fiches communes y entrent aussi, à côté des fiches de l'espace.
      const shared = await prisma.exercise.findMany({ where: { organizationId: null }, select: { name: true } });
      const own = await prisma.exercise.findMany({ where: { organizationId: a.organizationId }, select: { name: true } });
      const onlyCommon = shared.map((row) => row.name).filter((name) => !own.some((row) => row.name === name));
      expect(words.some((word) => onlyCommon.includes(word))).toBe(true);
      expect(words).not.toContain("Bond du tigre");
      expect(words).not.toContain(other.sled.name);
      expect(words.length).toBeLessThanOrEqual(48);
    } finally {
      await prisma.exercise.delete({ where: { id: common.id } });
    }
  });
});
