import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { ApiError, createApiClient } from "../../../packages/api-client/src/index";
import { PLANNER_SLOT_EXERCISE_ID } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { createCoachSpace, expectAccessible, expectNoHorizontalScroll, expectNoMotion } from "./helpers";
import { today } from "./journeys";

// Recette du planificateur avec le prestataire factice du serveur (AI_PLANNER_FAKE_PROVIDER) : aucune clé, aucun
// appel externe. Tout le reste est réel : réponse diffusée, services, quotas, brouillons et écritures. Chaque
// parcours tourne sur ordinateur et sur téléphone.
test.skip(
  process.env.E2E_AI_PLANNER_ENABLED !== "true",
  "Recette dédiée : drapeau global actif et prestataire factice, sans clé.",
);
// La dictée s'exerce avec le micro et l'autorisation simulés par Chromium.
test.use({ launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });
const t = w.planner;
const f = w.exercises.finder;
const GROUP = "Hauteur Élite";
const db = () =>
  new Client({ connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://tartan@localhost:54329/tartan_e2e" });
// Captures de recette, hors dépôt, à 390, 768 et 1440 px :
// `E2E_SHOTS_DIR=/chemin E2E_PROD=1 E2E_AI_PLANNER_ENABLED=true corepack pnpm test:e2e e2e/ai-planner.spec.ts --project=desktop`.
const SHOTS = process.env.E2E_SHOTS_DIR;
const shots = async (page: Page, name: string) => {
  // Une série de captures suffit : celles du projet « desktop », aux trois largeurs.
  if (!SHOTS || test.info().project.name !== "desktop") return;
  const size = page.viewportSize()!;
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: path.join(SHOTS, `${name}-${width}.png`), fullPage: true });
  }
  await page.setViewportSize(size);
};

