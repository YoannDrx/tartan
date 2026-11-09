import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { Client } from "pg";
import { createCoachSpace } from "./helpers";

const count = async (table: string, userId: string) => {
  const sql = new Client({
    connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e",
  });
  await sql.connect();
  try {
    const { rows } = await sql.query(`SELECT count(*)::int AS n FROM ${table} WHERE user_id = $1`, [userId]);
    return rows[0].n as number;
  } finally {
    await sql.end();
  }
};

test("la première passkey exige le bon jeton, puis ouvre la vérification", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "L'authentificateur virtuel n'existe que sous Chromium.");
  await createCoachSpace(page, "Passkey", "passkey-desktop@e2e.tartan.test");
  const me = await (await page.request.get("/api/v1/me")).json();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await page.goto("/verification-admin", { waitUntil: "networkidle" });
  const token = page.getByLabel(m.admin.bootstrapToken);
  const create = page.getByRole("button", { name: m.admin.passkeyCreate });

  await token.fill("mauvais-jeton");
  await create.click();
  await expect(page.getByText(m.admin.passkeyFailed)).toBeVisible();
  expect(await count("passkey", me.id)).toBe(0);

  await token.fill("jeton-e2e");
  await create.click();
  await expect(page).toHaveURL(/\/admin$/);
  expect(await count("passkey", me.id)).toBe(1);
});
