import { expect, test, type Locator, type Page } from "@playwright/test";
import { motion } from "@tartan/design-tokens";
import { addDays, startOfWeek } from "@tartan/domain";
import { capitalize, formatDateLong, m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import {
  createCoachSpace,
  expectAccessible,
  expectNoHorizontalScroll,
  expectNoMotion,
  signUp,
  uniqueEmail,
} from "./helpers";
import { today } from "./journeys";
import { setOffre } from "./personas";

const t = w.planning;
const TITLE = "Force bas du corps";
const OTHER = "Gainage du soir";

// Une semaine et un mois fixes par rapport à aujourd'hui : la source et la destination tiennent dans l'écran.
const week = startOfWeek(today());
const monday = week;
const thursday = addDays(week, 3);
const month = today().slice(0, 7);
const tenth = `${month}-10`;
const seventeenth = `${month}-17`;

type Space = { root: string; groupId: string; exerciseId: string };

const openSpace = async (page: Page, name: string): Promise<Space> => {
  await createCoachSpace(page, name);
  const me = await (await page.request.get("/api/v1/me")).json();
  const root = `/api/v1/orgs/${me.spaces[0].organizationId}`;
  const groups = await (await page.request.get(`${root}/groups`)).json();
  const exercises = await (await page.request.get(`${root}/exercises`)).json();
  const exercise = exercises.find((item: { category: string }) => item.category === "strength");
  return { root, groupId: groups[0].id, exerciseId: exercise.id };
};

const schedule = async (page: Page, space: Space, title: string, date: string, startTime: string) => {
  const created = await page.request.post(`${space.root}/sessions`, {
    data: {
      date,
      startTime,
      location: "Stade",
      publishAt: null,
      assignments: [{ targetType: "group", targetId: space.groupId }],
      overrides: [],
      draft: {
        title,
        type: "strength",
        durationMin: 60,
        coachNote: null,
        blocks: [
          {
            name: "Corps",
            variant: "club",
            items: [{ exerciseId: space.exerciseId, prescription: { sets: 4, reps: 5 } }],
          },
        ],
      },
    },
  });
  expect(created.ok()).toBe(true);
  return ((await created.json()) as { id: string }).id;
};

// La date que le serveur a retenue : la preuve que le déplacement n'est pas resté à l'écran.
const savedDate = async (page: Page, space: Space, id: string) => {
  // La semaine en cours et le mois en cours, dans la période que l'API accepte.
  const from = addDays(`${month}-01`, -7);
  const response = await page.request.get(`${space.root}/calendar?from=${from}&to=${addDays(from, 45)}`);
  expect(response.ok()).toBe(true);
  const calendar = await response.json();
  return (calendar.sessions as { id: string; date: string }[]).find((session) => session.id === id)?.date;
};

const card = (page: Page, id: string) => page.locator(`[data-plan-card="${id}"]`).locator("visible=true");
const day = (page: Page, date: string) => page.locator(`[data-plan-day="${date}"]`).locator("visible=true");
const ghost = (page: Page) => page.locator("[data-plan-ghost]");

// La barre de navigation fixée en bas couvre le bas de l'écran, et la page défile près des bords pendant un
// glisser : la source et la destination sont centrées ensemble, puis les deux points sont lus sans plus défiler.
const settle = async (page: Page, source: Locator, target: Locator) => {
  const top = async (locator: Locator) => locator.evaluate((element) => element.getBoundingClientRect().top + scrollY);
  const middle = ((await top(source)) + (await top(target))) / 2;
  await page.evaluate((y) => window.scrollTo({ top: y - innerHeight / 2 + 40, behavior: "instant" }), middle);
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  const height = page.viewportSize()!.height;
  const points = {
    from: { x: from.x + 16, y: from.y + 12 },
    to: { x: to.x + to.width / 2, y: to.y + Math.min(to.height / 2, 60) },
  };
  for (const point of [points.from, points.to]) {
    expect(point.y, "hors des bandes qui font défiler la page").toBeGreaterThan(120);
    expect(point.y, "hors des bandes qui font défiler la page").toBeLessThan(height - 120);
  }
  return points;
};

type Point = { x: number; y: number };
const steps = (from: Point, to: Point, count = 8) =>
  Array.from({ length: count }, (_, index) => ({
    x: from.x + ((to.x - from.x) * (index + 1)) / count,
    y: from.y + ((to.y - from.y) * (index + 1)) / count,
  }));

// Un vrai doigt, par le protocole du navigateur : les événements passent par le même chemin qu'un téléphone.
const finger = async (page: Page) => {
  const client = await page.context().newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd", point?: Point) =>
    client.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: point ? [{ x: Math.round(point.x), y: Math.round(point.y) }] : [],
    });
  return {
    down: (point: Point) => send("touchStart", point),
    move: (point: Point) => send("touchMove", point),
    up: () => send("touchEnd"),
    // L'appui long : le doigt posé, immobile, le temps que la carte se laisse saisir.
    hold: async (point: Point) => {
      await send("touchStart", point);
      await expect(ghost(page)).toBeVisible();
    },
    slide: async (from: Point, to: Point) => {
      for (const point of steps(from, to)) await send("touchMove", point);
    },
  };
};

