import { describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { outbox } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

const req = (path: string, body: unknown) =>
  new Request(`http://localhost:3000/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  });

describe("authentification", () => {
  it("le lien magique crée le compte, son profil, et ne sert qu'une fois", async () => {
    const email = `magique-${Date.now()}@test.tartan.coach`;
    const res = await auth.handler(req("/sign-in/magic-link", { email, callbackURL: "/accueil" }));
    expect(res.status).toBe(200);
    const mail = outbox.find((m) => m.to === email);
    const link = mail?.html.match(/href="([^"]+magic-link[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
    expect(link).toBeTruthy();

    const verified = await auth.handler(new Request(link as string, { headers: { origin: "http://localhost:3000" } }));
    expect([200, 302]).toContain(verified.status);
    expect(verified.headers.get("set-cookie")).toContain("session_token");

    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { profile: true } });
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.profile).toBeTruthy();

    const replay = await auth.handler(new Request(link as string, { headers: { origin: "http://localhost:3000" } }));
    expect(replay.headers.get("set-cookie") ?? "").not.toContain("session_token=ey");
    expect(replay.headers.get("location") ?? "").toContain("error");
  });

  it("un même e-mail reste un seul compte", async () => {
    const email = `unique-${Date.now()}@test.tartan.coach`;
    const first = await auth.handler(req("/sign-up/email", { email, password: "mot-de-passe-solide", name: "Un" }));
    expect(first.status).toBe(200);
    await auth.handler(req("/sign-up/email", { email, password: "autre-mot-de-passe", name: "Deux" }));
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });

  it("refuse un mot de passe trop court", async () => {
    const res = await auth.handler(
      req("/sign-up/email", { email: `court-${Date.now()}@test.tartan.coach`, password: "court", name: "C" }),
    );
    expect(res.status).toBe(400);
  });
});
