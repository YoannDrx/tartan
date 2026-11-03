import { describe, expect, it } from "vitest";
import { getAthleteSession } from "@/server/athlete-view.service";
import { deleteExercise, listExercises, saveExercise } from "@/server/exercise.service";
import { publishSession, saveScheduledSession } from "@/server/session.service";
import { addAthlete, makeOrg } from "./helpers";

describe("bibliothèque commune", () => {
  it("est proposée à chaque espace, avec son lecteur et son auteur", async () => {
    const { owner, organizationId } = await makeOrg();
    const shared = (await listExercises(owner.userId, organizationId)).filter((e) => e.shared);
    expect(shared).toHaveLength(24);
    expect(shared.find((e) => e.name === "Routine cheville en 10 minutes")?.media).toMatchObject({
      kind: "instagram",
      instagramCode: "Dbq862ptfM6",
      author: "svengirlando",
    });
  });

  it("n'est pas modifiable ni supprimable depuis un espace", async () => {
    const { owner, organizationId } = await makeOrg();
    const target = (await listExercises(owner.userId, organizationId)).find((e) => e.shared);
    await expect(
      saveExercise(owner.userId, organizationId, { id: target?.id, name: "Détourné", category: "plyo" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(deleteExercise(owner.userId, organizationId, target?.id ?? "")).rejects.toMatchObject({ status: 404 });
  });

  it("garde la vidéo dans le programme de l'athlète", async () => {
    const { owner, organizationId, groupId } = await makeOrg();
    const athlete = await addAthlete(organizationId, groupId, "Léa");
    const target = (await listExercises(owner.userId, organizationId)).find(
      (e) => e.name === "Mobilité pour le front rack",
    );
    const session = await saveScheduledSession(owner.userId, organizationId, {
      date: "2026-12-01",
      startTime: "18:00",
      location: "Stade",
      draft: {
        title: "Mobilité",
        type: "mobility",
        durationMin: 20,
        coachNote: null,
        blocks: [
          {
            name: "Corps de séance",
            variant: "club",
            items: [{ exerciseId: target?.id ?? "", prescription: {} }],
          },
        ],
      },
      assignments: [{ targetType: "group", targetId: groupId }],
      overrides: [],
      publishAt: null,
    });
    await publishSession(owner.userId, organizationId, session.id);
    const seen = await getAthleteSession(athlete.userId, organizationId, session.id);
    expect(seen.blocks[0]?.items[0]?.media).toMatchObject({ kind: "instagram", instagramCode: "De9VyR9g6T0" });
  });

  it("reste séparée des exercices privés d'un autre espace", async () => {
    const first = await makeOrg("Alice");
    const second = await makeOrg("Bruno");
    await saveExercise(first.owner.userId, first.organizationId, {
      name: "Exercice privé d'Alice",
      category: "plyo",
      media: { kind: "instagram", url: "https://www.instagram.com/reel/DeKl2zopMw9/?stkn=abc" },
    });
    const seen = await listExercises(second.owner.userId, second.organizationId);
    expect(seen.some((e) => e.name === "Exercice privé d'Alice")).toBe(false);
  });
});
