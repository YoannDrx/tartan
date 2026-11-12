import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { icalLink, revokeIcalLink } from "@/server/ical.service";
import { publishRow, saveScheduledSession } from "@/server/session.service";
import { GET as hourly } from "../app/api/cron/hourly/route";
import { GET as health } from "../app/api/health/route";
import { GET as ical } from "../app/api/ical/[athleteId]/[token]/route";
import { GET as live } from "../app/api/live/route";
import { GET as version } from "../app/api/v1/version/route";
import manifest from "../app/manifest";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { addAthlete, makeOrg } from "./helpers";

// T11 et T22 : les routes appelées sans session, par un planificateur, une sonde ou un agenda. Vrais handlers ;
// seuls le secret de la tâche planifiée et, pour un cas, une tâche en panne ou une base coupée sont simulés.

const { SECRET, failing } = vi.hoisted(() => ({ SECRET: "cron-secret-de-test", failing: { referrals: false } }));
vi.mock("@/lib/env", async (original) => {
  const actual = await original<typeof import("@/lib/env")>();
  return { ...actual, env: () => ({ ...actual.env(), CRON_SECRET: SECRET }) };
});
vi.mock("@/server/billing.service", async (original) => {
  const actual = await original<typeof import("@/server/billing.service")>();
  return {
    ...actual,
    processReferrals: async (now: Date) => {
      if (failing.referrals) throw new Error("panne simulée, contenu à ne pas renvoyer");
      return actual.processReferrals(now);
    },
  };
});

afterEach(() => {
  failing.referrals = false;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const cron = (token?: string) =>
  hourly(new Request("https://tartan.test/api/cron/hourly", token ? { headers: { authorization: `Bearer ${token}` } } : {}));

describe("tâche horaire (T11)", () => {
  it("refuse un appel sans jeton ou avec un mauvais jeton", async () => {
    expect((await cron()).status).toBe(401);
    expect((await cron("mauvais-jeton")).status).toBe(401);
  });

  it("à heure figée, joue toutes les tâches et rend leurs résultats par nom", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 9 h à Paris : les relances quotidiennes tournent.
    vi.setSystemTime(new Date("2030-03-12T08:00:00Z"));
    const response = await cron(SECRET);
    expect(response.status).toBe(200);
    const result = (await response.json()) as Record<string, unknown> & { errors: string[] };
    expect(result.errors).toEqual([]);
    for (const key of ["published", "closed", "eve", "dispatched", "billing", "referrals", "trialReminders", "retention"])
      expect(result).toHaveProperty(key);
    // 9 h : relances jouées ; la rétention, elle, n'a lieu qu'à 3 h.
    expect(result.trialReminders).not.toBeNull();
    expect(result.retention).toBeNull();
  });

  it("une tâche en panne n'arrête pas les autres, et la réponse est 500 avec son seul nom", async () => {
    failing.referrals = true;
    const response = await cron(SECRET);
    expect(response.status).toBe(500);
    const body = await response.text();
    const result = JSON.parse(body) as { errors: string[]; referrals: unknown; published: unknown };
    expect(result.errors).toEqual(["referrals"]);
    expect(result.referrals).toBeNull();
    expect(result).toHaveProperty("published");
    expect(body).not.toContain("panne simulée");
  });
});

describe("routes techniques (T22)", () => {
  it("la sonde de santé lit la base, et répond 503 quand elle est coupée", async () => {
    const ok = await health();
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ status: "ok" });
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("base coupée"));
    const down = await health();
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({ status: "degraded" });
  });

  it("la sonde de disponibilité répond sans toucher à la base, jamais mise en cache", async () => {
    const query = vi.spyOn(prisma, "$queryRaw");
    const response = live();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(query).not.toHaveBeenCalled();
  });

  it("la version dit ce qui est en ligne, sans cache", async () => {
    const response = version();
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as { build: string; releaseId: string | null };
    expect(typeof body.build).toBe("string");
    expect(body.build.length).toBeGreaterThan(0);
  });

  it("le lien d'agenda donne les séances de l'athlète, sans rien d'autre, et cesse après révocation", async () => {
    const org = await makeOrg("Agenda");
    const athlete = await addAthlete(org.organizationId, org.groupId, "Ical");
    const exercise = await prisma.exercise.findFirstOrThrow({ where: { organizationId: org.organizationId } });
    const saved = await saveScheduledSession(org.owner.userId, org.organizationId, {
      date: new Date().toISOString().slice(0, 10),
      startTime: "18:30",
      location: "Stade Charléty",
      publishAt: null,
      draft: {
        title: "Vitesse et appuis",
        type: "strength",
        durationMin: 75,
        coachNote: "Mot du coach à ne pas exporter",
        blocks: [{ name: "Corps", variant: "club", items: [{ exerciseId: exercise.id, prescription: { sets: 3 } }] }],
      },
      assignments: [{ targetType: "group", targetId: org.groupId }],
      overrides: [],
    });
    await publishRow(saved.id, org.owner.userId, new Date("2020-01-01T10:00:00Z"), { silent: true });
    const link = new URL(await icalLink(athlete.userId, org.organizationId));
    const [athleteId, token] = link.pathname.split("/").slice(-2) as [string, string];
    const feed = await ical(new Request(link), { params: Promise.resolve({ athleteId, token }) });
    expect(feed.status).toBe(200);
    expect(feed.headers.get("content-type")).toContain("text/calendar");
    const text = await feed.text();
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("SUMMARY:Vitesse et appuis");
    expect(text).toContain("LOCATION:Stade Charléty");
    expect(text).toMatch(/DTEND;TZID=Europe\/Paris:\d{8}T194500/);
    expect(text).not.toContain("Mot du coach");

    // Un jeton faux, puis le lien révoqué : introuvable.
    const forged = await ical(new Request(link), { params: Promise.resolve({ athleteId, token: `${token}x` }) });
    expect(forged.status).toBe(404);
    await revokeIcalLink(athlete.userId, org.organizationId);
    const revoked = await ical(new Request(link), { params: Promise.resolve({ athleteId, token }) });
    expect(revoked.status).toBe(404);
  });
});

