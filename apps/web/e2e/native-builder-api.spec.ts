import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createCoachSpace } from "./helpers";
import { groupLink, joinAsAthlete } from "./journeys";

// Exerce le transport réellement utilisé par l'app native ; la recette de l'écran reste distincte.
test("l’API du constructeur conserve les identités, les adaptations, les versions et les droits", async ({
  page,
  browser,
}) => {
  await createCoachSpace(page, "Constructeur");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId;
  const root = `/api/v1/orgs/${orgId}`;
  const member = await joinAsAthlete(browser, await groupLink(page), "Destinataire");
  try {
    const athleteId = (await (await member.page.request.get("/api/v1/me")).json()).spaces[0].athleteId;
    const context = await (await page.request.get(`${root}/session-builder`)).json();
    expect((await member.page.request.get(`${root}/session-builder`)).status()).toBe(403);
    const itemRef = randomUUID();
    const prescription = {
      sets: 3,
      reps: 4,
      load: { type: "kg", value: 42.5 },
      intensityTarget: { type: "rir", value: 2 },
      rest_s: 90,
    };
    const draft = {
      title: "Force et vitesse native",
      type: "strength",
      durationMin: 45,
      coachNote: "Contrôle",
      blocks: [
        {
          ref: randomUUID(),
          name: "Force",
          variant: "club",
          items: [{ ref: itemRef, exerciseId: context.exercises[0].id, prescription }],
        },
        { ref: randomUUID(), name: "Retour au calme", variant: "both", items: [] },
      ],
    };
    const body = {
      date: "2030-06-12",
      startTime: "18:00",
      location: "Stade",
      publishAt: null,
      assignments: [{ targetType: "group", targetId: context.groups[0].id }],
      overrides: [{ athleteId, itemRef, prescription: { ...prescription, load: { type: "kg", value: 30 } } }],
      draft,
    };
    const create = await page.request.post(`${root}/sessions`, { data: body });
    expect(create.status()).toBe(200);
    const saved = await create.json();
    const path = `${root}/sessions/${saved.id}`;
    const templateResponse = await page.request.post(`${root}/session-templates`, { data: draft });
    expect(templateResponse.ok()).toBe(true);
    const templateId = (await templateResponse.json()).id;
    expect((await member.page.request.post(`${root}/session-templates`, { data: draft })).status()).toBe(403);
    const templates = (await (await page.request.get(`${root}/session-builder`)).json()).templates;
    expect(templates.some((t: { title: string }) => t.title === draft.title)).toBe(true);
    expect(templates.find((t: { id: string }) => t.id === templateId).canDelete).toBe(true);
    expect((await member.page.request.delete(`${root}/session-templates/${templateId}`)).status()).toBe(403);
    expect((await page.request.delete(`${root}/session-templates/${templateId}`)).ok()).toBe(true);
    expect((await page.request.get(path)).ok()).toBe(true);
    const moved = structuredClone(body);
    moved.draft.blocks[1]!.items.push(moved.draft.blocks[0]!.items.pop()!);
    const update = await page.request.put(path, { data: { ...moved, expectedVersion: saved.version } });
    expect(update.ok()).toBe(true);
    const updated = await update.json();
    expect((await page.request.put(path, { data: { ...body, expectedVersion: saved.version } })).status()).toBe(409);
    const edit = await (await page.request.get(path)).json();
    expect(edit.draft.blocks[1].items[0].ref).toBe(itemRef);
    expect(edit.overrides[0].itemRef).toBe(itemRef);
    expect(
      (await member.page.request.put(path, { data: { ...body, expectedVersion: updated.version } })).status(),
    ).toBe(403);
    expect((await page.request.post(`${path}/publish`, { data: { expectedVersion: saved.version } })).status()).toBe(
      409,
    );
    expect((await page.request.post(`${path}/publish`, { data: { expectedVersion: updated.version } })).ok()).toBe(
      true,
    );
    const published = await (await page.request.get(path)).json();
    expect(published.publishedAt).not.toBeNull();
    expect(published.version).toBeGreaterThan(updated.version);
    const athlete = await (await member.page.request.get(`${path}/me`)).json();
    expect(athlete.blocks[1].items[0].prescription.load.value).toBe(30);
    expect(athlete.blocks[1].items[0].prescription.intensityTarget).toEqual({ type: "rir", value: 2 });
    const impossible = await page.request.post(`${root}/sessions`, { data: { ...body, date: "2030-02-30" } });
    expect(impossible.status()).toBe(400);
    expect(
      (await member.page.request.delete(`${path}?expectedVersion=${published.version}&expectedLogCount=0`)).status(),
    ).toBe(403);
    expect((await page.request.delete(`${path}?expectedVersion=${saved.version}&expectedLogCount=0`)).status()).toBe(
      409,
    );
    expect((await page.request.delete(`${path}?expectedVersion=${published.version}`)).status()).toBe(400);
    expect(
      (
        await page.request.delete(`${path}?expectedVersion=${published.version}&expectedLogCount=${published.logCount}`)
      ).ok(),
    ).toBe(true);
    expect((await page.request.get(path)).status()).toBe(404);
    expect((await member.page.request.get(`${path}/me`)).status()).toBe(404);
  } finally {
    await member.context.close();
  }
});