// Saisit la carte et l'amène au-dessus du jour visé, à la souris ou au doigt selon le projet.
const dragOver = async (page: Page, mobile: boolean, source: Locator, target: Locator) => {
  const { from, to } = await settle(page, source, target);
  if (mobile) {
    const touch = await finger(page);
    await touch.hold(from);
    await touch.slide(from, to);
    return { drop: () => touch.up() };
  }
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  return { drop: () => page.mouse.up() };
};

// Chaque trajet animé que la page lance sur une carte, avec sa durée et sa courbe.
type Landing = { card?: string; duration?: number; easing?: string };
const recordLandings = (page: Page) =>
  page.evaluate(() => {
    const log: Landing[] = [];
    (window as unknown as { __landings: Landing[] }).__landings = log;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const timing = typeof options === "object" ? options : {};
      log.push({
        card: (this as HTMLElement).dataset.planCard,
        duration: Number(timing.duration),
        easing: timing.easing,
      });
      return animate.call(this, keyframes, options);
    };
  });
const landings = (page: Page) => page.evaluate(() => (window as unknown as { __landings: Landing[] }).__landings);

// Les jours par lesquels la carte passe à l'écran : un retour furtif à l'ancienne date s'y verrait.
const followCard = (page: Page, id: string) =>
  page.evaluate((cardId) => {
    const trail: string[] = [];
    (window as unknown as { __trail: string[] }).__trail = trail;
    const note = () => {
      const shown = [...document.querySelectorAll<HTMLElement>(`[data-plan-card="${cardId}"]`)].find(
        (element) => element.offsetParent !== null,
      );
      const date = shown?.dataset.planDate;
      if (date && trail.at(-1) !== date) trail.push(date);
    };
    note();
    new MutationObserver(note).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-plan-date"],
    });
  }, id);
const trail = (page: Page) => page.evaluate(() => (window as unknown as { __trail: string[] }).__trail);
const announced = (page: Page) => page.locator("p.sr-only[aria-live=polite]");