async function setup(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await createCoachSpace(page, "Planification");
  const me = await (await page.request.get("/api/v1/me")).json();
  const orgId = me.spaces[0].organizationId as string;
  const sql = db();
  await sql.connect();
  await sql.query(
    "UPDATE organizations SET ai_planner_enabled=true, progression_enabled=true, phases_enabled=true, plan='coach', available_equipment='{cones,bodyweight}' WHERE id=$1",
    [orgId],
  );
  await sql.query("UPDATE profiles SET ai_consent_at=now() WHERE id=$1", [me.id]);
  const api = createApiClient({
    baseUrl: new URL(page.url()).origin,
    headers: async () => ({ Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") }),
  });
  const group = (await sql.query("SELECT id FROM groups WHERE organization_id=$1", [orgId])).rows[0].id as string;
  // La fiche que la demande retient : la copie de l'espace si elle existe, sinon la fiche commune.
  const squat = (
    await sql.query(
      "SELECT id FROM exercises WHERE name='Squat arrière' AND deleted_at IS NULL AND (organization_id=$1 OR organization_id IS NULL) ORDER BY organization_id IS NULL LIMIT 1",
      [orgId],
    )
  ).rows[0].id as string;
  // Une fiche privée de l'espace, créée par l'API comme le fait la bibliothèque.
  const fiche = async (name: string) => {
    const response = await page.request.post(`/api/v1/orgs/${orgId}/exercises`, {
      data: { name, category: "strength" },
    });
    expect(response.ok()).toBe(true);
    return { id: (await response.json()).id as string, name };
  };
  return { sql, orgId, api, group, squat, fiche, userId: me.id as string };
}
type Setup = Awaited<ReturnType<typeof setup>>;
// Deux athlètes fictifs dans le groupe, sans compte : assez pour l'aperçu individuel et la couverture.
const athletes = async (a: Setup, count = 2) => {
  const ids: string[] = [];
  for (let index = 0; index < count; index++) {
    const id = randomUUID();
    await a.sql.query(
      "INSERT INTO athletes (id,organization_id,first_name,last_name,updated_at) VALUES ($1,$2,$3,'Fictif',now())",
      [id, a.orgId, `Athlète ${index + 1}`],
    );
    await a.sql.query(
      "INSERT INTO group_members (group_id,athlete_id,created_at,updated_at) VALUES ($1,$2,'2020-01-01',now())",
      [a.group, id],
    );
    ids.push(id);
  }
  return ids;
};
const reference = (a: Setup, athleteId: string, valueKg: number) =>
  a.api.selectStrengthReference(a.orgId, athleteId, a.squat, { source: "working", valueKg });
type Stored = {
  draft: { blocks: { items: { exerciseId: string; prescription: Record<string, unknown> }[] }[] };
  start_time: string | null;
  published_at: string | null;
};
const sessionsOf = async (a: Setup) =>
  (
    await a.sql.query(
      "SELECT draft, start_time, published_at FROM scheduled_sessions WHERE organization_id=$1 ORDER BY created_at",
      [a.orgId],
    )
  ).rows as Stored[];
const itemsOf = (session: Stored) => session.draft.blocks.flatMap((block) => block.items);
const field = (page: Page) => page.getByRole("textbox", { name: t.field, exact: true });
// La demande : le seul groupe de l'espace est déjà choisi, il reste un champ à remplir.
const request = async (page: Page, text: string) => {
  await page.goto("/planificateur");
  await expect(page.getByRole("button", { name: GROUP, exact: true })).toHaveAttribute("aria-pressed", "true");
  await field(page).fill(text);
};
const prepare = async (page: Page) => {
  await page.getByRole("button", { name: t.prepare, exact: true }).click();
  await expect(page.getByRole("heading", { name: t.sessionTitle, exact: true })).toBeVisible({ timeout: 30_000 });
};
const proposalOf = (a: Setup, page: Page) =>
  a.api.plannerProposal(a.orgId, new URL(page.url()).searchParams.get("proposition")!);
const createDraft = async (page: Page) => {
  await page.getByRole("button", { name: t.create, exact: true }).click();
  await expect(page.getByText(t.created, { exact: true })).toBeVisible({ timeout: 30_000 });
};
// La carte d'un exercice dans l'éditeur de séquence : son nom, puis sa prescription.
const card = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}`) }).first();
// Une retouche à la main : ouvrir la prescription de l'exercice et changer une valeur.
const retouch = async (page: Page, name: string, label: string, value: string) => {
  await card(page, name).click();
  await page.getByLabel(label, { exact: true }).fill(value);
};
const SQUAT = "Demain, Squat arrière, 3 séries de 4, repos 2 minutes.";
const SLOT = "Saut du dragon fictif";
const WITH_SLOT = `Demain, Squat arrière, 3 séries de 4, puis ${SLOT}, 3 séries de 5.`;

test("tout reconnu : un champ, un clic, ce qui a été compris, la séance dans le constructeur, un brouillon", async ({
  page,
}) => {
  const a = await setup(page);
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/planificateur");
    // Un seul champ : ni carte de mode, ni case à cocher, ni durée ou niveau à choisir d'abord.
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByText(t.beta, { exact: true })).toBeVisible();
    // Trois exemples montrent les trois usages ; en prendre un remplit le champ.
    for (const example of t.examples) await expect(page.getByText(example.text, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: `${t.examples[1].kind} ${t.examples[1].text}`, exact: true }).click();
    await expect(field(page)).toHaveValue(t.examples[1].text);
    await expect(field(page)).toBeFocused();
    await shots(page, "demande-exemple");
    await field(page).fill("");
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await expectNoMotion(page);
    await shots(page, "demande-vide");
    // Clavier seul : le champ, puis Entrée sur le bouton.
    await field(page).focus();
    await page.keyboard.type(SQUAT);
    const streamed = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/v1/orgs/${a.orgId}/planner`) &&
        (response.headers()["content-type"] ?? "").includes("text/event-stream"),
    );
    const submit = page.getByRole("button", { name: t.prepare, exact: true });
    await expect(submit).toBeEnabled();
    await submit.focus();
    await page.keyboard.press("Enter");
    await streamed;
    await expect(page.getByText(t.steps.context, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: t.sessionTitle, exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/proposition=/);
    // La demande part sans mode ni brief, et dit ce que cet écran sait afficher.
    const proposal = await proposalOf(a, page);
    expect(proposal.selection).not.toHaveProperty("mode");
    expect(proposal.selection).not.toHaveProperty("brief");
    expect(proposal.slots).toEqual([]);
    // Ce que le planificateur a compris, en tête, puis la séance dans l'éditeur du constructeur.
    await expect(page.getByRole("heading", { name: t.understood, exact: true })).toBeVisible();
    await expect(page.getByText(proposal.understanding!.summary, { exact: true })).toBeVisible();
    await expect(card(page, "Squat arrière")).toBeVisible();
    // Une fiche reconnue ne porte aucune marque.
    await expect(page.getByText(t.toCheck, { exact: false })).toHaveCount(0);
    await expect(page.getByText(t.slot.label, { exact: true })).toHaveCount(0);
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await expectNoMotion(page);
    await shots(page, "seance-reconnue");
    // Une seule action crée le brouillon, sans le publier.
    await createDraft(page);
    const drafts = await sessionsOf(a);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ published_at: null });
    expect(itemsOf(drafts[0]!)).toMatchObject([{ exerciseId: a.squat, prescription: { sets: 3, reps: 8 } }]);
    for (const width of [768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(page);
    }
  } finally {
    await a.sql.end();
  }
});

