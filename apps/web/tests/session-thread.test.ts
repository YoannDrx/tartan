import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { sessionThreadView } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { getAthleteSession, logSession } from "@/server/athlete-view.service";
import { setAthleteConsent } from "@/server/consent.service";
import { saveExercise } from "@/server/exercise.service";
import { readThreadTranscriptionSource, saveThreadTranscript } from "@/server/session-thread.service";
import { putVoiceDebrief } from "@/server/session-voice.service";
import { publishRow, saveScheduledSession } from "@/server/session.service";
import { GET, POST } from "../app/api/v1/orgs/[orgId]/sessions/[sessionId]/thread/route";
import { GET as audio } from "../app/api/v1/orgs/[orgId]/sessions/[sessionId]/thread/[messageId]/audio/route";
import { addAthlete, addStaff, makeOrg } from "./helpers";

vi.mock("@/lib/session", () => ({
  getActorFrom: async (headers: Headers) =>
    headers.get("x-test-actor") ? { userId: headers.get("x-test-actor") } : null,
}));

async function world() {
  const { owner, organizationId: orgId, groupId } = await makeOrg("Fils");
  const athlete = await addAthlete(orgId, groupId, "Course");
  const second = await addAthlete(orgId, groupId, "Haies");
  const exercise = await saveExercise(owner.userId, orgId, { name: "Appuis", category: "running_drill" });
  const bytes = new Uint8Array(await readFile(new URL("./fixtures/planner-audio/silence.m4a", import.meta.url)));
  const clip = await prisma.coachVoiceInstruction.create({
    data: { organizationId: orgId, createdBy: owner.userId, mimeType: "audio/mp4", bytes },
    select: { id: true },
  });
  const saved = await saveScheduledSession(owner.userId, orgId, {
    date: "2030-01-01",
    startTime: null,
    location: null,
    publishAt: null,
    overrides: [],
    assignments: [{ targetType: "group", targetId: groupId }],
    draft: {
      title: "Stade",
      type: "running",
      durationMin: null,
      coachNote: null,
      blocks: [
        {
          name: "Au stade",
          variant: "club",
          items: [{ exerciseId: exercise.id, prescription: { coachVoiceId: clip.id } }],
        },
        { name: "À la maison", variant: "autonomous", items: [{ exerciseId: exercise.id, prescription: {} }] },
      ],
    },
  });
  await publishRow(saved.id, owner.userId, new Date(), { silent: true });
  const detail = await getAthleteSession(athlete.userId, orgId, saved.id);
  const ref = detail.blocks[0]!.items[0]!.ref;
  const params = { orgId, sessionId: saved.id };
  const ctx = { params: Promise.resolve(params) };
  const request = (user: string, target: Record<string, string>, init: RequestInit = {}) =>
    new Request("http://localhost/thread?" + new URLSearchParams(target), {
      ...init,
      headers: { "x-test-actor": user, ...init.headers },
    });
  const get = (user: string, target: Record<string, string>) => GET(request(user, target), ctx);
  const text = (user: string, target: Record<string, string>, text: string, clientId = randomUUID()) =>
    POST(
      request(user, target, {
        method: "POST",
        body: JSON.stringify({ text, clientId }),
        headers: { "content-type": "application/json" },
      }),
      ctx,
    );
  const voice = (user: string, target: Record<string, string>, clientId = randomUUID()) =>
    POST(
      request(user, target, {
        method: "POST",
        body: bytes,
        headers: { "content-type": "audio/mp4", "idempotency-key": clientId },
      }),
      ctx,
    );
  const listen = (user: string, target: Record<string, string>, messageId: string) =>
    audio(request(user, target, { headers: { range: "bytes=0-1" } }), {
      params: Promise.resolve({ ...params, messageId }),
    });
  const done = () =>
    logSession(athlete.userId, orgId, saved.id, { clientId: randomUUID(), status: "done", variantDone: "club" });
  return {
    orgId,
    groupId,
    sessionId: saved.id,
    athlete,
    second,
    owner,
    bytes,
    clip,
    ref,
    get,
    text,
    voice,
    listen,
    done,
    details: async (user: string, target: Record<string, string>) =>
      sessionThreadView.parse(await (await get(user, target)).json()),
    debriefAudio: () =>
      putVoiceDebrief(
        athlete.userId,
        orgId,
        saved.id,
        new Request("http://localhost/", { method: "PUT", body: bytes, headers: { "content-type": "audio/mp4" } }),
      ),
  };
}

