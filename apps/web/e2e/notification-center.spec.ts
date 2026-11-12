import { expect, test } from "@playwright/test";
import { m } from "@tartan/i18n";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll } from "./helpers";
import { sql } from "./personas";

// T18 : le centre de notifications et les nouveautés vues. Les notifications sont posées en base, comme les écrirait
// la tâche d'envoi ; la lecture, le compteur et les routes `notifications/read` et `releases/seen` sont réels.

const unread = async (request: import("@playwright/test").APIRequestContext) =>
  ((await (await request.get("/api/v1/notifications?limit=1")).json()) as { unread: number }).unread;

test("centre de notifications : compteur, lecture d'une ligne, tout marquer comme lu", async ({ page }) => {
  await createCoachSpace(page, "Cloche");
  const me = (await (await page.request.get("/api/v1/me")).json()) as { id: string };
  await sql(async (client) => {
    const insert = (type: string, payload: object, minutesAgo: number) =>
      client.query(
        `insert into notifications (id, user_id, type, payload, created_at, updated_at)
         values (gen_random_uuid(), $1, $2, $3, now() - make_interval(mins => $4), now())`,
        [me.id, type, JSON.stringify(payload), minutesAgo],
      );
    await insert("session_eve", {}, 30);
    await insert("comment", { athlete: "Léa", link: "/suivi" }, 20);
    await insert("announcement", { coach: "Malik", link: "/annonces" }, 10);
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/suivi");
  const bell = page.getByRole("link", { name: m.inbox.open(3) });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page.getByRole("heading", { name: m.inbox.title, level: 1 })).toBeVisible();
  await expect(page.getByText(`, ${m.inbox.unread}`)).toHaveCount(3);
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);

  // Ouvrir une notification la marque lue, et mène à sa page.
  await page.getByRole("link", { name: /Malik a publié une annonce/ }).click();
  await expect(page).toHaveURL(/\/annonces/);
  await expect.poll(() => unread(page.request)).toBe(2);

  // Tout marquer comme lu : plus de bouton, plus de compteur.
  await page.goto("/notifications");
  await page.getByRole("button", { name: m.inbox.markAll }).click();
  await expect(page.getByRole("button", { name: m.inbox.markAll })).toHaveCount(0);
  await expect(page.getByText(`, ${m.inbox.unread}`)).toHaveCount(0);
  await expect(page.getByRole("link", { name: m.inbox.open(0), exact: true })).toBeVisible();
  expect(await unread(page.request)).toBe(0);

  // Une demande sans cible est refusée.
  expect((await page.request.post("/api/v1/notifications/read", { data: {} })).status()).toBe(400);
});

test("nouveautés : la dernière version s'annonce une fois, puis plus après avoir été vue", async ({ page }) => {
  await createCoachSpace(page, "Nouveautes");
  const me = (await (await page.request.get("/api/v1/me")).json()) as { id: string };
  // Un compte récent ne voit pas les nouveautés d'avant son inscription : on le vieillit.
  await sql((client) => client.query(`update "user" set created_at = '2020-01-01' where id = $1`, [me.id]));

  type Releases = { releases: { id: string }[]; unseen: { id: string } | null };
  const status = async () => (await (await page.request.get("/api/v1/releases")).json()) as Releases;
  const before = await status();
  expect(before.unseen).not.toBeNull();

  // Un identifiant inconnu ne change rien ; le bon fait taire l'annonce.
  expect((await page.request.post("/api/v1/releases/seen", { data: { releaseId: "inconnue" } })).status()).toBe(200);
  expect((await status()).unseen?.id).toBe(before.unseen!.id);
  expect((await page.request.post("/api/v1/releases/seen", { data: { releaseId: before.unseen!.id } })).status()).toBe(
    200,
  );
  expect((await status()).unseen).toBeNull();
  expect((await page.request.post("/api/v1/releases/seen", { data: {} })).status()).toBe(400);
});
