import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { createVideoInput } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { createVideoUpload, getVideo } from "@/server/video.service";
import { addAthlete, makeOrg } from "./helpers";

vi.mock("@/lib/mux", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mux")>()),
  videoEnabled: () => true,
  createDirectUpload: async () => ({ uploadId: `test-${randomUUID()}`, url: "https://upload.invalid/video" }),
}));

it("les imports génériques ne créent aucun essai ; une barre explicite conserve ses valeurs", async () => {
  const org = await makeOrg("Vidéo générique");
  const athlete = await addAthlete(org.organizationId, org.groupId, "Vitesse");
  for (const attempt of [undefined, null]) {
    const upload = await createVideoUpload(
      org.owner.userId,
      org.organizationId,
      createVideoInput.parse({ athleteId: athlete.athleteId, attempt }),
    );
    expect(await prisma.jumpAttempt.count({ where: { videoId: upload.videoId } })).toBe(0);
    expect(await getVideo(org.owner.userId, org.organizationId, upload.videoId)).toMatchObject({
      barHeightCm: null,
      attemptNo: null,
      result: null,
    });
  }
  const attempt = { barHeightCm: 175, attemptNo: 2, result: "X", approachSteps: 8 };
  const upload = await createVideoUpload(
    org.owner.userId,
    org.organizationId,
    createVideoInput.parse({ athleteId: athlete.athleteId, attempt }),
  );
  expect(await prisma.jumpAttempt.findMany({ where: { videoId: upload.videoId } })).toMatchObject([attempt]);
  expect(await getVideo(org.owner.userId, org.organizationId, upload.videoId)).toMatchObject({
    barHeightCm: 175,
    attemptNo: 2,
    result: "X",
  });
});