test("glisser une séance en vue Semaine : la colonne s'éclaire, la carte se pose, la date change", async ({
  page,
}, info) => {
  const mobile = info.project.name === "mobile";
  if (!mobile) await page.setViewportSize({ width: 1440, height: 900 });
  const space = await openSpace(page, "Glisser semaine");
  const id = await schedule(page, space, TITLE, monday, "18:00");
  await schedule(page, space, OTHER, thursday, "20:00");
  await page.goto(`/calendrier?semaine=${week}`, { waitUntil: "networkidle" });
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await recordLandings(page);
  await followCard(page, id);

  const source = card(page, id);
  const target = day(page, thursday);
  const drag = await dragOver(page, mobile, source, target);

  // Pendant le glisser : la source atténuée dans son cadre, l'aperçu qui dit où il va, la colonne éclairée,
  // et le repère devant la séance de 20 h, là où celle de 18 h se rangera.
  await expect(source).toHaveAttribute("data-plan-held", "");
  await expect(source).toHaveCSS("border-top-style", "dashed");
  await expect(ghost(page)).toContainText(TITLE);
  await expect(ghost(page)).toContainText(capitalize(formatDateLong(thursday)));
  await expect(target).toHaveAttribute("data-drop", "open");
  await expect(target).toHaveCSS("outline-style", "dashed");
  await expect(page.locator("[data-drop]")).toHaveCount(1);
  const marker = target.locator("[data-plan-marker]");
  await expect(marker).toBeVisible();
  const markerBox = (await marker.boundingBox())!;
  const laterBox = (await target.getByRole("article").boundingBox())!;
  expect(markerBox.y).toBeLessThan(laterBox.y);
  await expect(announced(page)).toHaveText(t.grabbed(TITLE));
  await expectNoHorizontalScroll(page);

  await drag.drop();
  // Au dépôt : la carte est dans sa nouvelle colonne tout de suite, devant la séance de 20 h.
  await expect(ghost(page)).toHaveCount(0);
  await expect(target.locator(`[data-plan-card="${id}"]`)).toBeVisible();
  await expect(target.getByRole("article").first()).toContainText(TITLE);
  await expect(announced(page)).toHaveText(t.moved(TITLE, formatDateLong(thursday)));
  expect(await landings(page)).toEqual([
    { card: id, duration: motion.duration.enter, easing: motion.easing.reception },
  ]);
  expect(motion.duration.enter).toBeLessThanOrEqual(260);
  await expect.poll(() => savedDate(page, space, id)).toBe(thursday);
  // La date a changé une seule fois : la carte n'est pas repassée par lundi en attendant le serveur.
  await page.waitForLoadState("networkidle");
  expect(await trail(page)).toEqual([monday, thursday]);

  // Le clic qui suit le glisser n'a pas ouvert la séance, et la page rechargée dit la même chose.
  await expect(page).toHaveURL(new RegExp(`semaine=${week}$`));
  await page.reload({ waitUntil: "networkidle" });
  await expect(day(page, thursday).locator(`[data-plan-card="${id}"]`)).toBeVisible();
  await expectAccessible(page);
});

