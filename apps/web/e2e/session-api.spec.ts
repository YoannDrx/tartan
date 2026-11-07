import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { sessionBuilderContext, sessionEditResponse, sessionSaveResult } from "@tartan/contracts";
import { createCoachSpace } from "./helpers";

test("l'API du constructeur crée un brouillon, contrôle les versions et publie séparément", async ({ page }) => {
  await createCoachSpace(page, "APICoach");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId as string;
  const root = `/api/v1/orgs/${orgId}`;
  const context = sessionBuilderContext.parse(await (await page.request.get(`${root}/session-builder`)).json());
  const draft = {
    title: "Brouillon depuis le mobile",
    type: "strength",
    durationMin: 30,
    coachNote: null,
    blocks: [
      {
        ref: randomUUID(),
        name: "Force",
        variant: "club",
        items: [{ ref: randomUUID(), exerciseId: context.exercises[0]!.id, prescription: { sets: 3, reps: 4 } }],
      },
    ],
  };
  const input = {
    date: "2030-06-12",
    startTime: null,
    location: null,
    publishAt: null,
    draft,
    assignments: [{ targetType: "group", targetId: context.groups[0]!.id }],
    overrides: [],
  };
  const created = await page.request.post(`${root}/sessions`, { data: input });
  expect(created.ok()).toBe(true);
  const saved = sessionSaveResult.parse(await created.json());
  const path = `${root}/sessions/${saved.id}`;
  const edit = sessionEditResponse.parse(await (await page.request.get(path)).json());
  expect(edit.publishedAt).toBeNull();
  expect(edit.draft.blocks[0]?.items[0]?.ref).toBe(draft.blocks[0]!.items[0]!.ref);
  expect((await page.request.put(path, { data: input })).status()).toBe(400);
  const update = { ...input, expectedVersion: edit.version, draft: { ...draft, title: "Brouillon relu" } };
  expect((await page.request.put(path, { data: update })).ok()).toBe(true);
  const stale = await page.request.put(path, { data: update });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).code).toBe("session_version_conflict");
  expect((await page.request.post(`${path}/publish`, { data: { expectedVersion: edit.version } })).status()).toBe(409);
  expect((await page.request.post(`${path}/publish`, { data: { expectedVersion: edit.version + 1 } })).ok()).toBe(true);
  const published = sessionEditResponse.parse(await (await page.request.get(path)).json());
  expect(published.publishedAt).not.toBeNull();
  expect(published.draft.title).toBe("Brouillon relu");
  expect((await page.request.delete(path)).ok()).toBe(true);
  expect((await page.request.get(path)).status()).toBe(404);
});