test("une fiche rapprochée se change en un geste, et le terme est retenu à la demande suivante", async ({ page }) => {
  test.setTimeout(180_000);
  const a = await setup(page);
  const said = "bascule dragon";
  try {
    // Deux fiches portent les mots du terme : aucune ne s'impose, le rapprochement reste à vérifier.
    await a.fiche("Bascule dragon avant");
    await a.fiche("Bascule dragon arrière");
    await request(page, `Demain, ${said}, 3 séries de 8.`);
    await prepare(page);
    const proposal = await proposalOf(a, page);
    const posed = proposal.understanding!.movements[0]!.exercise!.name;
    const other = posed === "Bascule dragon avant" ? "Bascule dragon arrière" : "Bascule dragon avant";
    // La séance est écrite, la fiche posée, et le doute se lit sous l'exercice avec le terme dit.
    await expect(card(page, posed)).toBeVisible();
    await expect(page.getByText(t.probable.said(said), { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: t.probable.confirm, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: t.probable.search, exact: true })).toBeVisible();
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await shots(page, "seance-a-verifier");
    // Un geste : l'autre fiche possible prend la place, sans réponse écrite ni relance.
    await page.getByRole("button", { name: t.probable.use(other), exact: true }).click();
    await expect(page.getByText(t.probable.learned(said, other), { exact: true })).toBeVisible();
    await expect(card(page, other)).toBeVisible();
    await expect(page.getByText(t.probable.said(said), { exact: false })).toHaveCount(0);
    expect((await proposalOf(a, page)).clarificationCount).toBe(0);
    await createDraft(page);
    const other_id = (await a.sql.query("SELECT id FROM exercises WHERE organization_id=$1 AND name=$2", [a.orgId, other]))
      .rows[0].id as string;
    expect(itemsOf((await sessionsOf(a))[0]!)).toMatchObject([{ exerciseId: other_id }]);

    // À la demande suivante, le même terme est reconnu : plus rien à vérifier.
    await request(page, `Demain, ${said}, 3 séries de 8.`);
    await prepare(page);
    await expect(card(page, other)).toBeVisible();
    await expect(page.getByText(t.toCheck, { exact: false })).toHaveCount(0);
    expect((await proposalOf(a, page)).understanding!.movements).toMatchObject([
      { confidence: "exact", exercise: { name: other } },
    ]);

    // « Mes termes » montre ce que l'espace a appris, et permet d'en retirer un.
    await page.goto("/planificateur");
    await page.getByText(t.aliases.title, { exact: true }).click();
    const row = page.getByRole("listitem").filter({ hasText: t.aliases.said(said) });
    await expect(row).toContainText(other);
    await expectAccessible(page);
    await shots(page, "mes-termes");
    await row.getByRole("button", { name: t.aliases.removeFor(said), exact: true }).click();
    await expect(page.getByText(t.aliases.removed(said), { exact: true })).toBeVisible();
    await expect(row).toHaveCount(0);
    expect((await a.api.plannerAliases(a.orgId)).aliases).toEqual([]);
  } finally {
    await a.sql.end();
  }
});

