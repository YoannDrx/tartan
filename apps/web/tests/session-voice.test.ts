import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import type { SessionDraft } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { getAthleteSession, logSession } from "@/server/athlete-view.service";
import { setConsent } from "@/server/consent.service";
import { saveExercise } from "@/server/exercise.service";
import {
  deleteSession,
  duplicateSession,
  getSessionForEdit,
  listTemplates,
  publishRow,
  saveScheduledSession,
  saveTemplate,
} from "@/server/session.service";
import { getSessionDetailForCoach } from "@/server/tracking.service";
import { runRetention } from "@/server/retention.service";
import { POST as upload } from "../app/api/v1/orgs/[orgId]/voice-instructions/route";
import { GET as listen } from "../app/api/v1/orgs/[orgId]/voice-instructions/[clipId]/route";
import {
  GET as debrief,
  PUT as record,
  DELETE as remove,
} from "../app/api/v1/orgs/[orgId]/sessions/[sessionId]/voice-debrief/route";
import { addAthlete, addStaff, makeOrg } from "./helpers";

vi.mock("@/lib/session", () => ({
  getActorFrom: async (headers: Headers) => {
    const userId = headers.get("x-test-actor");
    return userId ? { userId } : null;
  },
}));

const audioBytes = async (name = "silence.m4a") =>
  new Uint8Array(await readFile(new URL(`./fixtures/planner-audio/${name}`, import.meta.url)));
const req = (userId: string, query = "", headers: Record<string, string> = {}) =>
  new Request(`http://localhost/api${query}`, { headers: { "x-test-actor": userId, ...headers } });
const uploadReq = (userId: string, bytes: Uint8Array<ArrayBuffer>, method = "POST") =>
  new Request("http://localhost/api", {
    method,
    body: bytes,
    headers: { "x-test-actor": userId, "Content-Type": "audio/mp4" },
  });

async function setup() {
  const { owner, organizationId: orgId, groupId } = await makeOrg("Vocaux");
  const athlete = await addAthlete(orgId, groupId, "Écoute");
  const exercise = await saveExercise(owner.userId, orgId, { name: "Foulées", category: "running_drill" });
  const ctx = { params: Promise.resolve({ orgId }) };
  const bytes = await audioBytes();
  const res = await upload(uploadReq(owner.userId, bytes), ctx);
  expect(res.status).toBe(201);
  const { id: clipId } = await res.json();
  const draft: SessionDraft = {
    title: "Piste",
    type: "running",
    durationMin: null,
    coachNote: null,
    blocks: [
      { name: "Piste", variant: "both", items: [{ exerciseId: exercise.id, prescription: { coachVoiceId: clipId } }] },
    ],
  };
  const session = await saveScheduledSession(owner.userId, orgId, {
    date: "2030-02-01",
    startTime: null,
    location: null,
    publishAt: null,
    draft,
    assignments: [{ targetType: "athlete", targetId: athlete.athleteId }],
    overrides: [],
  });
  await publishRow(session.id, owner.userId, new Date(), { silent: true });
  return {
    owner,
    orgId,
    athlete,
    bytes,
    draft,
    clipId,
    session,
    ctx,
    groupId,
    clipCtx: { params: Promise.resolve({ orgId, clipId }) },
    sessionCtx: { params: Promise.resolve({ orgId, sessionId: session.id }) },
  };
}

