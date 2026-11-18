import { randomUUID } from "node:crypto";
import { EXERCISE_CATALOG } from "@tartan/domain/exercise-catalog";
import { exerciseClip } from "@tartan/mascot/exercises";
import { motionEngine, reviewBatch } from "@tartan/mascot/v2/engine";
import { gestureEntry } from "@tartan/mascot/v2/registry";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { readExerciseGuide } from "@/server/exercise-catalog.service";
import { approvedMotionFamilies, setMotionFamilyApproval, withMotion } from "@/server/motion-review.service";

const guideOf = (key: string) => EXERCISE_CATALOG.find((entry) => entry.catalogKey === key)!.guide;

describe("gestes animés des guides", () => {
  it("chaque geste correspond à une fiche du catalogue et à ses lignes de guide", () => {
    const clips = EXERCISE_CATALOG.filter((entry) => exerciseClip(entry.catalogKey));
    expect(clips.length).toBeGreaterThanOrEqual(130);
    for (const entry of clips)
      expect(exerciseClip(entry.catalogKey)!.positions).toHaveLength(entry.guide.illustration.positions.length);
  });

  it("un geste du nouveau moteur illustre lui aussi chaque ligne du guide, dans l'ordre", () => {
    // Plus aucun geste à reprendre : tout le catalogue animé tourne sur le nouveau moteur.
    const next = EXERCISE_CATALOG.filter((entry) => motionEngine(entry.catalogKey) === "v2");
    expect(next).toHaveLength(173);
    for (const entry of next) {
      const { clip } = gestureEntry(entry.catalogKey)!;
      expect(
        clip.positions.map((position) => position.guide),
        entry.catalogKey,
      ).toEqual(entry.guide.illustration.positions.map((_, index) => index));
    }
  });

  it("annonce le geste à la lecture, relu ou non, sans toucher un guide sans geste", () => {
    // Good morning : repris, il est passé au nouveau moteur et à sa série de relecture.
    const old = guideOf("good-morning");
    expect(motionEngine("good-morning")).toBe("v2");
    expect(withMotion(old, []).illustration.motion).toBe("review");
    expect(withMotion(old, ["strength"]).illustration.motion).toBe("review");
    expect(withMotion(old, ["strength:v2"]).illustration.motion).toBe("approved");
    expect(withMotion(null, ["strength"])).toBeNull();
  });

  it("un geste du nouveau moteur est une nouvelle série : la validation d'avant ne le couvre pas", () => {
    const squat = guideOf("back-squat");
    expect(motionEngine("back-squat")).toBe("v2");
    expect(withMotion(squat, ["strength", "strength:face"]).illustration.motion).toBe("review");
    expect(withMotion(squat, ["strength:v2"]).illustration.motion).toBe("approved");
    // Un geste relevé, hier dans la série « face », suit la même règle.
    const lateral = guideOf("lateral-raise");
    expect(reviewBatch("lateral-raise")).toBe("v2");
    expect(withMotion(lateral, ["strength", "strength:face"]).illustration.motion).toBe("review");
    expect(withMotion(lateral, ["strength:v2"]).illustration.motion).toBe("approved");
    expect(withMotion(guideOf("good-morning"), ["strength:face"]).illustration.motion).toBe("review");
  });

  it("chaque fiche du catalogue a son geste", () => {
    expect(
      EXERCISE_CATALOG.filter((entry) => !exerciseClip(entry.catalogKey)).map((entry) => entry.catalogKey),
    ).toEqual([]);
  });

  it("un geste vu de face par l'ancien moteur, repris dans le nouveau, quitte sa série « face »", () => {
    // Gainage latéral : dessiné de face par l'ancien moteur, écrit depuis en trois dimensions.
    const plank = guideOf("side-plank");
    expect(exerciseClip("side-plank")!.batch).toBe("face");
    expect(reviewBatch("side-plank")).toBe("v2");
    expect(withMotion(plank, ["core", "core:face"]).illustration.motion).toBe("review");
    expect(withMotion(plank, ["core:v2"]).illustration.motion).toBe("approved");
  });

  it("n'enregistre jamais l'annonce : la lecture d'un guide stocké la retire", () => {
    const annotated = withMotion(guideOf("deadlift"), ["strength"]);
    expect(readExerciseGuide(annotated)!.illustration).not.toHaveProperty("motion");
  });

  it("seul un administrateur valide une famille, et la validation est tracée", async () => {
    const intruder = { email: "intrus@test.local", userId: randomUUID() };
    await expect(setMotionFamilyApproval(intruder, "strength", true)).rejects.toMatchObject({ status: 403 });
    const admin = { email: process.env.ADMIN_EMAILS?.split(",")[0] || "racine@test.local", userId: randomUUID() };
    await prisma.platformAdmin.upsert({ where: { email: admin.email }, create: { email: admin.email }, update: {} });
    try {
      await setMotionFamilyApproval(admin, "strength", true);
      await setMotionFamilyApproval(admin, "plyometrics", true);
      await setMotionFamilyApproval(admin, "strength", false);
      await setMotionFamilyApproval(admin, "core", true, "face");
      await setMotionFamilyApproval(admin, "weightlifting", true, "v2");
      expect(await approvedMotionFamilies()).toEqual(["plyometrics", "core:face", "weightlifting:v2"]);
      expect(await prisma.auditLog.count({ where: { action: "motion_family_approved", actorId: admin.userId } })).toBe(
        4,
      );
    } finally {
      await prisma.platformSetting.deleteMany({ where: { key: "motionFamilies" } });
      await prisma.platformAdmin.deleteMany({ where: { email: admin.email } });
    }
  });
});