test("un emplacement à compléter : le brouillon attend, la fiche se crée en deux gestes, le brouillon la porte", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const a = await setup(page);
  try {
    await request(page, WITH_SLOT);
    await prepare(page);
    // La séance est écrite ; l'exercice sans fiche est à sa place, avec le terme dit et sa prescription.
    await expect(card(page, "Squat arrière")).toBeVisible();
    const slot = page.locator("#emplacement-slot_1");
    await expect(slot).toContainText(t.slot.name(SLOT));
    await expect(slot).toContainText(t.slot.label);
    await expect(slot).toContainText("3 × 8");
    // Tant qu'il reste, le bouton ne crée pas le brouillon : il dit ce qui manque et y mène.
    await expect(page.getByRole("button", { name: t.create, exact: true })).toHaveCount(0);
    await expect(page.getByText(t.slot.left(1), { exact: true })).toBeVisible();
    await page.getByRole("button", { name: t.complete(1, SLOT), exact: true }).click();
    await expect(page.getByRole("button", { name: t.slot.chooseFor(SLOT), exact: true })).toBeFocused();
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await shots(page, "seance-a-completer");
    // Le serveur refuse lui aussi, même si une fiche est mise à la main à la place de l'emplacement.
    const proposal = await proposalOf(a, page);
    const prepared = await a.api.preparePlannerDrafts(a.orgId, proposal.id, proposal.version);
    const forced = prepared.sessions.map((session) => ({
      ...session,
      draft: {
        ...session.draft,
        blocks: session.draft.blocks.map((block) => ({
          ...block,
          items: block.items.map((item) =>
            item.exerciseId === PLANNER_SLOT_EXERCISE_ID ? { ...item, exerciseId: a.squat } : item,
          ),
        })),
      },
    }));
    const refused = await a.api
      .confirmPlannerProposal(a.orgId, proposal.id, { expectedVersion: proposal.version, confirmed: true, sessions: forced })
      .catch((cause: unknown) => cause);
    expect(refused).toBeInstanceOf(ApiError);
    expect(refused).toMatchObject({ status: 409, code: "planner_slots_open" });
    expect(await sessionsOf(a)).toHaveLength(0);

    // Premier geste : créer la fiche. Son nom, sa famille et sa charge sont déjà proposés.
    await page.getByRole("button", { name: t.slot.createFor(SLOT), exact: true }).click();
    const dialog = page.getByRole("dialog", { name: t.slot.createTitle(SLOT), exact: true });
    await expect(dialog.getByLabel(m.exercises.name, { exact: true })).toHaveValue(SLOT);
    await expect(dialog.getByRole("radio", { name: m.exerciseCategory.strength, exact: true })).toBeChecked();
    await expect(dialog.getByRole("radio", { name: f.quick.loadKinds.bodyweight, exact: true })).toBeChecked();
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await shots(page, "emplacement-creation");
    // Second geste : créer et utiliser. La séance se met à jour seule.
    await dialog.getByRole("button", { name: f.quick.submit, exact: true }).click();
    await expect(page.getByText(t.slot.filled(SLOT, SLOT), { exact: true })).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(slot).toHaveCount(0);
    await expect(card(page, SLOT)).toBeVisible();
    expect((await proposalOf(a, page)).clarificationCount).toBe(0);
    await createDraft(page);
    const created = await a.sql.query(
      "SELECT id FROM exercises WHERE organization_id=$1 AND name=$2 AND catalog_key IS NULL",
      [a.orgId, SLOT],
    );
    expect(created.rows).toHaveLength(1);
    expect(itemsOf((await sessionsOf(a))[0]!)).toMatchObject([
      { exerciseId: a.squat },
      { exerciseId: created.rows[0].id, prescription: { sets: 3, reps: 8 } },
    ]);
  } finally {
    await a.sql.end();
  }
});