it("écoute la consigne attribuée sur son exercice, avec contrôle de séance et plages de lecture", async () => {
  const { owner, orgId, athlete, bytes, clipId, session, clipCtx, ctx } = await setup();
  const foreign = await addAthlete(orgId, null, "Autre");
  const query = `?sessionId=${session.id}`;
  expect((await listen(req(athlete.userId), clipCtx)).status).toBe(403);
  expect((await listen(req(foreign.userId, query), clipCtx)).status).toBe(404);
  expect((await upload(uploadReq(athlete.userId, bytes), ctx)).status).toBe(403);
  expect((await listen(req(owner.userId), clipCtx)).status).toBe(200);
  const narrow = await listen(req(athlete.userId, query, { range: "bytes=0-1" }), clipCtx);
  expect(narrow.status).toBe(206);
  expect(narrow.headers.get("content-range")).toBe(`bytes 0-1/${bytes.length}`);
  expect(narrow.headers.get("cache-control")).toContain("no-store");
  expect(new Uint8Array(await narrow.arrayBuffer())).toEqual(bytes.slice(0, 2));
  const unused = await upload(uploadReq(owner.userId, bytes), ctx);
  const another = (await unused.json()).id;
  expect(
    (await listen(req(athlete.userId, query), { params: Promise.resolve({ orgId, clipId: another }) })).status,
  ).toBe(404);
  expect(
    (await getAthleteSession(athlete.userId, orgId, session.id)).blocks[0]?.items[0]?.prescription.coachVoiceId,
  ).toBe(clipId);
});

it("protège le débrief par la validation, le groupe, le consentement et le retrait", async () => {
  const { athlete, owner, orgId, groupId, bytes, sessionCtx, session } = await setup();
  const coach = await addStaff(orgId, "Suivi", "coach", [groupId]);
  const outside = await addStaff(orgId, "AutreGroupe", "coach");
  const coachQuery = `?athleteId=${athlete.athleteId}`;
  expect((await record(uploadReq(athlete.userId, bytes, "PUT"), sessionCtx)).status).toBe(409);
  await logSession(athlete.userId, orgId, session.id, { status: "done", variantDone: "club", clientId: randomUUID() });
  const send = () => record(uploadReq(athlete.userId, bytes, "PUT"), sessionCtx);
  expect((await send()).status).toBe(204);
  expect((await send()).status).toBe(204);
  expect((await getAthleteSession(athlete.userId, orgId, session.id)).log?.hasVoiceDebrief).toBe(true);
  expect((await getSessionDetailForCoach(owner.userId, orgId, session.id)).athletes[0]?.hasVoiceDebrief).toBe(true);
  expect((await debrief(req(outside.userId, coachQuery), sessionCtx)).status).toBe(403);
  expect((await remove(req(coach.userId, coachQuery), sessionCtx)).status).toBe(403);
  const response = await debrief(req(coach.userId, coachQuery), sessionCtx);
  expect(response.status).toBe(200);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  expect((await remove(req(athlete.userId), sessionCtx)).status).toBe(204);
  expect((await debrief(req(athlete.userId), sessionCtx)).status).toBe(404);
  expect((await send()).status).toBe(204);
  await setConsent(athlete.userId, "health", false, athlete.athleteId);
  expect((await send()).status).toBe(409);
  expect((await debrief(req(coach.userId, coachQuery), sessionCtx)).status).toBe(404);
  expect(await prisma.sessionVoiceDebrief.count({ where: { log: { athleteId: athlete.athleteId } } })).toBe(0);
});

it("limite la taille et vérifie la piste audio avant toute conservation", async () => {
  const { owner, organizationId: orgId } = await makeOrg();
  const ctx = { params: Promise.resolve({ orgId }) };
  const large = uploadReq(owner.userId, new Uint8Array(3145729));
  large.headers.set("content-length", "1");
  expect((await upload(large, ctx)).status).toBe(400);
  expect((await upload(uploadReq(owner.userId, await audioBytes("video-only.mp4")), ctx)).status).toBe(400);
  expect(await prisma.coachVoiceInstruction.count({ where: { organizationId: orgId } })).toBe(0);
});

