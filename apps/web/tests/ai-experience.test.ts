import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmPlannerProposalInput,
  PLANNER_SLOT_EXERCISE_ID,
  type CreatePlannerProposalInput,
  type PlannerCapability,
  type PlannerDraftsResponse,
  type PlannerReviewedDraft,
} from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { listExerciseTermAliases } from "@/server/ai/alias.service";
import { fakePlannerProvider } from "@/server/ai/fake-provider";
import {
  clarifyPlannerProposal,
  confirmPlannerProposal,
  createPlannerProposal,
  getPlannerProposal,
  preparePlannerDrafts,
  previewPlannerLoads,
  resolvePlannerExercise,
} from "@/server/ai/proposal.service";
import { saveExercise } from "@/server/exercise.service";
import { makeOrg } from "./helpers";

// L'expérience du coach sur le web (lot P3), côté service : la séance à l'écran est la base de la suite, toute
// fiche visible de l'espace se pose à la relecture, une fiche « À vérifier » se tranche d'un geste. Le prestataire
// est le prestataire simulé : les règles du serveur s'appliquent à lui.

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

const NEW: PlannerCapability[] = ["slots", "checks"];
async function setup(name: string) {
  const a = await makeOrg(name);
  await prisma.organization.update({ where: { id: a.organizationId }, data: { aiPlannerEnabled: true } });
  const exercise = async (label: string, organizationId = a.organizationId, userId = a.owner.userId) => ({
    name: label,
    id: (
      await saveExercise(userId, organizationId, {
        name: label,
        category: "strength",
        classification: { movement: null, equipment: [] },
      })
    ).id,
  });
  const sled = await exercise(`Poussée traîneau ${name}`);
  const input = (text: string, extra: Partial<CreatePlannerProposalInput> = {}): CreatePlannerProposalInput => ({
    id: randomUUID(),
    requestedAt: now.toISOString(),
    reviewed: true,
    text,
    accepts: NEW,
    selection: {
      period: { from: "2030-06-03", to: "2030-06-03" },
      groupIds: [a.groupId],
      athleteIds: [],
      exerciseIds: [],
      phaseChoices: [],
    },
    ...extra,
  });
  const create = (text: string, provider = fakePlannerProvider(), extra: Partial<CreatePlannerProposalInput> = {}) =>
    createPlannerProposal(a.owner.userId, a.organizationId, input(text, extra), { provider, clock });
  const prepare = async (proposal: { id: string; version: number }) => {
    const drafts = await preparePlannerDrafts(a.owner.userId, a.organizationId, proposal.id, proposal.version, now);
    return { ...drafts, sessions: asSequence(drafts.sessions) };
  };
  const confirm = (proposal: { id: string; version: number }, sessions: PlannerReviewedDraft[]) =>
    confirmPlannerProposal(
      a.owner.userId,
      a.organizationId,
      proposal.id,
      confirmPlannerProposalInput.parse({ expectedVersion: proposal.version, confirmed: true, sessions }),
      now,
    );
  const resolve = (
    proposal: { id: string; version: number },
    questionId: string,
    requestedName: string,
    choice: Parameters<typeof resolvePlannerExercise>[3]["choice"],
    sessions?: PlannerReviewedDraft[],
  ) =>
    resolvePlannerExercise(
      a.owner.userId,
      a.organizationId,
      proposal.id,
      {
        operationId: randomUUID(),
        expectedVersion: proposal.version,
        questionId,
        requestedName,
        choice,
        ...(sessions ? { sessions } : {}),
      },
      now,
    );
  const adjust = (
    proposal: { id: string; version: number },
    text: string,
    sessions?: PlannerReviewedDraft[],
    provider = fakePlannerProvider(),
  ) =>
    clarifyPlannerProposal(
      a.owner.userId,
      a.organizationId,
      proposal.id,
      {
        operationId: randomUUID(),
        expectedVersion: proposal.version,
        text,
        reviewed: true,
        ...(sessions ? { sessions } : {}),
      },
      { provider, clock },
    );
  return { ...a, sled, exercise, create, prepare, confirm, resolve, adjust };
}
type Drafts = PlannerDraftsResponse["sessions"];
// Le web relit toujours la séance dans l'éditeur de séquence : chaque bloc reçoit sa séquence.
const asSequence = (sessions: Drafts): Drafts =>
  sessions.map((session) => ({
    ...session,
    draft: {
      ...session.draft,
      structureVersion: 2 as const,
      blocks: session.draft.blocks.map((block) => ({
        ...block,
        sequence: block.sequence ?? block.items.map((item) => ({ kind: "exercise" as const, itemRef: item.ref! })),
      })),
    },
  }));
