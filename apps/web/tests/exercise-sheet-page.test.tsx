import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ExercisePage from "../app/(app)/exercices/[id]/page";
import { prisma } from "@/lib/prisma";
import { addAthlete, makeOrg } from "./helpers";

const space = vi.hoisted(() => ({ actor: { userId: "", email: "" }, organizationId: "" }));

vi.mock("@/features/shell/space", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/shell/space")>()),
  requireStaffSpace: async () => space,
}));

const render = async (id: string) => renderToStaticMarkup(await ExercisePage({ params: Promise.resolve({ id }) }));

describe("page d'une fiche d'exercice", () => {
  it("montre le mouvement et les vidéos liées, sans vidéo d'un autre mouvement", async () => {
    const org = await makeOrg("Page");
    const lea = await addAthlete(org.organizationId, org.groupId, "Lea");
    const tom = await addAthlete(org.organizationId, org.groupId, "Tom");
    const exercise = await prisma.exercise.create({
      data: {
        organizationId: org.organizationId,
        name: "Bonds alternés",
        category: "plyo",
        cues: ["Pied actif sous le corps"],
        tags: [],
        defaultPrescription: {},
      },
    });
    const video = await prisma.video.create({
      data: {
        organizationId: org.organizationId,
        athleteId: lea.athleteId,
        uploadedBy: org.owner.userId,
        exerciseId: exercise.id,
        status: "ready",
        recordedAt: new Date("2026-11-02T10:00:00Z"),
      },
    });
    await prisma.video.create({
      data: {
        organizationId: org.organizationId,
        athleteId: tom.athleteId,
        uploadedBy: org.owner.userId,
        status: "ready",
        recordedAt: new Date("2026-11-02T10:00:00Z"),
      },
    });
    space.actor.userId = org.owner.userId;
    space.organizationId = org.organizationId;

    const html = await render(exercise.id);
    expect(html).toMatch(/<h1[^>]*>.*Bonds.*alternés.*<\/h1>/);
    expect(html).toContain("Pied actif sous le corps");
    expect(html).toContain("Vidéos liées");
    expect(html).toContain(`href="/videos/${video.id}"`);
    expect(html).toContain("Lea Test");
    expect(html).not.toContain("Tom Test");
    expect(html).toContain('href="/exercices"');
  });

  it("indique l'absence de vidéo et traite un identifiant inconnu comme une page introuvable", async () => {
    const org = await makeOrg("Vide");
    const exercise = await prisma.exercise.create({
      data: {
        organizationId: org.organizationId,
        name: "Sans vidéo",
        category: "plyo",
        cues: [],
        tags: [],
        defaultPrescription: {},
      },
    });
    space.actor.userId = org.owner.userId;
    space.organizationId = org.organizationId;
    expect(await render(exercise.id)).toContain("Aucune vidéo liée");
    await expect(render("00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404"),
    });
    await expect(render("pas-un-identifiant")).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404"),
    });
  });
});