test("glisser une séance en vue Mois, à la souris comme au doigt", async ({ page }, info) => {
  const mobile = info.project.name === "mobile";
  if (!mobile) await page.setViewportSize({ width: 1440, height: 900 });
  const space = await openSpace(page, "Glisser mois");
  const id = await schedule(page, space, TITLE, tenth, "18:00");
  await page.goto(`/calendrier?vue=mois&mois=${month}`, { waitUntil: "networkidle" });
  // Sur téléphone, la séance se saisit dans la liste du jour, sous la grille.
  if (mobile) await day(page, tenth).click();
  await expectAccessible(page);
  await recordLandings(page);

  const source = card(page, id);
  const target = day(page, seventeenth);
  const drag = await dragOver(page, mobile, source, target);
  await expect(source).toHaveAttribute("data-plan-held", "");
  await expect(target).toHaveAttribute("data-drop", "open");
  await expect(target).toHaveCSS("outline-style", "dashed");
  await expect(target.locator("[data-plan-marker]")).toBeVisible();
  await expect(ghost(page)).toContainText(capitalize(formatDateLong(seventeenth)));
  // L'aperçu ne recouvre pas la case visée : on voit où l'on dépose.
  const cell = (await target.boundingBox())!;
  const preview = (await ghost(page).boundingBox())!;
  const covered =
    Math.max(0, Math.min(cell.x + cell.width, preview.x + preview.width) - Math.max(cell.x, preview.x)) *
    Math.max(0, Math.min(cell.y + cell.height, preview.y + preview.height) - Math.max(cell.y, preview.y));
  expect(covered / (cell.width * cell.height)).toBeLessThan(0.5);

  await drag.drop();
  await expect(ghost(page)).toHaveCount(0);
  if (mobile) {
    // La liste suit la séance : elle ouvre le jour où elle vient de se poser.
    await expect(target).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: capitalize(formatDateLong(seventeenth)) })).toBeVisible();
    await expect(card(page, id)).toHaveAttribute("data-plan-date", seventeenth);
  } else await expect(target.locator(`[data-plan-card="${id}"]`)).toBeVisible();
  expect(await landings(page)).toEqual([
    { card: id, duration: motion.duration.enter, easing: motion.easing.reception },
  ]);
  await expect.poll(() => savedDate(page, space, id)).toBe(seventeenth);
  await expect(page).toHaveURL(new RegExp(`mois=${month}$`));
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test("au clavier, en vue Mois : « Déplacer » ouvre une date, et le focus suit la séance", async ({ page }, info) => {
  const mobile = info.project.name === "mobile";
  if (!mobile) await page.setViewportSize({ width: 1440, height: 900 });
  const space = await openSpace(page, "Clavier mois");
  const id = await schedule(page, space, TITLE, tenth, "18:00");
  await page.goto(`/calendrier?vue=mois&mois=${month}`, { waitUntil: "networkidle" });
  if (mobile) {
    await day(page, tenth).focus();
    await page.keyboard.press("Enter");
  }
  const actions = page.getByRole("button", { name: t.actions(TITLE), exact: true }).locator("visible=true");
  await actions.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: t.moveItem, exact: true })).toBeFocused();
  await expect(page.getByRole("menuitem", { name: t.duplicateItem, exact: true })).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: t.moveTitle });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(m.builder.date, { exact: true }).fill(seventeenth);
  await expectAccessible(page);
  await dialog.getByRole("button", { name: t.moveSubmit, exact: true }).focus();
  await page.keyboard.press("Enter");

  await expect(dialog).toBeHidden();
  await expect(card(page, id)).toHaveAttribute("data-plan-date", seventeenth);
  if (mobile) await expect(day(page, seventeenth)).toHaveAttribute("aria-pressed", "true");
  else await expect(day(page, seventeenth).locator(`[data-plan-card="${id}"]`)).toBeVisible();
  await expect(announced(page)).toHaveText(t.moved(TITLE, formatDateLong(seventeenth)));
  // Le bouton qui a ouvert le dialogue a changé de jour avec la séance : le focus l'y retrouve.
  await expect(actions).toBeFocused();
  await expect.poll(() => savedDate(page, space, id)).toBe(seventeenth);

  // « Dupliquer » passe par le même menu.
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: t.duplicateItem, exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  const copy = page.getByRole("dialog", { name: m.calendar.duplicate });
  await copy.getByLabel(m.builder.date, { exact: true }).fill(tenth);
  await copy.getByRole("button", { name: m.calendar.duplicate, exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(m.calendar.duplicated)).toBeVisible();
  // La copie est au 10, l'originale reste au 17.
  if (mobile) await expect(day(page, tenth)).toHaveAccessibleName(new RegExp(m.calendar.dayCount(1)));
  else await expect(day(page, tenth).locator("[data-plan-card]")).toHaveCount(1);
  expect(await savedDate(page, space, id)).toBe(seventeenth);
});

test("si le serveur refuse, la carte revient à sa place avec un message", async ({ page }, info) => {
  const mobile = info.project.name === "mobile";
  if (!mobile) await page.setViewportSize({ width: 1440, height: 900 });
  const space = await openSpace(page, "Refus serveur");
  const id = await schedule(page, space, TITLE, monday, "18:00");
  await page.goto(`/calendrier?semaine=${week}`, { waitUntil: "networkidle" });
  await recordLandings(page);
  await followCard(page, id);
  // Le serveur tombe au moment du déplacement, après un délai : la date a déjà changé à l'écran.
  let refused = 0;
  await page.route("**/calendrier**", async (route) => {
    const request = route.request();
    if (request.method() !== "POST" || !request.headers()["next-action"]) return route.fallback();
    refused += 1;
    await new Promise((resolve) => setTimeout(resolve, 700));
    return route.fulfill({ status: 500, contentType: "text/plain", body: "panne" });
  });

  const drag = await dragOver(page, mobile, card(page, id), day(page, thursday));
  await drag.drop();
  await expect(day(page, thursday).locator(`[data-plan-card="${id}"]`)).toBeVisible();

  await expect(page.getByRole("alert").filter({ hasText: t.moveFailed(TITLE, formatDateLong(monday)) })).toBeVisible();
  await expect(day(page, monday).locator(`[data-plan-card="${id}"]`)).toBeVisible();
  await expect(day(page, thursday).locator(`[data-plan-card="${id}"]`)).toHaveCount(0);
  expect(refused).toBe(1);
  expect(await trail(page)).toEqual([monday, thursday, monday]);
  // Deux trajets : la pose, puis le retour, avec la même courbe.
  expect(await landings(page)).toEqual([
    { card: id, duration: motion.duration.enter, easing: motion.easing.reception },
    { card: id, duration: motion.duration.enter, easing: motion.easing.reception },
  ]);
  expect(await savedDate(page, space, id)).toBe(monday);
  await expectAccessible(page);
});