test("un emplacement se complète par une fiche de la bibliothèque, ou se retire, sans perdre une retouche", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const a = await setup(page);
  try {
    const fiche = await a.fiche("Bond du dragon maison");
    await request(page, WITH_SLOT);
    await prepare(page);
    // Le coach retouche d'abord le squat à la main : douze répétitions.
    await retouch(page, "Squat arrière", m.builder.reps, "12");
    await expect(card(page, "Squat arrière")).toContainText("3 × 12");
    // Choisir une fiche : la recherche part du terme dit, dans toute la bibliothèque.
    await page.getByRole("button", { name: t.slot.chooseFor(SLOT), exact: true }).click();
    const dialog = page.getByRole("dialog", { name: t.slot.title(SLOT), exact: true });
    const search = dialog.getByPlaceholder(m.exercises.search);
    await expect(search).toHaveValue(SLOT);
    await expectAccessible(page);
    await shots(page, "emplacement-choisir");
    await search.fill("Bond du dragon");
    await dialog.getByRole("button", { name: t.slot.pick(fiche.name), exact: true }).click();
    await expect(page.getByText(t.slot.filled(SLOT, fiche.name), { exact: true })).toBeVisible();
    await expect(page.locator("#emplacement-slot_1")).toHaveCount(0);
    await expect(card(page, fiche.name)).toBeVisible();
    // La retouche est restée : rien n'a été rechargé.
    await expect(card(page, "Squat arrière")).toContainText("3 × 12");
    await createDraft(page);
    expect(itemsOf((await sessionsOf(a))[0]!)).toMatchObject([
      { exerciseId: a.squat, prescription: { reps: 12 } },
      { exerciseId: fiche.id },
    ]);

    // Retirer : l'exercice quitte la séance, le reste garde ce que le coach a changé. Le premier terme est
    // désormais retenu par l'espace : c'est un autre mouvement inconnu qui attend sa fiche.
    const other = "Roulade du tigre fictive";
    await request(page, `Demain, Squat arrière, 3 séries de 4, puis ${other}, 3 séries de 5.`);
    await prepare(page);
    await retouch(page, "Squat arrière", m.builder.reps, "10");
    await page.getByRole("button", { name: t.slot.removeFor(other), exact: true }).click();
    await expect(page.getByText(t.slot.removed(other), { exact: true })).toBeVisible();
    await expect(page.locator("#emplacement-slot_1")).toHaveCount(0);
    await expect(page.getByRole("button", { name: t.create, exact: true })).toBeEnabled();
    await expect(card(page, "Squat arrière")).toContainText("3 × 10");
    await createDraft(page);
    expect(itemsOf((await sessionsOf(a))[1]!)).toMatchObject([{ exerciseId: a.squat, prescription: { reps: 10 } }]);
    expect(itemsOf((await sessionsOf(a))[1]!)).toHaveLength(1);
  } finally {
    await a.sql.end();
  }
});

test("remplacer par une fiche hors de la proposition, puis ajuster sans perdre une retouche manuelle", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const a = await setup(page);
  try {
    await request(page, SQUAT);
    await prepare(page);
    // Une fiche créée après la demande : elle n'était pas dans la bibliothèque figée de la proposition.
    const later = await a.fiche("Presse à cuisses créée après");
    expect((await proposalOf(a, page)).exercises.some((exercise) => exercise.id === later.id)).toBe(false);
    await card(page, "Squat arrière").click();
    await page.getByRole("button", { name: t.replace.action, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: t.replace.title("Squat arrière"), exact: true });
    await dialog.getByPlaceholder(m.exercises.search).fill("Presse à cuisses créée");
    await expectAccessible(page);
    await shots(page, "remplacer");
    await dialog.getByRole("button", { name: t.replace.pick(later.name), exact: true }).click();
    await expect(page.getByText(t.replace.done(later.name), { exact: true })).toBeVisible();
    await expect(card(page, later.name)).toBeVisible();
    // Une retouche à la main, puis un ajustement : il part de la séance à l'écran.
    await page.getByLabel(m.builder.reps, { exact: true }).fill("12");
    await expect(card(page, later.name)).toContainText("3 × 12");
    await page.getByText(t.adjust, { exact: true }).click();
    await page.getByRole("textbox", { name: t.adjustLabel, exact: true }).fill("Passe à quatre séries.");
    await expectAccessible(page);
    await page.getByRole("button", { name: t.adjustSend, exact: true }).click();
    await expect(page.getByText(t.adjustCount(1, 5), { exact: true })).toBeVisible({ timeout: 30_000 });
    // Quatre séries, comme demandé ; la fiche choisie et les douze répétitions sont restées.
    await expect(card(page, later.name)).toContainText("4 × 12");
    await shots(page, "seance-ajustee");
    await createDraft(page);
    expect(itemsOf((await sessionsOf(a))[0]!)).toMatchObject([
      { exerciseId: later.id, prescription: { sets: 4, reps: 12 } },
    ]);
  } finally {
    await a.sql.end();
  }
});