it("refuse la réutilisation entre espaces et purge seulement les brouillons abandonnés", async () => {
  const { owner, orgId, bytes, ctx, clipId, draft } = await setup();
  const another = await makeOrg();
  const foreign = await upload(uploadReq(another.owner.userId, bytes), {
    params: Promise.resolve({ orgId: another.organizationId }),
  });
  const foreignClipId = (await foreign.json()).id;
  const copy = structuredClone(draft);
  copy.blocks[0]!.items[0]!.prescription.coachVoiceId = foreignClipId;
  await expect(saveTemplate(owner.userId, orgId, copy)).rejects.toMatchObject({ status: 404 });
  const abandoned = (await (await upload(uploadReq(owner.userId, bytes), ctx)).json()).id;
  const old = new Date(Date.now() - 31 * 86400000);
  await prisma.coachVoiceInstruction.updateMany({
    where: { id: { in: [clipId, abandoned] } },
    data: { createdAt: old },
  });
  await runRetention();
  expect(await prisma.coachVoiceInstruction.count({ where: { id: abandoned } })).toBe(0);
  expect(await prisma.coachVoiceInstruction.count({ where: { id: clipId } })).toBe(1);
});

it("garde les copies modifiables lorsque le compte auteur a effacé le vocal", async () => {
  const { owner, orgId, athlete, session, draft, clipId } = await setup();
  const template = await saveTemplate(owner.userId, orgId, draft);
  await prisma.coachVoiceInstruction.delete({ where: { id: clipId } });
  const edit = await getSessionForEdit(owner.userId, orgId, session.id);
  expect(edit.draft.blocks[0]!.items[0]!.prescription.coachVoiceId).toBeUndefined();
  expect(
    (await getAthleteSession(athlete.userId, orgId, session.id)).blocks[0]!.items[0]!.prescription.coachVoiceId,
  ).toBeUndefined();
  const templates = await listTemplates(owner.userId, orgId, true);
  expect(templates.find((t) => t.id === template.id)!.blocks[0]!.items[0]!.prescription.coachVoiceId).toBeUndefined();
  await saveScheduledSession(owner.userId, orgId, edit);
});

it("respecte la variante visible et conserve le vocal de la version validée", async () => {
  const { owner, orgId, athlete, session, clipId, clipCtx } = await setup();
  const edit = await getSessionForEdit(owner.userId, orgId, session.id);
  const exerciseId = edit.draft.blocks[0]!.items[0]!.exerciseId;
  edit.draft.blocks[0]!.variant = "club";
  delete edit.draft.blocks[0]!.items[0]!.prescription.coachVoiceId;
  edit.draft.blocks.push({
    ref: "b-autonome",
    name: "Autonomie",
    variant: "autonomous",
    items: [{ ref: "exo-autonome", exerciseId, prescription: { coachVoiceId: clipId } }],
  });
  await saveScheduledSession(owner.userId, orgId, edit);
  const heard = () => listen(req(athlete.userId, `?sessionId=${session.id}`), clipCtx);
  expect((await heard()).status).toBe(404);
  await logSession(athlete.userId, orgId, session.id, {
    status: "done",
    variantDone: "autonomous",
    clientId: randomUUID(),
  });
  expect((await heard()).status).toBe(200);
  const revision = await getSessionForEdit(owner.userId, orgId, session.id);
  delete revision.draft.blocks[1]!.items[0]!.prescription.coachVoiceId;
  await saveScheduledSession(owner.userId, orgId, revision);
  await prisma.coachVoiceInstruction.update({
    where: { id: clipId },
    data: { createdAt: new Date(Date.now() - 31 * 86400000) },
  });
  await runRetention();
  expect((await heard()).status).toBe(200);
});

it("conserve le vocal d'une copie après suppression de la séance source", async () => {
  const { owner, orgId, athlete, session, clipCtx, clipId } = await setup();
  const duplicate = await duplicateSession(owner.userId, orgId, session.id, "2030-02-04");
  await publishRow(duplicate.id, owner.userId, new Date(), { silent: true });
  const source = await getSessionForEdit(owner.userId, orgId, session.id);
  await deleteSession(owner.userId, orgId, session.id, { expectedVersion: source.version, expectedLogCount: 0 });
  await prisma.coachVoiceInstruction.update({
    where: { id: clipId },
    data: { createdAt: new Date(Date.now() - 31 * 86400000) },
  });
  await runRetention();
  const response = await listen(req(athlete.userId, `?sessionId=${duplicate.id}`), clipCtx);
  expect(response.status).toBe(200);
});