// Ce que le coach fait dans l'éditeur : il change un exercice de la première séance.
const edited = (
  sessions: Drafts,
  change: (item: Drafts[number]["draft"]["blocks"][number]["items"][number]) => object,
  at = 0,
): PlannerReviewedDraft[] =>
  sessions.map((session, s) =>
    s !== 0
      ? session
      : {
          ...session,
          draft: {
            ...session.draft,
            blocks: session.draft.blocks.map((block, b) =>
              b !== 0
                ? block
                : { ...block, items: block.items.map((item, i) => (i === at ? { ...item, ...change(item) } : item)) },
            ),
          },
        },
  ) as PlannerReviewedDraft[];
const itemsOf = (drafts: { sessions: Drafts }) => drafts.sessions[0]!.draft.blocks.flatMap((block) => block.items);

describe("remplacer et ajouter dans toute la bibliothèque", () => {
  it("l'aperçu et le brouillon acceptent une fiche visible que la demande n'avait pas figée, jamais celle d'un autre espace", async () => {
    const a = await setup("Bibliotheque");
    const created = await a.create(`${a.sled.name}, 3 séries de 8.`);
    const drafts = await a.prepare(created);
    // Une fiche créée après la demande : elle n'est pas dans la bibliothèque figée de la proposition.
    const later = await a.exercise("Tirage élastique créé après");
    expect(created.exercises.some((exercise) => exercise.id === later.id)).toBe(false);
    const replaced = edited(drafts.sessions, () => ({ exerciseId: later.id }));
    const preview = await previewPlannerLoads(
      a.owner.userId,
      a.organizationId,
      created.id,
      { expectedVersion: created.version, session: replaced[0]! },
      now,
    );
    expect(preview.athleteCount).toBe(0);
    // La fiche d'un autre espace, une fiche supprimée et l'identifiant réservé d'un emplacement restent refusés.
    const other = await setup("AutreBibliotheque");
    const gone = await a.exercise("Fiche supprimée ensuite");
    await prisma.exercise.update({ where: { id: gone.id }, data: { deletedAt: now } });
    for (const exerciseId of [other.sled.id, gone.id, PLANNER_SLOT_EXERCISE_ID, randomUUID()])
      await expect(
        a.confirm(created, edited(drafts.sessions, () => ({ exerciseId }))),
      ).rejects.toMatchObject({ status: 409, code: "planner_proposal_conflict" });
    expect(await prisma.scheduledSession.count({ where: { organizationId: a.organizationId } })).toBe(0);
    const confirmed = await a.confirm(created, replaced);
    const session = await prisma.scheduledSession.findUniqueOrThrow({ where: { id: confirmed.sessions[0]!.id } });
    expect(JSON.stringify(session.draft)).toContain(later.id);
    expect(session.publishedAt).toBeNull();
  });
});