test("un objectif seul, avec des précisions facultatives : la séance est composée, datée et placée par le serveur", async ({
  page,
}) => {
  const a = await setup(page);
  try {
    await request(page, "Préparation physique générale.");
    // Les précisions sont repliées et facultatives : ici une heure et une durée.
    await page.getByText(t.precise, { exact: false }).first().click();
    await page.getByLabel(t.time, { exact: true }).fill("07:30");
    await page.getByRole("button", { name: t.durationValue(30), exact: true }).click();
    // Le matériel du profil de l'espace est déjà coché.
    await expect(page.getByRole("button", { name: m.trainingProfile.equipment.cones, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("button", { name: m.trainingProfile.equipment.barbell, exact: true })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await shots(page, "demande-precisions");
    await prepare(page);
    const proposal = await proposalOf(a, page);
    expect(proposal.selection).not.toHaveProperty("mode");
    expect(proposal.selection).not.toHaveProperty("brief");
    expect(proposal.understanding!.intent).toBe("objective");
    expect(proposal.interpretation!.sessions[0]!).toMatchObject({
      date: today(),
      targetTokens: ["group_1"],
      durationMin: 30,
    });
    await page.getByText(t.editSchedule, { exact: true }).click();
    await expect(page.getByLabel(m.builder.time, { exact: true })).toHaveValue("07:30");
    await createDraft(page);
    expect((await sessionsOf(a))[0]).toMatchObject({ start_time: "07:30", published_at: null });
  } finally {
    await a.sql.end();
  }
});

test("un circuit décrit par son objectif arrive dans l'éditeur de séquence", async ({ page }) => {
  const a = await setup(page);
  try {
    await request(page, "Demain, circuit trois tours : 8 répétitions par exercice, 60 secondes entre les tours.");
    await prepare(page);
    await expect(page.getByLabel(t.blockName, { exact: true })).toHaveValue("Circuit");
    await expect(page.getByLabel(m.builder.sequence.rounds, { exact: true })).toHaveValue("3");
    await page.getByLabel(t.blockName, { exact: true }).fill("Circuit du jour");
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await createDraft(page);
    expect((await sessionsOf(a))[0]).toMatchObject({ published_at: null });
  } finally {
    await a.sql.end();
  }
});

test("une panne du prestataire se lit, dit quoi faire et ne décompte rien", async ({ page }) => {
  const a = await setup(page);
  try {
    await request(page, "Demain, squat 3 × 5. #panne-saturated");
    await expect(page.getByText(t.quota(30), { exact: true })).toBeVisible();
    await page.getByRole("button", { name: t.prepare, exact: true }).click();
    const alert = page.getByRole("alert").filter({ hasText: m.aiPlanner.failures.saturated });
    await expect(alert).toBeVisible({ timeout: 30_000 });
    // La panne dit aussi à quelle étape elle est survenue.
    await expect(alert).toContainText(t.failedAt("understand"));
    await shots(page, "panne");
    await page.reload();
    await expect(page.getByText(m.aiPlanner.failures.saturated, { exact: true })).toBeVisible();
    await expect(page.getByText(t.quota(30), { exact: true })).toBeVisible();
    const operation = await a.sql.query(
      "SELECT state, failure_code FROM ai_planner_operations WHERE organization_id=$1",
      [a.orgId],
    );
    expect(operation.rows).toEqual([{ state: "refunded", failure_code: "saturated" }]);
    await expectAccessible(page);
  } finally {
    await a.sql.end();
  }
});

test("les charges par athlète : l'aperçu reste ouvert et se met à jour à chaque retouche, puis le brouillon", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const a = await setup(page);
  try {
    const [first, second] = await athletes(a);
    await reference(a, first!, 100);
    await request(page, "Demain, Squat arrière, 3 séries de 4 à 80 %, repos 2 minutes.");
    await prepare(page);
    // Un pourcentage se convertit pour chacun : l'aperçu est exigé avant la création.
    await expect(page.getByText(t.loads.needed, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: t.create, exact: true })).toBeDisabled();
    const opener = page.getByRole("button", { name: t.loads.open, exact: true });
    await opener.click();
    await expect(page.getByText(t.loads.coverage(1, 2, 2), { exact: true })).toBeVisible();
    const rows = page.getByRole("group", { name: t.loads.rows, exact: true });
    const one = rows.getByRole("button", { name: /^Athlète 1 Fictif / });
    const two = rows.getByRole("button", { name: /^Athlète 2 Fictif / });
    await expect(two).toHaveAccessibleName(`Athlète 2 Fictif ${t.loads.rowSummary(1, 1, 0)}`);
    await one.click();
    // Le prestataire simulé propose 3 × 8 ; la référence de 100 kg donne 80 kg à 80 %.
    await expect(rows.getByText(/3 × 8 rép.*80 kg/).first()).toBeVisible();
    // Une retouche de la séance : l'aperçu ne se referme pas, l'athlète ouvert reste ouvert, la charge suit.
    await retouch(page, "Squat arrière", m.builder.sets, "5");
    await expect(opener).toHaveAttribute("aria-expanded", "true");
    await expect(one).toHaveAttribute("aria-expanded", "true");
    await expect(rows.getByText(/5 × 8 rép.*80 kg/).first()).toBeVisible();
    await expectAccessible(page);
    await shots(page, "charges-ouvertes");
    await two.click();
    await expect(rows.getByText(t.loads.undefined, { exact: false }).first()).toBeVisible();
    await rows.getByRole("button", { name: t.loads.adapt, exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: t.loads.adapt, exact: true });
    await dialog.getByLabel(m.nativeBuilder.unit, { exact: true }).selectOption("kg");
    await dialog.getByLabel(m.builder.load, { exact: true }).fill("35");
    await dialog.getByRole("button", { name: m.nativeBuilder.apply, exact: true }).click();
    await expect(two).toHaveAccessibleName(`Athlète 2 Fictif ${t.loads.rowSummary(1, 0, 1)}`);
    await expect(opener).toHaveAttribute("aria-expanded", "true");
    await expectAccessible(page);
    await createDraft(page);
    const overrides = await a.sql.query(
      "SELECT o.athlete_id, o.prescription FROM athlete_overrides o JOIN scheduled_sessions s ON s.id=o.scheduled_session_id WHERE s.organization_id=$1",
      [a.orgId],
    );
    expect(overrides.rows).toEqual([{ athlete_id: second, prescription: { load: { type: "kg", value: 35 } } }]);
    const [session] = await sessionsOf(a);
    expect(itemsOf(session!)[0]!.prescription).toMatchObject({ sets: 5, load: { type: "pct_1rm", value: 80 } });
  } finally {
    await a.sql.end();
  }
});

test("la dictée par le bouton du champ : sans case à cocher, annulation, transcription, correction avant l'envoi", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const streams: MediaStream[] = [];
    (window as unknown as { audioTestStreams: MediaStream[] }).audioTestStreams = streams;
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      streams.push(stream);
      return stream;
    };
  });
  const a = await setup(page);
  let uploads = 0;
  const released = () =>
    page.evaluate(() =>
      (window as unknown as { audioTestStreams: MediaStream[] }).audioTestStreams.every((s) =>
        s.getTracks().every((track) => track.readyState === "ended"),
      ),
    );
  try {
    // Seule la transcription d'OpenAI est simulée : le serveur lit réellement l'audio envoyé, puis s'arrête sans clé.
    await page.route(`**/api/v1/orgs/${a.orgId}/planner/transcriptions`, async (route) => {
      uploads++;
      const bytes = route.request().postDataBuffer()!;
      const contentType = route.request().headers()["content-type"]!;
      const form = await new Request(route.request().url(), {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: new Uint8Array(bytes),
      }).formData();
      expect((form.get("audio") as File).size).toBeGreaterThan(100);
      const metadata = JSON.parse(String(form.get("metadata")));
      // L'accord, donné une fois avec celui du planificateur, part toujours avec l'audio.
      expect(metadata.audioProcessingAccepted).toBe(true);
      const inspected = await page.request.post(route.request().url(), {
        headers: { "Content-Type": contentType },
        data: bytes,
      });
      expect(inspected.status()).toBe(502);
      await route.fulfill({
        status: 200,
        json: {
          id: metadata.id,
          version: 2,
          state: "ready",
          text: "Demain, Squat arrière : trois séries de quatre à quarante kilos.",
          audioSeconds: 2,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      });
    });
    await page.goto(`/planificateur?groupe=${a.group}`);
    await expect(page.getByRole("button", { name: GROUP, exact: true })).toHaveAttribute("aria-pressed", "true");
    // Le micro est dans le champ, et aucune case n'est à cocher avant de parler.
    const mic = page.getByRole("button", { name: t.dictation.start, exact: true });
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await mic.click();
    await expect(page.getByText(/Enregistrement : 0 min 0[1-9] s/)).toBeVisible();
    await expectAccessible(page);
    await shots(page, "dictee-en-cours");
    await page.getByRole("button", { name: t.dictation.cancel, exact: true }).click();
    expect(uploads).toBe(0);
    await expect.poll(released).toBe(true);
    await mic.click();
    await expect(page.getByText(/Enregistrement : 0 min 0[1-9] s/)).toBeVisible();
    await page.getByRole("button", { name: t.dictation.stop, exact: true }).click();
    await expect(field(page)).toHaveValue("Demain, Squat arrière : trois séries de quatre à quarante kilos.");
    await expect(page.getByText(t.dictation.ready, { exact: true })).toBeVisible();
    expect(uploads).toBe(1);
    await expect.poll(released).toBe(true);
    // Le coach corrige la transcription : c'est son texte relu qui part, pas celui de la dictée.
    await field(page).fill("Demain, Squat arrière : trois séries de quatre à cinquante kilos.");
    await prepare(page);
    expect((await proposalOf(a, page)).messages).toEqual([
      "Demain, Squat arrière : trois séries de quatre à cinquante kilos.",
    ]);
    expect((await a.api.plannerUsage(a.orgId)).used.audioSeconds).toBe(0);
  } finally {
    await a.sql.end();
  }
});

