import { w } from "@tartan/i18n/web";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/v1/me/avatar/route";
import { prisma } from "@/lib/prisma";
import { setAvatarPreset } from "@/server/me.service";
import { makeOrg } from "./helpers";
import { pngOf, webpOf } from "./image-fixtures";
import { sessionCookie } from "./personas";

// La route d'envoi de la photo de profil de l'app native : la vraie session, le vrai handler, le vrai service et le
// vrai déclencheur de file de suppression. Seul le stockage Blob est simulé.
const mocks = vi.hoisted(() => ({ put: vi.fn() }));
vi.mock("@vercel/blob", () => ({ put: mocks.put, del: vi.fn() }));
vi.mock("@/lib/env", async (original) => {
  const actual = await original<typeof import("@/lib/env")>();
  return { ...actual, env: () => ({ ...actual.env(), BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_tartantest_jeton" }) };
});

const blobUrl = (pathname: string) => `https://tartantest.public.blob.vercel-storage.com/${pathname}`;

const send = (cookie: string | null, body: BodyInit | null, headers: Record<string, string> = {}) =>
  POST(
    new NextRequest("http://localhost:3000/api/v1/me/avatar", {
      method: "POST",
      headers: { ...(cookie ? { cookie } : {}), ...headers },
      body,
    }),
  );

const formWith = (bytes: Uint8Array, type: string) => {
  const form = new FormData();
  form.set("file", new Blob([Buffer.from(bytes)], { type }), "photo");
  return form;
};

const signedIn = async (name: string) => {
  const a = await makeOrg(name);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: a.owner.userId }, select: { email: true } });
  return { userId: a.owner.userId, cookie: await sessionCookie(user.email) };
};

beforeEach(() => {
  mocks.put.mockReset().mockImplementation(async (pathname: string) => ({ url: blobUrl(pathname) }));
});

describe("POST /api/v1/me/avatar", () => {
  it("refuse sans session, avant de lire l'image", async () => {
    const response = await send(null, formWith(webpOf(512, 512), "image/webp"));
    expect(response.status).toBe(401);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("garde un carré WebP, retire l'avatar choisi et renvoie le profil à jour", async () => {
    const { userId, cookie } = await signedIn("Envoi");
    await setAvatarPreset(userId, "animal:fox");
    const response = await send(cookie, formWith(webpOf(512, 512), "image/webp"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { avatarUrl: string | null; avatarPreset: string | null };
    expect(body.avatarPreset).toBeNull();
    expect(body.avatarUrl).toMatch(
      new RegExp(`^https://tartantest\\.public\\.blob\\.vercel-storage\\.com/avatars/${userId}/`),
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("refuse un fichier trop lourd sans lire le corps annoncé, et un faux type", async () => {
    const { cookie } = await signedIn("Refus");
    // Le poids annoncé suffit : le corps n'est pas lu.
    const announced = await send(cookie, formWith(webpOf(512, 512), "image/webp"), {
      "content-length": String(5 * 1024 * 1024),
    });
    expect(announced.status).toBe(400);
    expect(await announced.json()).toMatchObject({ message: w.profile.errors.serverSize });

    // Un corps réellement trop lourd, quel que soit l'en-tête.
    const heavy = new Uint8Array(4 * 1024 * 1024 + 32 * 1024);
    heavy.set(webpOf(512, 512));
    const real = await send(cookie, formWith(heavy, "image/webp"));
    expect(real.status).toBe(400);
    expect(await real.json()).toMatchObject({ message: w.profile.errors.serverSize });

    // Des octets PNG annoncés comme WebP : le type réel est lu dans le fichier.
    const renamed = await send(cookie, formWith(pngOf(512, 512), "image/webp"));
    expect(renamed.status).toBe(400);
    expect(await renamed.json()).toMatchObject({ message: w.profile.errors.serverType });

    // Pas de multipart du tout.
    const json = await send(cookie, JSON.stringify({ file: "x" }), { "content-type": "application/json" });
    expect(json.status).toBe(400);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("met l'ancienne photo en file de suppression quand une nouvelle la remplace", async () => {
    const { userId, cookie } = await signedIn("Remplace");
    expect((await send(cookie, formWith(webpOf(512, 512), "image/webp"))).status).toBe(200);
    const first = (await prisma.profile.findUniqueOrThrow({ where: { id: userId } })).avatarUrl!;
    expect((await send(cookie, formWith(webpOf(512, 512), "image/webp"))).status).toBe(200);
    const second = (await prisma.profile.findUniqueOrThrow({ where: { id: userId } })).avatarUrl!;
    expect(second).not.toBe(first);
    expect(await prisma.externalDeletion.findFirst({ where: { externalRef: first } })).toMatchObject({
      provider: "blob",
      reason: "avatar_replaced",
    });
    expect(await prisma.externalDeletion.findFirst({ where: { externalRef: second } })).toBeNull();
  });
});