it("isole chaque échange, même entre deux athlètes invités au même exercice avec le même vocal", async () => {
  const w = await world();
  const self = { itemRef: w.ref },
    target = { ...self, athleteId: w.athlete.athleteId };
  const coach = await addStaff(w.orgId, "Entraînement", "coach", [w.groupId]);
  const unassigned = await addStaff(w.orgId, "Loin", "coach");
  const user = w.athlete.userId;
  await setAthleteConsent(user, w.orgId, "health", false);
  expect((await w.text(user, self, "Une question")).status).toBe(201);
  const reply = await (await w.voice(coach.userId, target)).json();
  const view = await w.details(user, self);
  expect(view.root).toMatchObject({ version: w.clip.id, authorRole: "coach", mine: false, durationSeconds: null });
  expect(view.messages.map((m) => [m.authorRole, m.mine, m.text])).toEqual([
    ["athlete", true, "Une question"],
    ["coach", false, null],
  ]);
  expect(view.messages[1]?.voice?.durationSeconds).toBeGreaterThan(0);
  expect((await w.details(w.second.userId, self)).messages).toEqual([]);
  expect((await w.get(w.second.userId, target)).status).toBe(403);
  expect((await w.listen(w.second.userId, self, reply.id)).status).toBe(404);
  expect((await w.listen(unassigned.userId, target, reply.id)).status).toBe(403);
  expect((await w.listen(user, self, reply.id)).status).toBe(206);
  expect((await w.listen(user, self, "root")).status).toBe(206);
  expect((await w.get(user, { itemRef: "autre-occurrence" })).status).toBe(404);
  expect((await w.get(w.owner.userId, self)).status).toBe(403);
});

it("rejoue les réponses texte et vocales concurrentes sans les dupliquer ni réaffecter leur identifiant", async () => {
  const w = await world(),
    uid = w.athlete.userId,
    target = { itemRef: w.ref };
  const key = randomUUID(),
    voiceKey = randomUUID();
  const [first, again] = await Promise.all([w.text(uid, target, "Texte", key), w.text(uid, target, "Texte", key)]);
  expect(await first.json()).toEqual(await again.json());
  const [a, b] = await Promise.all([w.voice(uid, target, voiceKey), w.voice(uid, target, voiceKey)]);
  expect(await a.json()).toEqual(await b.json());
  expect((await w.text(uid, target, "Modifié", key)).status).toBe(409);
  expect((await w.text(uid, target, "Modifié", voiceKey)).status).toBe(409);
  expect((await w.text(uid, target, "  ")).status).toBe(400);
  expect((await w.text(uid, target, "x".repeat(2001))).status).toBe(400);
  const view = await w.details(uid, target);
  expect(view.messages).toHaveLength(2);
  expect(view.messages[1]?.voice?.canTranscribe).toBe(true);
});

it("réserve la transcription à l'auteur tout en partageant son résultat avec les seuls destinataires", async () => {
  const w = await world(),
    uid = w.athlete.userId,
    owner = w.owner.userId;
  const own = { itemRef: w.ref },
    target = { ...own, athleteId: w.athlete.athleteId };
  const { id } = await (await w.voice(uid, own)).json();
  const source = (user: string, t: typeof own, messageId: string, version: string) =>
    readThreadTranscriptionSource(user, w.orgId, w.sessionId, t, messageId, version);
  await expect(source(owner, target, id, id)).rejects.toMatchObject({ status: 403 });
  await expect(source(uid, own, "root", w.clip.id)).rejects.toMatchObject({ status: 403 });
  await expect(source(uid, own, id, randomUUID())).rejects.toMatchObject({ status: 409 });
  expect((await source(uid, own, id, id)).bytes).toEqual(w.bytes);
  expect(await saveThreadTranscript(uid, w.orgId, w.sessionId, own, id, id, "Mon échange.")).toBe("Mon échange.");
  expect((await w.details(owner, target)).messages[0]?.voice?.transcript).toBe("Mon échange.");
  expect((await w.details(w.second.userId, own)).messages).toEqual([]);
  await saveThreadTranscript(owner, w.orgId, w.sessionId, target, "root", w.clip.id, "Consigne partagée.");
  expect((await w.details(w.second.userId, own)).root?.transcript).toBe("Consigne partagée.");
});

