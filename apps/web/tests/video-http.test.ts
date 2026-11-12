import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { addAthlete, makeOrg } from "./helpers";
import { sessionCookie } from "./personas";

// La vidéo en HTTP (T10) : les vrais handlers, avec une vraie session, de l'envoi jusqu'à la vue de l'athlète.
// Seul Mux est simulé : une adresse d'envoi par appel. La fin du traitement (webhook Mux) a son propre test,
// mux-webhook.test.ts ; ici, elle est posée en base.

const uploads = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/lib/mux", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mux")>()),
  videoEnabled: () => true,
  createDirectUpload: async () => {
    uploads.count += 1;
    return { uploadId: `upload-${uploads.count}`, url: `https://mux.invalid/upload-${uploads.count}` };
  },
  signedPlayback: async () => ({ playbackId: "lecture", token: "jeton", thumbnailToken: "vignette" }),
}));

type Context = { params: Promise<Record<string, string>> };
type Handler = (request: NextRequest, context: Context) => Promise<Response>;

const routes = {
  videos: () => import("../app/api/v1/orgs/[orgId]/videos/route"),
  video: () => import("../app/api/v1/orgs/[orgId]/videos/[videoId]/route"),
  upload: () => import("../app/api/v1/orgs/[orgId]/videos/[videoId]/upload/route"),
  share: () => import("../app/api/v1/orgs/[orgId]/videos/[videoId]/share/route"),
  annotations: () => import("../app/api/v1/orgs/[orgId]/videos/[videoId]/annotations/route"),
  annotation: () => import("../app/api/v1/orgs/[orgId]/videos/[videoId]/annotations/[annotationId]/route"),
};

const call = async (
  handler: Handler,
  params: Record<string, string>,
  cookie: string,
  init: { method: string; body?: unknown; query?: Record<string, string> },
) => {
  const url = new URL(`http://localhost:3000/api/v1/test`);
  for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);
  const headers = new Headers({ cookie });
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const response = await handler(
    new NextRequest(url, {
      method: init.method,
      headers,
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    }),
    { params: Promise.resolve(params) },
  );
  return { status: response.status, body: (await response.json().catch(() => null)) as Record<string, unknown> };
};

let org: Awaited<ReturnType<typeof makeOrg>>;
let athlete: Awaited<ReturnType<typeof addAthlete>>;
let coach: string;
let athleteCookie: string;
let stranger: string;

beforeAll(async () => {
  org = await makeOrg("Vidéo HTTP");
  athlete = await addAthlete(org.organizationId, org.groupId, "Saut");
  coach = await sessionCookie(org.owner.email);
  athleteCookie = await sessionCookie(athlete.email);
  const other = await makeOrg("Autre club");
  stranger = await sessionCookie(other.owner.email);
}, 60_000);

describe("vidéo en HTTP", () => {
  it("de l'envoi à la vue de l'athlète : adresse, renouvellement, liste, partage, annotations", async () => {
    const orgId = org.organizationId;
    // Le coach crée la vidéo : une adresse d'envoi Mux, la vidéo en cours d'envoi.
    const created = await call((await routes.videos()).POST as Handler, { orgId }, coach, {
      method: "POST",
      body: { athleteId: athlete.athleteId },
    });
    expect(created.status).toBe(200);
    const videoId = created.body.videoId as string;
    expect(created.body.uploadUrl).toBe(`https://mux.invalid/upload-${uploads.count}`);

    // L'adresse a expiré : le serveur en délivre une nouvelle, pour la même vidéo.
    const renewed = await call((await routes.upload()).POST as Handler, { orgId, videoId }, coach, { method: "POST" });
    expect(renewed.status).toBe(200);
    expect(renewed.body).toMatchObject({ videoId, uploadUrl: `https://mux.invalid/upload-${uploads.count}` });
    expect((await prisma.video.findUniqueOrThrow({ where: { id: videoId } })).muxUploadId).toBe(
      `upload-${uploads.count}`,
    );

    // La liste du coach, filtrée par athlète.
    const listed = await call((await routes.videos()).GET as Handler, { orgId }, coach, {
      method: "GET",
      query: { athleteId: athlete.athleteId },
    });
    expect(listed.status).toBe(200);
    expect(JSON.stringify(listed.body)).toContain(videoId);

    // Mux a fini (webhook simulé) : la vidéo est prête. Pas encore partagée, l'athlète ne la voit pas.
    await prisma.video.update({ where: { id: videoId }, data: { status: "ready", muxPlaybackId: "lecture" } });
    const hidden = await call((await routes.video()).GET as Handler, { orgId, videoId }, athleteCookie, {
      method: "GET",
    });
    expect([403, 404]).toContain(hidden.status);

    // Une remarque du coach, puis le partage : l'athlète voit la vidéo et la remarque, et reçoit une notification.
    const note = await call((await routes.annotations()).POST as Handler, { orgId, videoId }, coach, {
      method: "POST",
      body: { tMs: 1_200, phase: null, text: "Bras libre plus haut à l'appel" },
    });
    expect(note.status).toBe(200);
    const shared = await call((await routes.share()).POST as Handler, { orgId, videoId }, coach, {
      method: "POST",
      body: { withAthlete: true },
    });
    expect(shared.status).toBe(200);
    expect(await prisma.notification.count({ where: { userId: athlete.userId, type: "video_shared" } })).toBe(1);
    const seen = await call((await routes.video()).GET as Handler, { orgId, videoId }, athleteCookie, {
      method: "GET",
    });
    expect(seen.status).toBe(200);
    expect(JSON.stringify(seen.body)).toContain("Bras libre plus haut");

    // Le partage au groupe reste hors V1 : refusé.
    const group = await call((await routes.share()).POST as Handler, { orgId, videoId }, coach, {
      method: "POST",
      body: { withAthlete: true, withGroup: true },
    });
    expect(group.status).toBe(403);

    // La remarque retirée disparaît de la vue de l'athlète.
    const annotation = await prisma.videoAnnotation.findFirstOrThrow({ where: { videoId } });
    const removed = await call(
      (await routes.annotation()).DELETE as Handler,
      { orgId, videoId, annotationId: annotation.id },
      coach,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(200);
    const after = await call((await routes.video()).GET as Handler, { orgId, videoId }, athleteCookie, {
      method: "GET",
    });
    expect(JSON.stringify(after.body)).not.toContain("Bras libre plus haut");
  });

  it("un coach d'un autre espace ne crée, ne lit ni ne partage rien", async () => {
    const orgId = org.organizationId;
    const video = await prisma.video.findFirstOrThrow({ where: { organizationId: orgId } });
    const create = await call((await routes.videos()).POST as Handler, { orgId }, stranger, {
      method: "POST",
      body: { athleteId: athlete.athleteId },
    });
    expect(create.status).toBe(403);
    const read = await call((await routes.video()).GET as Handler, { orgId, videoId: video.id }, stranger, {
      method: "GET",
    });
    expect(read.status).toBe(403);
    const share = await call((await routes.share()).POST as Handler, { orgId, videoId: video.id }, stranger, {
      method: "POST",
      body: { withAthlete: true },
    });
    expect(share.status).toBe(403);
  });
});