describe("ajuster garde les retouches faites à la main", () => {
  it("la séance à l'écran est la base de l'ajustement : prescription retouchée, exercice ajouté, fiche hors de la demande", async () => {
    const a = await setup("Ajustement");
    const provider = fakePlannerProvider();
    const compose = vi.spyOn(provider, "compose");
    const created = await a.create(`${a.sled.name}, 3 séries de 8.`, provider);
    const drafts = await a.prepare(created);
    expect(itemsOf(drafts)).toMatchObject([{ exerciseId: a.sled.id, prescription: { sets: 3, reps: 8 } }]);
    // Le coach passe à douze répétitions et à 40 kg, puis ajoute à la main une fiche créée depuis.
    const later = await a.exercise("Gainage ajouté à la main");
    const added = { ref: randomUUID(), exerciseId: later.id, prescription: { sets: 2, duration_s: 45 } };
    const [session] = edited(drafts.sessions, (item) => ({
      prescription: { ...item.prescription, reps: 12, load: { type: "kg", value: 40 } },
    }));
    const block = session!.draft.blocks[0]!;
    const screen: PlannerReviewedDraft[] = [
      {
        ...session!,
        draft: {
          ...session!.draft,
          blocks: [
            {
              ...block,
              items: [...block.items, added],
              sequence: [...(block.sequence ?? []), { kind: "exercise", itemRef: added.ref }],
            },
          ],
        },
      },
    ];
    const adjusted = await a.adjust(created, "Passe à quatre séries.", screen, provider);
    expect(adjusted).toMatchObject({ state: "proposal", adjustmentCount: 1, clarificationCount: 0 });
    // Le modèle a reçu la séance de l'écran, pas celle qu'il avait écrite.
    const sent = compose.mock.calls.at(-1)![0];
    expect(sent.adjustment).toBe("Passe à quatre séries.");
    expect(sent.previous!.sessions[0]!.blocks[0]!.content).toMatchObject([
      { kind: "exercise", prescription: { sets: 3, reps: 12, load: { type: "kg", value: 40 } } },
      { kind: "exercise", prescription: { sets: 2, durationS: 45 } },
    ]);
    // L'ajustement s'applique, et rien de ce que le coach avait fait à la main n'est perdu ni jugé inventé.
    const after = await a.prepare(adjusted);
    expect(itemsOf(after)).toMatchObject([
      { exerciseId: a.sled.id, prescription: { sets: 4, reps: 12, load: { type: "kg", value: 40 } } },
      { exerciseId: later.id, prescription: { sets: 4, duration_s: 45 } },
    ]);
    expect(after.warnings?.[0] ?? []).toEqual([]);
    await expect(a.confirm(adjusted, after.sessions)).resolves.toMatchObject({ sessions: [{}] });
  });

  it("sans l'écran, l'ajustement repart de la séance gardée, comme pour un client d'avant", async () => {
    const a = await setup("AjustementAncien");
    const created = await a.create(`${a.sled.name}, 3 séries de 8.`);
    const adjusted = await a.adjust(created, "Passe à quatre séries.");
    expect(itemsOf(await a.prepare(adjusted))).toMatchObject([
      { exerciseId: a.sled.id, prescription: { sets: 4, reps: 8 } },
    ]);
  });

  it("un écran qui sort de la proposition est refusé sans rien consommer", async () => {
    const a = await setup("AjustementRefuse");
    const other = await setup("AjustementAilleurs");
    const provider = fakePlannerProvider();
    const understand = vi.spyOn(provider, "understand");
    const created = await a.create(`${a.sled.name}, 3 séries de 8.`, provider);
    const drafts = await a.prepare(created);
    const calls = understand.mock.calls.length;
    await expect(
      a.adjust(created, "Passe à quatre séries.", edited(drafts.sessions, () => ({ exerciseId: other.sled.id })), provider),
    ).rejects.toMatchObject({ status: 409 });
    expect(understand.mock.calls.length).toBe(calls);
    const kept = await getPlannerProposal(a.owner.userId, a.organizationId, created.id, now);
    expect(kept).toMatchObject({ state: "proposal", version: created.version, adjustmentCount: 0 });
  });
});

