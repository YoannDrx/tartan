import { randomUUID } from "node:crypto";
import { avatarPreset, profileInput } from "@tartan/contracts";
import { w } from "@tartan/i18n/web";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { deleteAccount } from "@/server/account.service";
import { addComment, listAnnouncements, listComments, publishAnnouncement } from "@/server/comm.service";
import { addAnnotation, getVideo } from "@/server/video.service";
import { listMembers } from "@/server/members.service";
import { getMe, peopleFor, saveAvatar, setAvatarPreset, updateProfile } from "@/server/me.service";
import { saveOrganizationLogo } from "@/server/org.service";
import { getTrackingGrid } from "@/server/tracking.service";
import { listAthletes } from "@/server/athlete.service";
import { addAthlete, makeOrg } from "./helpers";
import { pngOf, webpOf, jpegOf } from "./image-fixtures";

// La photo de profil et les avatars : ce que le serveur accepte, ce qu'il garde, ce qu'il met en file de
// suppression, et ce qu'il montre au groupe. Le stockage Blob est simulé ; le déclencheur en base est réel.
const mocks = vi.hoisted(() => ({ put: vi.fn(), token: "vercel_blob_rw_tartantest_jeton" as string | undefined }));
vi.mock("@vercel/blob", () => ({ put: mocks.put, del: vi.fn() }));
vi.mock("@/lib/env", async (original) => {
  const actual = await original<typeof import("@/lib/env")>();
  return { ...actual, env: () => ({ ...actual.env(), BLOB_READ_WRITE_TOKEN: mocks.token }) };
});

const blobUrl = (pathname: string) => `https://tartantest.public.blob.vercel-storage.com/${pathname}`;
const queuedFor = (ref: string) => prisma.externalDeletion.findFirst({ where: { externalRef: ref } });
const file = (bytes: Uint8Array, type: string) => new File([Buffer.from(bytes)], "photo", { type });
const avatarOf = (userId: string) =>
  prisma.profile.findUniqueOrThrow({ where: { id: userId }, select: { avatarUrl: true, avatarPreset: true } });

beforeEach(() => {
  mocks.token = "vercel_blob_rw_tartantest_jeton";
  mocks.put.mockReset().mockImplementation(async (pathname: string) => ({ url: blobUrl(pathname) }));
});