test("au doigt : le défilement ne saisit rien, l'appui long saisit, le bord fait défiler", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "le toucher se joue sur le projet téléphone");
  const space = await openSpace(page, "Doigt");
  const id = await schedule(page, space, TITLE, monday, "18:00");
  for (const offset of [1, 2, 3, 4, 5, 6])
    await schedule(page, space, `Séance ${offset}`, addDays(week, offset), "18:00");
  await page.goto(`/calendrier?semaine=${week}`, { waitUntil: "networkidle" });
  const source = card(page, id);
  const { from } = await settle(page, source, day(page, addDays(week, 1)));
  const touch = await finger(page);

  // Un doigt qui part tout de suite fait défiler la page : aucune carte n'est saisie.
  const before = await page.evaluate(() => scrollY);
  await touch.down(from);
  await touch.slide(from, { x: from.x, y: from.y - 160 });
  await expect(ghost(page)).toHaveCount(0);
  // Le doigt s'arrête avant de se lever : la page ne garde pas d'élan, qui emporterait le geste suivant.
  await page.waitForTimeout(300);
  await touch.up();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
  let last = -1;
  await expect
    .poll(async () => {
      const now = await page.evaluate(() => scrollY);
      const still = now === last;
      last = now;
      return still;
    })
    .toBe(true);
  await expect(source).not.toHaveAttribute("data-plan-held", "");
  expect(await savedDate(page, space, id)).toBe(monday);

  // Un appui long saisit la carte ; près du bas de l'écran, la page défile toute seule vers les jours suivants.
  const again = await settle(page, source, day(page, addDays(week, 1)));
  await touch.hold(again.from);
  await expect(source).toHaveAttribute("data-plan-held", "");
  const held = await page.evaluate(() => scrollY);
  // Le point le plus bas où un jour se lit encore sous le doigt : juste au-dessus de la barre de navigation.
  const low = await page.evaluate((x) => {
    for (let y = innerHeight - 20; y > innerHeight - 112; y -= 2)
      if (document.elementFromPoint(x, y)?.closest("[data-plan-day]")) return y - 2;
    return null;
  }, again.from.x);
  expect(low, "la bande de défilement dépasse la barre de navigation").not.toBeNull();
  const edge = { x: again.from.x, y: low! };
  await touch.slide(again.from, edge);
  // La destination se lit sous le doigt immobile, à mesure que la page défile.
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 20_000 }).toBeGreaterThan(held + 80);
  await expect(page.locator("[data-drop=open]")).toHaveCount(1);
  // Le doigt remonte hors de la bande : la page s'arrête, et le jour visé ne change plus.
  const rest = { x: edge.x, y: page.viewportSize()!.height / 2 };
  await touch.slide(edge, rest);
  await expect(page.locator("[data-drop=open]")).toHaveCount(1);
  const reached = await page.locator("[data-drop=open]").getAttribute("data-plan-day");
  expect(reached).not.toBe(monday);
  await touch.up();
  await expect(card(page, id)).toHaveAttribute("data-plan-date", reached!);
  await expect.poll(() => savedDate(page, space, id)).toBe(reached);
});