describe("une fiche à vérifier se tranche d'un geste", () => {
  async function probable(name: string, said: string) {
    const a = await setup(name);
    // Deux fiches portent les mots du terme dit : aucune règle ne tranche, le rapprochement est « probable ».
    const first = await a.exercise(`Bascule dragon ${name}`);
    const second = await a.exercise(`Bascule dragon lestée ${name}`);
    const created = await a.create(`${said}, 3 séries de 8.`);
    const drafts = await a.prepare(created);
    const [warning] = drafts.warnings![0]!;
    return { a, first, second, created, drafts, warning: warning! };
  }

  it("changée pour une autre fiche possible : la séance suit, le doute part, le terme est retenu", async () => {
    const { a, first, second, created, drafts, warning } = await probable("Changer", "bascule dragon");
    expect(created.understanding!.movements).toMatchObject([{ confidence: "probable" }]);
    // Le point « À vérifier » nomme le terme dit et propose l'autre fiche.
    expect(warning).toMatchObject({ code: "approximate_exercise", said: "bascule dragon" });
    expect(warning.itemRef).toBe(itemsOf(drafts)[0]!.ref);
    const posed = itemsOf(drafts)[0]!.exerciseId;
    const [alternative] = warning.alternatives!;
    expect(new Set([posed, alternative!.exerciseId])).toEqual(new Set([first.id, second.id]));
    const settled = await a.resolve(created, warning.itemRef!, warning.said!, {
      kind: "existing",
      exerciseId: alternative!.exerciseId,
    });
    expect(settled).toMatchObject({ state: "proposal", version: created.version + 1, clarificationCount: 0 });
    const after = await a.prepare(settled);
    expect(itemsOf(after)).toMatchObject([
      { exerciseId: alternative!.exerciseId, prescription: { sets: 3, reps: 8 } },
    ]);
    expect(after.warnings![0]).toEqual([]);
    expect((await listExerciseTermAliases(a.owner.userId, a.organizationId)).aliases).toMatchObject([
      { said: "bascule dragon", exerciseId: alternative!.exerciseId },
    ]);
    // À la demande suivante, le terme est reconnu sans doute ni appel au modèle pour le retrouver.
    const provider = fakePlannerProvider();
    const match = vi.spyOn(provider, "match");
    const again = await a.create("Bascule dragon, 3 séries de 8.", provider);
    expect(match).not.toHaveBeenCalled();
    expect(again.understanding!.movements).toMatchObject([
      { confidence: "exact", exercise: { exerciseId: alternative!.exerciseId } },
    ]);
    expect((await a.prepare(again)).warnings![0]).toEqual([]);
  });

  it("validée telle quelle, ou changée pour une fiche cherchée dans toute la bibliothèque", async () => {
    const { a, created, drafts, warning } = await probable("Valider", "dragon bascule");
    const posed = itemsOf(drafts)[0]!.exerciseId;
    const validated = await a.resolve(created, warning.itemRef!, warning.said!, { kind: "existing", exerciseId: posed });
    expect((await a.prepare(validated)).warnings![0]).toEqual([]);
    expect((await listExerciseTermAliases(a.owner.userId, a.organizationId)).aliases).toMatchObject([
      { said: "dragon bascule", exerciseId: posed },
    ]);
    // Une fois tranchée, la fiche n'est plus à vérifier : un second choix sur elle est refusé.
    await expect(
      a.resolve(validated, warning.itemRef!, warning.said!, { kind: "existing", exerciseId: posed }),
    ).rejects.toMatchObject({ status: 409 });

    const second = await probable("Chercher", "bascule dragon");
    // Une fiche créée après la demande, trouvée par la recherche : hors de la bibliothèque figée.
    const later = await second.a.exercise("Tirage poulie créé après");
    const changed = await second.a.resolve(second.created, second.warning.itemRef!, second.warning.said!, {
      kind: "existing",
      exerciseId: later.id,
    });
    expect(itemsOf(await second.a.prepare(changed))).toMatchObject([{ exerciseId: later.id }]);
    expect(changed.exercises.some((exercise) => exercise.id === later.id)).toBe(true);
  });

  it("ni retrait ni création sur une fiche à vérifier ; une fiche sûre n'est pas une cible", async () => {
    const { a, created, warning } = await probable("Refus", "bascule dragon");
    await expect(a.resolve(created, warning.itemRef!, warning.said!, { kind: "remove" })).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      a.resolve(created, warning.itemRef!, warning.said!, { kind: "create", exercise: {} }),
    ).rejects.toMatchObject({ status: 409 });
    const sure = await a.create(`${a.sled.name}, 3 séries de 8.`);
    const drafts = await a.prepare(sure);
    await expect(
      a.resolve(sure, itemsOf(drafts)[0]!.ref!, a.sled.name, { kind: "existing", exerciseId: a.sled.id }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("un emplacement tranché sans perdre les retouches", () => {
  it("retiré avec la séance à l'écran : le reste garde ce que le coach a changé", async () => {
    const a = await setup("RetraitEcran");
    const created = await a.create(`${a.sled.name}, 3 séries de 8, puis Saut du dragon, 3 séries de 5.`);
    const drafts = await a.prepare(created);
    expect(drafts.slots).toMatchObject([{ id: "slot_1", said: "Saut du dragon" }]);
    const screen = edited(drafts.sessions, (item) => ({ prescription: { ...item.prescription, reps: 12 } }));
    const removed = await a.resolve(created, "slot_1", "Saut du dragon", { kind: "remove" }, screen);
    expect(removed).toMatchObject({ state: "proposal", slots: [] });
    const after = await a.prepare(removed);
    expect(itemsOf(after)).toMatchObject([{ exerciseId: a.sled.id, prescription: { sets: 3, reps: 12 } }]);
    await expect(a.confirm(removed, after.sessions)).resolves.toMatchObject({ sessions: [{}] });
  });

  it("rempli avec la séance à l'écran : la fiche prend sa place, la retouche reste", async () => {
    const a = await setup("RemplirEcran");
    const created = await a.create(`${a.sled.name}, 3 séries de 8, puis Saut du dragon, 3 séries de 5.`);
    const drafts = await a.prepare(created);
    // Le coach a déjà retouché l'emplacement lui-même : sa prescription, encore sans fiche.
    const screen = edited(drafts.sessions, (item) => ({ prescription: { ...item.prescription, reps: 6 } }), 1);
    expect(itemsOf({ sessions: screen as Drafts })[1]!.exerciseId).toBe(PLANNER_SLOT_EXERCISE_ID);
    const fiche = await a.exercise("Saut du dragon créé après");
    const filled = await a.resolve(created, "slot_1", "Saut du dragon", { kind: "existing", exerciseId: fiche.id }, screen);
    expect(filled.slots).toEqual([]);
    expect(itemsOf(await a.prepare(filled))).toMatchObject([
      { exerciseId: a.sled.id, prescription: { reps: 8 } },
      { exerciseId: fiche.id, prescription: { sets: 3, reps: 6 } },
    ]);
  });
});

describe("précisions facultatives", () => {
  it("durée, niveau et matériel précisés à l'écran sont des indices de la demande, sans mode ni brief", async () => {
    const a = await setup("Precisions");
    const provider = fakePlannerProvider();
    const understand = vi.spyOn(provider, "understand");
    const created = await a.create("Renforcement général du bas du corps.", provider, {
      hints: { durationMin: 30, level: "beginner", equipment: ["bodyweight"] },
    });
    expect(understand.mock.calls[0]![0].hints).toMatchObject({
      intent: null,
      durationMin: 30,
      level: "beginner",
      equipment: ["bodyweight"],
    });
    expect(created).toMatchObject({ state: "proposal" });
    expect(created.selection).not.toHaveProperty("mode");
    expect(created.selection).not.toHaveProperty("brief");
    expect(created.interpretation!.sessions[0]!.durationMin).toBe(30);
    // Sans précision, rien n'est supposé.
    const bare = vi.spyOn(provider, "understand");
    await a.create("Renforcement général du haut du corps.", provider);
    expect(bare.mock.calls.at(-1)![0].hints).toMatchObject({ durationMin: null, level: null, equipment: null });
  });
});