describe("l'envoi d'une photo", () => {
  it("garde un carré WebP recadré, et retire l'avatar choisi", async () => {
    const a = await makeOrg("Photo");
    await setAvatarPreset(a.owner.userId, "animal:fox");
    await saveAvatar(a.owner.userId, file(webpOf(512, 512), "image/webp"));
    expect(mocks.put).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^avatars/${a.owner.userId}/[0-9a-f-]+\\.webp$`)),
      expect.any(Buffer),
      { access: "public", contentType: "image/webp" },
    );
    const saved = await avatarOf(a.owner.userId);
    expect(saved.avatarPreset).toBeNull();
    expect(saved.avatarUrl).toMatch(/^https:\/\/tartantest\.public\.blob\.vercel-storage\.com\/avatars\//);
    expect((await getMe(a.owner.userId)).avatarUrl).toBe(saved.avatarUrl);
  });

  it("accepte aussi le JPEG et le PNG d'un navigateur qui n'écrit pas le WebP", async () => {
    const a = await makeOrg("Repli");
    await saveAvatar(a.owner.userId, file(jpegOf(512, 512), "image/jpeg"));
    await saveAvatar(a.owner.userId, file(pngOf(256, 256), "image/png"));
    expect(mocks.put).toHaveBeenCalledTimes(2);
  });

  it("refuse un type faux, un fichier renommé, une image trop lourde ou pas carrée", async () => {
    const a = await makeOrg("Refus");
    const t = w.profile.errors;
    await expect(saveAvatar(a.owner.userId, file(webpOf(512, 512), "image/gif"))).rejects.toThrow(t.serverType);
    // Des octets PNG annoncés comme WebP : le type réel est lu dans le fichier.
    await expect(saveAvatar(a.owner.userId, file(pngOf(512, 512), "image/webp"))).rejects.toThrow(t.serverType);
    await expect(saveAvatar(a.owner.userId, file(new Uint8Array(64), "image/png"))).rejects.toThrow(t.serverType);
    await expect(saveAvatar(a.owner.userId, file(pngOf(800, 600), "image/png"))).rejects.toThrow(t.serverDimensions);
    await expect(saveAvatar(a.owner.userId, file(pngOf(64, 64), "image/png"))).rejects.toThrow(t.serverDimensions);
    await expect(saveAvatar(a.owner.userId, file(pngOf(4096, 4096), "image/png"))).rejects.toThrow(t.serverDimensions);
    const heavy = new Uint8Array(4 * 1024 * 1024 + 1);
    heavy.set(pngOf(512, 512));
    await expect(saveAvatar(a.owner.userId, file(heavy, "image/png"))).rejects.toThrow(t.serverSize);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("refuse tout envoi quand le stockage n'est pas configuré", async () => {
    const a = await makeOrg("SansBlob");
    mocks.token = undefined;
    await expect(saveAvatar(a.owner.userId, file(webpOf(512, 512), "image/webp"))).rejects.toThrow(
      w.profile.errors.unconfigured,
    );
  });

  it("vérifie de même le logo de l'espace, réservé au propriétaire", async () => {
    const a = await makeOrg("Logo");
    await expect(
      saveOrganizationLogo(a.owner.userId, a.organizationId, file(pngOf(900, 300), "image/png")),
    ).rejects.toThrow(w.profile.errors.serverDimensions);
    await saveOrganizationLogo(a.owner.userId, a.organizationId, file(pngOf(512, 512), "image/png"));
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: a.organizationId } });
    expect(org.logoUrl).toMatch(new RegExp(`/logos/${a.organizationId}/[0-9a-f-]+\\.png$`));
    const athlete = await addAthlete(a.organizationId, a.groupId, "Léa");
    await expect(
      saveOrganizationLogo(athlete.userId, a.organizationId, file(pngOf(512, 512), "image/png")),
    ).rejects.toThrow();
  });
});

describe("l'ancienne photo part en file de suppression", () => {
  it("quand une nouvelle photo la remplace", async () => {
    const a = await makeOrg("Remplace");
    await saveAvatar(a.owner.userId, file(webpOf(512, 512), "image/webp"));
    const first = (await avatarOf(a.owner.userId)).avatarUrl!;
    await saveAvatar(a.owner.userId, file(webpOf(512, 512), "image/webp"));
    const second = (await avatarOf(a.owner.userId)).avatarUrl!;
    expect(second).not.toBe(first);
    expect(await queuedFor(first)).toMatchObject({ provider: "blob", reason: "avatar_replaced" });
    expect(await queuedFor(second)).toBeNull();
  });

  it("quand un avatar est choisi, ou qu'on revient aux initiales", async () => {
    const a = await makeOrg("Choisit");
    await saveAvatar(a.owner.userId, file(webpOf(512, 512), "image/webp"));
    const photo = (await avatarOf(a.owner.userId)).avatarUrl!;
    await setAvatarPreset(a.owner.userId, "athlete:highJump");
    expect(await avatarOf(a.owner.userId)).toEqual({ avatarUrl: null, avatarPreset: "athlete:highJump" });
    expect(await queuedFor(photo)).toMatchObject({ provider: "blob" });

    await saveAvatar(a.owner.userId, file(webpOf(512, 512), "image/webp"));
    const again = (await avatarOf(a.owner.userId)).avatarUrl!;
    await setAvatarPreset(a.owner.userId, null);
    expect(await avatarOf(a.owner.userId)).toEqual({ avatarUrl: null, avatarPreset: null });
    expect(await queuedFor(again)).toMatchObject({ provider: "blob" });
  });

  it("quand le compte est supprimé", async () => {
    const a = await makeOrg("Supprime");
    const athlete = await addAthlete(a.organizationId, a.groupId, "Léa");
    await saveAvatar(athlete.userId, file(webpOf(512, 512), "image/webp"));
    const photo = (await avatarOf(athlete.userId)).avatarUrl!;
    await deleteAccount(athlete.userId);
    expect(await prisma.profile.count({ where: { id: athlete.userId } })).toBe(0);
    expect(await queuedFor(photo)).toMatchObject({ provider: "blob" });
  });
});

describe("l'avatar exposé au mobile", () => {
  it("/me lit l'avatar choisi ; le profil l'écrit, et une photo l'efface", async () => {
    const a = await makeOrg("Mobile");
    const base = { firstName: "Mobile", lastName: "Coach" };
    await updateProfile(a.owner.userId, profileInput.parse({ ...base, avatarPreset: "animal:panda" }));
    expect((await getMe(a.owner.userId)).avatarPreset).toBe("animal:panda");
    const url = blobUrl(`avatars/${randomUUID()}.webp`);
    await updateProfile(a.owner.userId, profileInput.parse({ ...base, avatarUrl: url }));
    expect(await getMe(a.owner.userId)).toMatchObject({ avatarUrl: url, avatarPreset: null });
    // Un champ absent ne change rien.
    await updateProfile(a.owner.userId, profileInput.parse(base));
    expect((await getMe(a.owner.userId)).avatarUrl).toBe(url);
  });

  it("le contrat refuse un avatar inconnu, et le serveur ignore une valeur inconnue déjà en base", async () => {
    expect(avatarPreset.safeParse("animal:dragon").success).toBe(false);
    expect(profileInput.safeParse({ firstName: "A", lastName: "B", avatarPreset: "animal:dragon" }).success).toBe(
      false,
    );
    const a = await makeOrg("Inconnu");
    await prisma.profile.update({ where: { id: a.owner.userId }, data: { avatarPreset: "animal:dragon" } });
    expect((await getMe(a.owner.userId)).avatarPreset).toBeNull();
    expect((await peopleFor([a.owner.userId])).get(a.owner.userId)?.avatarPreset).toBeNull();
  });
});

// Le constat G14 : la photo s'envoyait mais ne s'affichait nulle part. Chaque vue qui nomme quelqu'un la porte.
describe("l'avatar suit la personne dans l'espace", () => {
  it("dans le suivi, la liste des athlètes, les membres, les annonces et les commentaires", async () => {
    const a = await makeOrg("Partout");
    const athlete = await addAthlete(a.organizationId, a.groupId, "Léa");
    await saveAvatar(athlete.userId, file(webpOf(512, 512), "image/webp"));
    const photo = (await avatarOf(athlete.userId)).avatarUrl!;
    await setAvatarPreset(a.owner.userId, "animal:owl");

    const grid = await getTrackingGrid(a.owner.userId, a.organizationId, {});
    expect(grid.rows.find((r) => r.athleteId === athlete.athleteId)).toMatchObject({
      initials: "LT",
      avatarUrl: photo,
      avatarPreset: null,
    });
    expect(
      (await listAthletes(a.owner.userId, a.organizationId)).find((r) => r.id === athlete.athleteId),
    ).toMatchObject({ avatarUrl: photo });
    expect((await listMembers(a.owner.userId, a.organizationId))[0]).toMatchObject({ avatarPreset: "animal:owl" });

    await publishAnnouncement(a.owner.userId, a.organizationId, {
      groupId: a.groupId,
      body: "Rendez-vous au stade.",
      pinned: false,
    });
    const [announcement] = await listAnnouncements(athlete.userId, a.organizationId);
    expect(announcement).toMatchObject({ authorAvatarUrl: null, authorAvatarPreset: "animal:owl" });

    // Les commentaires et remarques d'une vidéo partagée avec l'athlète.
    const video = await prisma.video.create({
      data: {
        organizationId: a.organizationId,
        athleteId: athlete.athleteId,
        uploadedBy: a.owner.userId,
        status: "ready",
        sharedWithAthlete: true,
      },
    });
    await addComment(athlete.userId, a.organizationId, {
      entityType: "video",
      entityId: video.id,
      body: "Merci coach",
    });
    await addAnnotation(a.owner.userId, a.organizationId, video.id, { tMs: 1200, text: "Pied à plat" });
    const [comment] = await listComments(a.owner.userId, a.organizationId, "video", video.id);
    const detail = await getVideo(athlete.userId, a.organizationId, video.id);
    expect(detail.comments[0]).toMatchObject({ authorAvatarUrl: photo });
    expect(detail.annotations[0]).toMatchObject({ authorAvatarPreset: "animal:owl" });
    expect(comment).toMatchObject({ authorAvatarUrl: photo, authorAvatarPreset: null });
  });
});