// T25 : ce que lisent les moteurs et le téléphone qui installe l'app. Une page ajoutée au plan du site doit exister
// et être permise aux robots ; une icône ou un raccourci du manifeste doit pointer vers un fichier ou une page réelle.
const APP = path.join(__dirname, "..", "app");
const pageExists = (route: string, group: "(public)" | "(app)") =>
  route === "" ? existsSync(path.join(APP, "page.tsx")) : existsSync(path.join(APP, group, route, "page.tsx"));

describe("manifest, robots et plan du site (T25)", () => {
  it("chaque page du plan du site existe et est permise aux robots, l'application reste fermée", () => {
    const rules = robots().rules as { allow: string[]; disallow: string[] };
    expect(rules.disallow).toEqual(["/"]);
    expect(robots().sitemap).toBe("https://tartan.coach/sitemap.xml");
    const pages = sitemap().map(({ url }) => new URL(url));
    expect(pages.length).toBeGreaterThan(5);
    for (const page of pages) {
      expect(page.origin).toBe("https://tartan.coach");
      const route = page.pathname === "/" ? "" : page.pathname;
      expect(pageExists(route, "(public)"), route).toBe(true);
      expect(rules.allow, route).toContain(route === "" ? "/$" : route);
    }
    for (const closed of ["/suivi", "/aujourdhui", "/admin", "/api"]) expect(rules.allow).not.toContain(closed);
  });

  it("le manifeste ouvre l'application, et ses icônes et raccourcis existent", () => {
    const app = manifest();
    expect(app.display).toBe("standalone");
    expect(app.lang).toBe("fr");
    for (const url of [app.start_url, ...(app.shortcuts ?? []).map((shortcut) => shortcut.url)])
      expect(pageExists(String(url).slice(1), "(app)"), String(url)).toBe(true);
    for (const icon of app.icons ?? []) expect(existsSync(path.join(__dirname, "..", "public", icon.src)), icon.src).toBe(true);
    expect(app.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
  });
});
