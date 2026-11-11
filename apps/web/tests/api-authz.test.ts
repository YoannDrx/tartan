import { readdirSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PlannerProviderContext } from "@/server/ai/provider";
import {
  buildWorld,
  INTERDITS,
  MATRICE,
  PERSONAS,
  ROUTES_PUBLIQUES,
  ROUTES_REPORTEES,
  type Call,
  type PersonaKey,
  type World,
} from "./api-authz.matrix";

// Les prestataires d'IA sont les seuls éléments simulés : la session, le handler et le service sont réels.
const planner = vi.hoisted(() => ({ reponse: "proposition" as "proposition" | "question" }));
vi.mock("@/lib/env", async (original) => {
  const actual = await original<typeof import("@/lib/env")>();
  return { ...actual, env: () => ({ ...actual.env(), AI_PLANNER_ENABLED: "true" }) };
});
vi.mock("@/server/ai/provider", async (original) => ({
  ...(await original<typeof import("@/server/ai/provider")>()),
  openAiPlannerProvider: () => ({
    interpret: async (context: PlannerProviderContext) =>
      planner.reponse === "question"
        ? {
            status: "clarification",
            sessions: [],
            assumptions: [],
            suggestions: [],
            questions: [{ id: "repos", field: "rest", question: "Quel repos ?", options: [] }],
          }
        : {
            status: "proposal",
            questions: [],
            assumptions: [],
            suggestions: [],
            sessions: [
              {
                date: context.period.from,
                startTime: null,
                title: "Force",
                type: "strength",
                durationMin: 45,
                targetTokens: [context.targets[0]!.token],
                blocks: [
                  {
                    name: "Force",
                    items: [
                      {
                        exerciseToken: context.exercises[0]!.token,
                        instruction: context.instructions[0],
                        prescription: {
                          sets: 3,
                          reps: 5,
                          load: { type: "kg", value: 40 },
                          restS: 120,
                          distanceM: null,
                          durationS: null,
                          intensityTarget: null,
                          tempo: null,
                          contacts: null,
                          notes: null,
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
  }),
}));
vi.mock("@/server/ai/transcription-provider", () => ({
  openAiTranscriptionProvider: () => ({ transcribe: async () => "Trois séries de cinq répétitions." }),
}));

const APP = path.resolve(import.meta.dirname, "../app");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

// « app/(app)/admin/revenus/export/route.ts » répond sur « /admin/revenus/export ».
const routePathOf = (file: string) =>
  `/${path
    .relative(APP, path.dirname(file))
    .split(path.sep)
    .filter((segment) => !/^\(.*\)$/.test(segment))
    .join("/")}`;

const FILES = new Map(
  readdirSync(APP, { recursive: true, encoding: "utf8" })
    .filter((entry) => /(^|[\\/])route\.tsx?$/.test(entry))
    .map((entry) => path.join(APP, entry))
    .map((file) => [routePathOf(file), file] as const),
);

type Handler = (request: NextRequest, context: { params: Promise<Record<string, string | string[]>> }) => unknown;
const handlersOf = async (file: string) => (await import(file)) as Partial<Record<(typeof METHODS)[number], Handler>>;

let w: World;
beforeAll(async () => {
  // Les fichiers de liens universels répondent 404 tant que les identifiants des stores manquent.
  vi.stubEnv("APPLE_TEAM_ID", "TESTTEAM00");
  vi.stubEnv("ANDROID_SHA256_FINGERPRINTS", "AA:BB:CC");
  w = await buildWorld(planner);
}, 120_000);

const run = async (route: string, call: Call, cookie: string | null) => {
  const [method, pattern] = route.split(" ") as [(typeof METHODS)[number], string];
  const file = FILES.get(pattern);
  if (!file) throw new Error(`Aucun fichier pour ${route}`);
  const handler = (await handlersOf(file))[method];
  if (!handler) throw new Error(`${file} n'exporte pas ${method}`);
  const params: Record<string, string | string[]> = { ...call.params };
  const url = new URL(
    pattern.replace(/\[(\.\.\.)?([^\]]+)\]/g, (_segment, _rest, name: string) => {
      // L'espace visé est toujours l'espace principal : c'est ce que tente la persona d'un autre espace.
      const value = params[name] ?? (name === "orgId" ? (params[name] = w.org) : undefined);
      if (value === undefined) throw new Error(`${route} : paramètre « ${name} » manquant`);
      return [value].flat().map(encodeURIComponent).join("/");
    }),
    "http://localhost:3000",
  );
  for (const [key, value] of Object.entries(call.query ?? {})) url.searchParams.set(key, value);
  const headers = new Headers(call.headers);
  if (cookie) headers.set("cookie", cookie);
  if (call.body !== undefined) headers.set("content-type", "application/json");
  const response = (await handler(
    new NextRequest(url, {
      method,
      headers,
      ...(call.form ? { body: call.form } : call.body !== undefined ? { body: JSON.stringify(call.body) } : {}),
    }),
    { params: Promise.resolve(params) },
  )) as Response;
  return { status: response.status, texte: await response.text() };
};

describe("la matrice couvre toutes les routes", () => {
  it("chaque méthode de app/**/route.ts a sa ligne, et aucune ligne ne vise une route disparue", async () => {
    const exposed: string[] = [];
    for (const [routePath, file] of FILES) {
      const handlers = await handlersOf(file);
      for (const method of METHODS) if (handlers[method]) exposed.push(`${method} ${routePath}`);
    }
    const declared = [...MATRICE, ...ROUTES_PUBLIQUES, ...ROUTES_REPORTEES].map((row) => row.route);
    expect(exposed.length).toBeGreaterThan(100);
    expect(declared.filter((route, index) => declared.indexOf(route) !== index)).toEqual([]);
    // Une route ajoutée sans ligne dans tests/api-authz.matrix.ts apparaît ici.
    expect(exposed.filter((route) => !declared.includes(route)).sort()).toEqual([]);
    expect(declared.filter((route) => !exposed.includes(route)).sort()).toEqual([]);
  });

  it("une route publique ne figure pas dans la matrice des personas, et inversement", () => {
    const publiques = new Set(ROUTES_PUBLIQUES.map((row) => row.route));
    expect(MATRICE.filter((row) => publiques.has(row.route))).toEqual([]);
    // Dans la matrice, personne n'entre sans session.
    expect(MATRICE.filter((row) => row.anonyme !== 401).map((row) => row.route)).toEqual([]);
  });
});

describe.each(ROUTES_PUBLIQUES)("route publique $route", (row) => {
  it(`sans session : ${row.anonyme}`, async () => {
    const { status, texte } = await run(row.route, (await row.call?.(w)) ?? {}, null);
    expect(status, texte.slice(0, 300)).toBe(row.anonyme);
    for (const interdit of INTERDITS.anonyme) expect(texte).not.toContain(interdit);
  });
});

describe.each(MATRICE)("$route", (row) => {
  it.each(PERSONAS)("%s", async (qui: PersonaKey) => {
    const call = (await row.call?.(w, qui)) ?? {};
    const { status, texte } = await run(row.route, call, w.cookies[qui]);
    expect(status, texte.slice(0, 300)).toBe(row[qui]);
    for (const interdit of [...INTERDITS[qui], ...w.hors[qui]]) expect(texte).not.toContain(interdit);
    if (status < 300) row.verifie?.(texte, w, qui);
  });
});
