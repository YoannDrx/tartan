import { randomUUID } from "node:crypto";
import { EXERCISE_CATALOG } from "@tartan/domain/exercise-catalog";
import { exerciseClip } from "@tartan/mascot/exercises";
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

  it("le geste de chaque fiche illustre chaque ligne du guide, dans l'ordre", () => {
    for (const entry of EXERCISE_CATALOG) {
      const { clip } = gestureEntry(entry.catalogKey)!;
      expect(
        clip.positions.map((position) => position.guide),
        entry.catalogKey,
      ).toEqual(entry.guide.illustration.positions.map((_, index) => index));
    }
  });

  it("annonce le geste à la lecture, relu ou non, sans toucher un guide sans geste", () => {
    const squat = guideOf("back-squat");
    expect(withMotion(squat, []).illustration.motion).toBe("review");
    expect(withMotion(squat, ["strength:v2"]).illustration.motion).toBe("approved");
    expect(withMotion(null, ["strength:v2"])).toBeNull();
  });

  it("les gestes du moteur actuel sont une série à part : une validation du premier moteur ne les couvre pas", () => {
    const squat = guideOf("back-squat");
    expect(withMotion(squat, ["strength", "strength:face"]).illustration.motion).toBe("review");
    expect(withMotion(squat, ["strength:v2"]).illustration.motion).toBe("approved");
    // Un geste relevé, hier dans la série « face », suit la même règle.
    const lateral = guideOf("lateral-raise");
    expect(withMotion(lateral, ["strength", "strength:face"]).illustration.motion).toBe("review");
    expect(withMotion(lateral, ["strength:v2"]).illustration.motion).toBe("approved");
    // Gainage latéral : dessiné de face par l'ancien moteur, réécrit en trois dimensions le 18 novembre.
    const plank = guideOf("side-plank");
    expect(withMotion(plank, ["core", "core:face"]).illustration.motion).toBe("review");
    expect(withMotion(plank, ["core:v2"]).illustration.motion).toBe("approved");
  });

  it("chaque fiche du catalogue a son geste", () => {
    expect(
      EXERCISE_CATALOG.filter((entry) => !exerciseClip(entry.catalogKey)).map((entry) => entry.catalogKey),
    ).toEqual([]);
  });

  it("n'enregistre jamais l'annonce : la lecture d'un guide stocké la retire", () => {
    const annotated = withMotion(guideOf("deadlift"), ["strength:v2"]);
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
      await setMotionFamilyApproval(admin, "weightlifting", true);
      expect(await approvedMotionFamilies()).toEqual(["plyometrics:v2", "weightlifting:v2"]);
      expect(await prisma.auditLog.count({ where: { action: "motion_family_approved", actorId: admin.userId } })).toBe(
        3,
      );
    } finally {
      await prisma.platformSetting.deleteMany({ where: { key: "motionFamilies" } });
      await prisma.platformAdmin.deleteMany({ where: { email: admin.email } });
    }
  });
});