it("autorise un débrief initial écrit, puis efface le débrief et les réponses au retrait du consentement", async () => {
  const w = await world(),
    uid = w.athlete.userId,
    target = { athleteId: w.athlete.athleteId };
  expect((await w.text(uid, {}, "Avant")).status).toBe(409);
  await w.done();
  expect((await w.text(uid, {}, "Mon bilan écrit")).status).toBe(201);
  expect((await w.voice(w.owner.userId, target)).status).toBe(201);
  expect((await w.details(uid, {})).root).toBeNull();
  await w.debriefAudio();
  expect((await w.details(uid, {})).root).toMatchObject({ mine: true, authorRole: "athlete" });
  expect((await w.details(w.owner.userId, target)).messages).toHaveLength(2);
  const [concurrent] = await Promise.all([
    w.text(w.owner.userId, target, "Envoi pendant le retrait"),
    setAthleteConsent(uid, w.orgId, "health", false),
  ]);
  expect([201, 409]).toContain(concurrent.status);
  expect((await w.get(w.owner.userId, target)).status).toBe(409);
  expect((await w.text(uid, {}, "Après retrait")).status).toBe(409);
  await setAthleteConsent(uid, w.orgId, "health", true);
  expect(await w.details(uid, {})).toEqual({ root: null, messages: [] });
});

it("ne conserve jamais une transcription périmée lors du remplacement par un ancien client ou de la réouverture", async () => {
  const w = await world(),
    uid = w.athlete.userId;
  const log = await w.done();
  await w.debriefAudio();
  const old = (await w.details(uid, {})).root!;
  await saveThreadTranscript(uid, w.orgId, w.sessionId, {}, "root", old.version, "Ancien débrief");
  await prisma.sessionVoiceDebrief.update({
    where: { sessionLogId: log.id },
    data: { bytes: w.bytes, mimeType: "audio/mp4" },
  });
  const current = (await w.details(uid, {})).root!;
  expect(current.version).not.toBe(old.version);
  expect(current).toMatchObject({ durationSeconds: null, transcript: null });
  await expect(
    saveThreadTranscript(uid, w.orgId, w.sessionId, {}, "root", old.version, "Résultat tardif"),
  ).rejects.toMatchObject({ status: 409 });
  await w.text(uid, {}, "Fin");
  await w.text(uid, { itemRef: w.ref }, "Exercice");
  await logSession(uid, w.orgId, w.sessionId, { clientId: randomUUID(), status: "partial", variantDone: "club" });
  await w.done();
  expect(await w.details(uid, {})).toEqual({ root: null, messages: [] });
  expect((await w.details(uid, { itemRef: w.ref })).messages).toHaveLength(1);
});

it("n'ouvre que l'occurrence de la variante individuelle effective et retient la variante de la validation", async () => {
  const w = await world();
  await prisma.attendance.create({
    data: { scheduledSessionId: w.sessionId, athleteId: w.athlete.athleteId, status: "absent", source: "athlete" },
  });
  const away = (await getAthleteSession(w.athlete.userId, w.orgId, w.sessionId)).blocks[0]!.items[0]!.ref;
  expect(away).not.toBe(w.ref);
  expect((await w.get(w.athlete.userId, { itemRef: w.ref })).status).toBe(404);
  expect((await w.get(w.owner.userId, { athleteId: w.athlete.athleteId, itemRef: w.ref })).status).toBe(404);
  expect((await w.text(w.athlete.userId, { itemRef: away }, "À la maison")).status).toBe(201);
  await logSession(w.athlete.userId, w.orgId, w.sessionId, {
    clientId: randomUUID(),
    status: "done",
    variantDone: "autonomous",
  });
  await prisma.attendance.updateMany({
    where: { scheduledSessionId: w.sessionId, athleteId: w.athlete.athleteId },
    data: { status: "present" },
  });
  expect((await w.details(w.owner.userId, { athleteId: w.athlete.athleteId, itemRef: away })).messages[0]?.text).toBe(
    "À la maison",
  );
  expect((await w.get(w.second.userId, { itemRef: away })).status).toBe(404);
});