test("un % 1RM proposé n'existe que si chaque destinataire a sa référence de force", async ({ page }) => {
  test.setTimeout(180_000);
  const a = await setup(page);
  try {
    await a.sql.query("UPDATE organizations SET available_equipment='{barbell,rack,bodyweight}' WHERE id=$1", [
      a.orgId,
    ]);
    const [first, second] = await athletes(a);
    await reference(a, first!, 100);
    const propose = async () => {
      await request(page, "Squat arrière à 80 % du maximum.");
      await prepare(page);
    };
    // Une référence manque : le pourcentage ne serait résolu pour personne, il est retiré.
    await propose();
    await expect(page.getByText(t.loads.needed, { exact: true })).toHaveCount(0);
    await createDraft(page);
    expect(itemsOf((await sessionsOf(a))[0]!)[0]!.prescription).not.toHaveProperty("load");
    // Chaque destinataire a sa référence : le pourcentage reste, Tartan le convertit pour chacun.
    await reference(a, second!, 90);
    await propose();
    await expect(page.getByText(t.loads.needed, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: t.loads.open, exact: true }).click();
    await expect(page.getByText(t.loads.coverage(1, 2, 2), { exact: true })).toBeVisible();
    await createDraft(page);
    expect(itemsOf((await sessionsOf(a))[1]!)[0]!.prescription.load).toMatchObject({ type: "pct_1rm", value: 80 });
  } finally {
    await a.sql.end();
  }
});