test("en mouvement réduit, la surbrillance et les pointillés restent, rien ne bouge", async ({ page }, info) => {
  const mobile = info.project.name === "mobile";
  if (!mobile) await page.setViewportSize({ width: 1440, height: 900 });
  const space = await openSpace(page, "Mouvement réduit");
  const id = await schedule(page, space, TITLE, monday, "18:00");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/calendrier?semaine=${week}`, { waitUntil: "networkidle" });
  await recordLandings(page);

  const source = card(page, id);
  const target = day(page, thursday);
  const drag = await dragOver(page, mobile, source, target);
  // Ce sont des états, pas des animations : ils restent.
  await expect(source).toHaveCSS("border-top-style", "dashed");
  await expect(target).toHaveAttribute("data-drop", "open");
  await expect(target).toHaveCSS("outline-style", "dashed");
  await expect(ghost(page)).toBeVisible();
  await expectNoMotion(page);

  await drag.drop();
  await expect(target.locator(`[data-plan-card="${id}"]`)).toBeVisible();
  // La carte est à sa place sans trajet.
  expect(await landings(page)).toEqual([]);
  await expectNoMotion(page);
  await expect.poll(() => savedDate(page, space, id)).toBe(thursday);
});

test("la séance d'un autre coach ne se déplace pas, et le planning le dit en toutes lettres", async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== "desktop", "un seul projet suffit : la règle ne dépend pas de l'écran");
  await page.setViewportSize({ width: 1440, height: 900 });
  const space = await openSpace(page, "Verrou");
  const id = await schedule(page, space, TITLE, monday, "18:00");

  // Un adjoint du même groupe : il voit la séance du propriétaire, sans pouvoir la modifier.
  const context = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
  const assistant = await context.newPage();
  await assistant.setViewportSize({ width: 1440, height: 900 });
  const email = uniqueEmail("adjoint");
  await signUp(assistant, email);
  // L'offre de départ n'admet qu'un coach : l'espace passe sans limite, la règle testée est celle des droits.
  await setOffre(space.root.split("/").pop()!, "pilot");
  const invitation = await page.request.post(`${space.root}/invitations`, {
    data: { kind: "personal_email", role: "assistant", email, groupIds: [space.groupId] },
  });
  expect(invitation.status()).toBe(200);
  const token = ((await invitation.json()) as { link: string }).link.split("/").pop()!;
  const accepted = await context.request.post(`/api/v1/invitations/${token}/accept`, {
    data: {
      firstName: "Adjoint",
      lastName: "Invité",
      birthDate: "1990-02-03",
      consents: { terms: true, health: false, video: false },
    },
  });
  expect(accepted.status()).toBe(200);

  await assistant.goto(`/calendrier?semaine=${week}`, { waitUntil: "networkidle" });
  const source = card(assistant, id);
  await expect(source.getByText(t.readOnly)).toHaveCount(1);
  await expect(assistant.getByRole("button", { name: t.move(TITLE), exact: true })).toHaveCount(0);
  await expectAccessible(assistant);

  const target = day(assistant, thursday);
  const drag = await dragOver(assistant, false, source, target);
  // L'interdit se lit dans la colonne et dans l'aperçu, par une icône et des mots, pas par la couleur seule.
  await expect(target).toHaveAttribute("data-drop", "locked");
  await expect(target.locator("[data-plan-forbidden]")).toContainText(t.forbiddenDay);
  await expect(ghost(assistant)).toContainText(t.forbidden);
  await expect(target.locator("[data-plan-marker]")).toHaveCount(0);
  // Pour la relecture à l'œil : la capture de l'état interdit, hors dépôt, seulement si un dossier est donné.
  if (process.env.CAPTURE_DIR)
    await assistant.screenshot({ path: `${process.env.CAPTURE_DIR}/apres-verrou-1440-glisser.png` });
  await drag.drop();
  await expect(day(assistant, monday).locator(`[data-plan-card="${id}"]`)).toBeVisible();
  await expect(announced(assistant)).toHaveText(t.forbidden);
  expect(await savedDate(page, space, id)).toBe(monday);
  await context.close();
});
