import { randomUUID } from "node:crypto";
import { EXERCISE_CATALOG } from "@tartan/domain/exercise-catalog";
import { exerciseClip } from "@tartan/mascot/exercises";
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

  it("annonce le geste à la lecture, relu ou non, sans toucher un guide sans geste", () => {
    const squat = guideOf("back-squat");
    expect(withMotion(squat, []).illustration.motion).toBe("review");
    expect(withMotion(squat, ["strength"]).illustration.motion).toBe("approved");
    expect(withMotion(null, ["strength"])).toBeNull();
  });

  it("chaque fiche du catalogue a son geste", () => {
    expect(EXERCISE_CATALOG.filter((entry) => !exerciseClip(entry.catalogKey)).map((entry) => entry.catalogKey)).toEqual([]);
  });

  it("un geste vu de face reste « de travail » tant que sa série n'est pas validée, même dans une famille relue", () => {
    const lateral = guideOf("lateral-raise");
    expect(exerciseClip("lateral-raise")!.batch).toBe("face");
    expect(withMotion(lateral, ["strength"]).illustration.motion).toBe("review");
    expect(withMotion(lateral, ["strength", "strength:face"]).illustration.motion).toBe("approved");
    expect(withMotion(guideOf("back-squat"), ["strength:face"]).illustration.motion).toBe("review");
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
      expect(await approvedMotionFamilies()).toEqual(["plyometrics", "core:face"]);
      expect(await prisma.auditLog.count({ where: { action: "motion_family_approved", actorId: admin.userId } })).toBe(3);
    } finally {
      await prisma.platformSetting.deleteMany({ where: { key: "motionFamilies" } });
      await prisma.platformAdmin.deleteMany({ where: { email: admin.email } });
    }
  });
});
