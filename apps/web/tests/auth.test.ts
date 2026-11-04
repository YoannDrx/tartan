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
  it("le début de l'adresse n'est pas pris pour un prénom à l'inscription", async () => {
    const email = `etat-vide-${Date.now()}@test.tartan.coach`;
    const res = await auth.handler(
      req("/sign-up/email", { email, password: "mot-de-passe-de-test", name: email.split("@")[0] }),
    );
    expect(res.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { profile: true } });
    expect(user.profile?.firstName).toBeNull();
    expect(user.profile?.lastName).toBeNull();
  });

  it("un vrai nom reste découpé en prénom et nom", async () => {
    const email = `vrai-nom-${Date.now()}@test.tartan.coach`;
    const res = await auth.handler(
      req("/sign-up/email", { email, password: "mot-de-passe-de-test", name: "Léa Martin" }),
    );
    expect(res.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { profile: true } });
    expect(user.profile?.firstName).toBe("Léa");
    expect(user.profile?.lastName).toBe("Martin");
  });

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

  it("une réinitialisation de mot de passe coupe les sessions ouvertes", async () => {
    const email = `reinit-${Date.now()}@test.tartan.coach`;
    const password = "mot-de-passe-solide";
    await auth.handler(req("/sign-up/email", { email, password, name: "Reinit Test" }));
    await prisma.user.update({ where: { email }, data: { emailVerified: true } });
    const signIn = await auth.handler(req("/sign-in/email", { email, password }));
    const cookie = signIn.headers.get("set-cookie")!.split(";")[0]!;
    const session = () =>
      auth.handler(new Request("http://localhost:3000/api/auth/get-session", { headers: { cookie } }));
    expect(await (await session()).json()).toMatchObject({ user: { email } });

    await auth.handler(req("/request-password-reset", { email, redirectTo: "/nouveau-mot-de-passe" }));
    const mail = [...outbox].reverse().find((m) => m.to === email && m.html.includes("reset-password"));
    const token = mail?.html.match(/reset-password\/([^?"&]+)/)?.[1];
    expect(token).toBeTruthy();
    const reset = await auth.handler(req("/reset-password", { token, newPassword: "nouveau-mot-de-passe" }));
    expect(reset.status).toBe(200);
    expect(await (await session()).json()).toBeNull();
  });

  it("le jeton du lien magique n'est pas stocké en clair", async () => {
    const email = `hache-${Date.now()}@test.tartan.coach`;
    await auth.handler(req("/sign-in/magic-link", { email, callbackURL: "/accueil" }));
    const mail = outbox.find((m) => m.to === email);
    const token = mail?.html.match(/token=([^&"]+)/)?.[1];
    expect(token).toBeTruthy();
    expect(await prisma.verification.count({ where: { identifier: token as string } })).toBe(0);
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

  it("n'ouvre aucune session tant que l'adresse n'est pas prouvée", async () => {
    const email = `non-verifie-${Date.now()}@e2e.tartan.test`;
    const password = "mot-de-passe-solide";
    const signUp = await auth.handler(req("/sign-up/email", { email, password, name: "Tiers" }));
    expect(signUp.status).toBe(200);
    expect(((await signUp.json()) as { token: string | null }).token).toBeNull();
    expect(outbox.some((mail) => mail.to === email)).toBe(true);
    const signIn = await auth.handler(req("/sign-in/email", { email, password }));
    expect(signIn.status).toBe(403);
  });

  it("le lien magique du vrai titulaire efface le mot de passe posé sans preuve", async () => {
    const email = `titulaire-${Date.now()}@e2e.tartan.test`;
    const password = "mot-de-passe-du-tiers";
    await auth.handler(req("/sign-up/email", { email, password, name: "Tiers" }));
    await auth.handler(req("/sign-in/magic-link", { email, callbackURL: "/accueil" }));
    const mail = [...outbox].reverse().find((m) => m.to === email && m.html.includes("magic-link"));
    const link = mail?.html.match(/href="([^"]+magic-link[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
    expect(link).toBeTruthy();
    await auth.handler(new Request(link as string, { headers: { origin: "http://localhost:3000" } }));
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { accounts: true } });
    expect(user.emailVerified).toBe(true);
    expect(user.accounts.filter((a) => a.providerId === "credential")).toEqual([]);
    const signIn = await auth.handler(req("/sign-in/email", { email, password }));
    expect(signIn.status).not.toBe(200);
  });
});