test("le planificateur s'ouvre là où une séance se crée, avec le jour et le groupe déjà choisis", async ({ page }) => {
  const a = await setup(page);
  try {
    // Depuis une nouvelle séance : l'autre façon de commencer, visible sans défiler.
    await page.goto(`/seances/nouvelle?date=${today()}&groupe=${a.group}`, { waitUntil: "networkidle" });
    const entry = page.getByRole("link", { name: t.entry.withPlanner, exact: true });
    await expect(entry).toBeInViewport();
    await expectAccessible(page);
    await shots(page, "acces-nouvelle-seance");
    await entry.click();
    await expect(page).toHaveURL(new RegExp(`/planificateur\\?date=${today()}&groupe=${a.group}`));
    await expect(page.getByRole("button", { name: GROUP, exact: true })).toHaveAttribute("aria-pressed", "true");
    // Depuis le calendrier, à côté de « Nouvelle séance », sur téléphone comme sur ordinateur.
    await page.goto("/calendrier", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: m.aiPlanner.title, exact: true })).toBeInViewport();
    await shots(page, "acces-calendrier");
    // Dans « Pour démarrer », l'étape de création propose le planificateur.
    await page.goto("/premiers-pas", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("link", { name: w.onboarding.guide.steps.create.planner, exact: true }),
    ).toHaveAttribute("href", "/planificateur");
  } finally {
    await a.sql.end();
  }
});
