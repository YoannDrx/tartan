import { expect, it } from "vitest";
import { clockTime, isoDate, sessionDraft } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { getSessionBuilderContext } from "@/server/session-builder.service";
import { saveTemplate, listTemplates } from "@/server/session.service";
import { addAthlete, makeOrg } from "./helpers";

it("le modèle natif conserve variantes, prescription et cible d’intensité sans données d’athlète", async () => {
  const a = await makeOrg("ModeleNatif");
  const context = await getSessionBuilderContext(a.owner.userId, a.organizationId);
  const exercise = context.exercises[0]!;
  const draft = sessionDraft.parse({
    title: "Force et vitesse",
    type: "strength",
    durationMin: 45,
    coachNote: "Contrôle",
    blocks: [
      {
        name: "Force",
        variant: "both",
        items: [
          {
            exerciseId: exercise.id,
            prescription: {
              sets: 3,
              reps: 4,
              load: { type: "kg", value: 42.5 },
              intensityTarget: { type: "rir", value: 2 },
            },
          },
        ],
      },
    ],
  });
  const saved = await saveTemplate(a.owner.userId, a.organizationId, draft);
  const templates = await listTemplates(a.owner.userId, a.organizationId);
  expect(templates.find((t) => t.id === saved.id)?.blocks[0]?.items[0]?.prescription).toEqual(
    draft.blocks[0]!.items[0]!.prescription,
  );
  const athlete = await addAthlete(a.organizationId, a.groupId, "ModeleAthlete");
  await expect(saveTemplate(athlete.userId, a.organizationId, draft)).rejects.toMatchObject({ status: 403 });
  const other = await makeOrg("ModeleAutre");
  await expect(saveTemplate(a.owner.userId, other.organizationId, draft)).rejects.toMatchObject({ status: 403 });
  const foreign = await prisma.exercise.create({
    data: {
      organizationId: other.organizationId,
      name: "Exercice privé",
      category: "strength",
      tags: [],
      cues: [],
      defaultPrescription: {},
    },
  });
  draft.blocks[0]!.items[0]!.exerciseId = foreign.id;
  await expect(saveTemplate(a.owner.userId, a.organizationId, draft)).rejects.toMatchObject({ status: 404 });
});

it.each(["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01"])("refuse une date impossible %s", (value) =>
  expect(isoDate.safeParse(value).success).toBe(false),
);
it("accepte le jour bissextile et refuse les heures normalisées hors journée", () => {
  expect(isoDate.safeParse("2028-02-29").success).toBe(true);
  expect(clockTime.safeParse("23:59").success).toBe(true);
  expect(clockTime.safeParse("24:00").success).toBe(false);
  expect(clockTime.safeParse("18:60").success).toBe(false);
});
