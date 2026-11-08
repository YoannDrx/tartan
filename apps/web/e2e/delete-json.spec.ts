import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { createApiClient } from "../../../packages/api-client/src/index";
import { createCoachSpace } from "./helpers";

test("le format DELETE natif détache le push et débloque seulement pour le compte connecté", async ({
  page,
  browser,
}) => {
  await createCoachSpace(page, "Appareil");
  const me = await (await page.request.get("/api/v1/me")).json();
  const other = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    const otherPage = await other.newPage();
    await createCoachSpace(otherPage, "AutreAppareil");
    const otherMe = await (await otherPage.request.get("/api/v1/me")).json();
    const pushToken = `ExpoPushToken[test-${randomUUID()}]`;
    const native = createApiClient({
      baseUrl: new URL(page.url()).origin,
      headers: async () => ({ Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") }),
    });
    await native.registerDevice(pushToken, "ios");
    const device = async () => (await sql.query("SELECT user_id FROM devices WHERE push_token = $1", [pushToken])).rows;
    expect(await device()).toEqual([{ user_id: me.id }]);
    expect((await otherPage.request.delete("/api/v1/devices", { data: { pushToken } })).ok()).toBe(true);
    expect(await device()).toEqual([{ user_id: me.id }]);
    expect((await page.request.delete("/api/v1/devices", { data: { pushToken: "court" } })).status()).toBe(400);
    await native.unregisterDevice(pushToken);
    expect(await device()).toEqual([]);
    await native.unregisterDevice(pushToken);
    expect(await device()).toEqual([]);
    expect((await page.request.post("/api/v1/blocks", { data: { userId: otherMe.id } })).ok()).toBe(true);
    const block = async () =>
      (
        await sql.query("SELECT blocker_id FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2", [
          me.id,
          otherMe.id,
        ])
      ).rows;
    expect(await block()).toHaveLength(1);
    expect((await otherPage.request.delete("/api/v1/blocks", { data: { userId: me.id } })).ok()).toBe(true);
    expect(await block()).toHaveLength(1);
    expect((await page.request.delete("/api/v1/blocks", { data: { userId: "incorrect" } })).status()).toBe(400);
    expect((await page.request.delete("/api/v1/blocks", { data: { userId: otherMe.id } })).ok()).toBe(true);
    expect(await block()).toEqual([]);
    const anonymous = await browser.newContext({ baseURL: new URL(page.url()).origin });
    try {
      expect((await anonymous.request.delete("/api/v1/devices", { data: { pushToken } })).status()).toBe(401);
    } finally {
      await anonymous.close();
    }
  } finally {
    await sql.end();
    await other.close();
  }
});
