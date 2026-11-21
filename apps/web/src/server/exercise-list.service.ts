import type { Prisma } from "@/generated/prisma/client";
import {
  exerciseListInput,
  exerciseListOrder,
  exerciseListUpdate,
  type ExerciseList,
  type ExerciseListInput,
  type ExerciseListUpdate,
} from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { AppError, forbidden, invalid, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, type Access } from "./access";
import { namesFor } from "./me.service";

// Les listes d'exercices du coach (ses banques) et ses Favoris.
// Une liste appartient à son coach. Privée par défaut, elle peut être partagée avec les coachs de l'espace, qui la
// lisent, la filtrent et ajoutent ses fiches à une séance sans la modifier. Un athlète n'en voit jamais :
// `editExercises` est réservé à l'encadrement. Un autre espace non plus : tout se lit sous `organizationId`.

type Db = Prisma.TransactionClient;

// Le coach qui partage doit encore encadrer l'espace : un coach parti n'expose plus ses listes.
const activeStaffOwner = (organizationId: string) => ({
  memberships: {
    some: {
      organizationId,
      status: "active" as const,
      role: { in: ["owner" as const, "coach" as const, "assistant" as const] },
    },
  },
});

const readableWhere = (access: Access): Prisma.ExerciseListWhereInput => ({
  organizationId: access.organizationId,
  OR: [{ ownerId: access.userId }, { sharedWithCoaches: true, owner: activeStaffOwner(access.organizationId) }],
});

const visibleExerciseWhere = (organizationId: string): Prisma.ExerciseWhereInput => ({
  deletedAt: null,
  OR: [{ organizationId }, { organizationId: null }],
});

const itemOrder = [{ position: "asc" as const }, { addedAt: "asc" as const }];

/** La liste du coach, prête à modifier. Une liste partagée par un autre se lit, mais ne se modifie pas. */
const ownList = async (db: Db, access: Access, listId: string) => {
  const list = await db.exerciseList.findFirst({ where: { id: listId, ...readableWhere(access) } });
  if (!list) throw notFound();
  if (list.ownerId !== access.userId) throw forbidden();
  return list;
};

const assertVisibleExercise = async (db: Db, organizationId: string, exerciseId: string) => {
  if (!(await db.exercise.count({ where: { id: exerciseId, ...visibleExerciseWhere(organizationId) } })))
    throw notFound();
};

const nextItemPosition = async (db: Db, listId: string) =>
  ((await db.exerciseListItem.aggregate({ where: { listId }, _max: { position: true } }))._max.position ?? -1) + 1;

/** Ajoute une fiche à la liste du coach ; sans effet si elle y est déjà. Appelé aussi à la création d'une fiche. */
export const addToOwnList = async (db: Db, access: Access, listId: string, exerciseId: string) => {
  await ownList(db, access, listId);
  await assertVisibleExercise(db, access.organizationId, exerciseId);
  const existing = await db.exerciseListItem.findUnique({ where: { listId_exerciseId: { listId, exerciseId } } });
  if (existing) return;
  await db.exerciseListItem.create({ data: { listId, exerciseId, position: await nextItemPosition(db, listId) } });
};

const toList = (
  row: Prisma.ExerciseListGetPayload<{ include: { items: { select: { exerciseId: true } } } }>,
  userId: string,
  names: Map<string, string>,
): ExerciseList => ({
  id: row.id,
  name: row.isFavorites ? m.exerciseLists.favorites : row.name,
  position: row.position,
  isFavorites: row.isFavorites,
  sharedWithCoaches: row.sharedWithCoaches,
  mine: row.ownerId === userId,
  ownerName: row.ownerId === userId ? null : (names.get(row.ownerId) ?? null),
  exerciseIds: row.items.map((item) => item.exerciseId),
});

/** Les listes que ce coach lit : les siennes dans son ordre, puis celles que d'autres coachs partagent. */
export const listExerciseLists = async (userId: string, organizationId: string): Promise<ExerciseList[]> => {
  const access = await requireOrgMember(userId, organizationId, "editExercises");
  const rows = await prisma.exerciseList.findMany({
    where: readableWhere(access),
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      items: {
        where: { exercise: visibleExerciseWhere(organizationId) },
        orderBy: itemOrder,
        select: { exerciseId: true },
      },
    },
  });
  const names = await namesFor(rows.filter((row) => row.ownerId !== userId).map((row) => row.ownerId));
  const lists = rows.map((row) => toList(row, userId, names));
  return [
    ...lists.filter((list) => list.mine),
    ...lists
      .filter((list) => !list.mine)
      .sort((a, b) => (a.ownerName ?? "").localeCompare(b.ownerName ?? "", "fr") || a.name.localeCompare(b.name, "fr")),
  ];
};

/** Les fiches d'une liste lisible par ce coach, dans son ordre. */
export const readableListExerciseIds = async (access: Access, listId: string): Promise<string[]> => {
  const list = await prisma.exerciseList.findFirst({
    where: { id: listId, ...readableWhere(access) },
    include: {
      items: {
        where: { exercise: visibleExerciseWhere(access.organizationId) },
        orderBy: itemOrder,
        select: { exerciseId: true },
      },
    },
  });
  if (!list) throw notFound();
  return list.items.map((item) => item.exerciseId);
};

export const favoriteExerciseIds = async (access: Access): Promise<string[]> => {
  const list = await prisma.exerciseList.findFirst({
    where: { organizationId: access.organizationId, ownerId: access.userId, isFavorites: true },
    include: { items: { orderBy: itemOrder, select: { exerciseId: true } } },
  });
  return list?.items.map((item) => item.exerciseId) ?? [];
};

/** Les fiches que ce coach a rangées : ses favoris d'abord, puis ses listes dans leur ordre, chacune une fois. */
export const ownListedExerciseIds = async (access: Access): Promise<string[]> => {
  const lists = await prisma.exerciseList.findMany({
    where: { organizationId: access.organizationId, ownerId: access.userId },
    orderBy: [{ isFavorites: "desc" }, { position: "asc" }, { createdAt: "asc" }],
    include: { items: { orderBy: itemOrder, select: { exerciseId: true } } },
  });
  return [...new Set(lists.flatMap((list) => list.items.map((item) => item.exerciseId)))];
};

/** Où ce coach a rangé une fiche : ses Favoris, et ses propres listes. */
export const exerciseMemberships = async (access: Access, exerciseId: string) => {
  const rows = await prisma.exerciseListItem.findMany({
    where: { exerciseId, list: { organizationId: access.organizationId, ownerId: access.userId } },
    select: { listId: true, list: { select: { isFavorites: true } } },
  });
  return {
    favorite: rows.some((row) => row.list.isFavorites),
    listIds: rows.filter((row) => !row.list.isFavorites).map((row) => row.listId),
  };
};

const nextListPosition = async (db: Db, access: Access) =>
  ((
    await db.exerciseList.aggregate({
      where: { organizationId: access.organizationId, ownerId: access.userId },
      _max: { position: true },
    })
  )._max.position ?? -1) + 1;

export const createExerciseList = async (userId: string, organizationId: string, raw: ExerciseListInput) => {
  const input = exerciseListInput.parse(raw);
  const access = await requireOrgMember(userId, organizationId, "editExercises");
  return prisma.$transaction(async (tx) => {
    const list = await tx.exerciseList.create({
      data: { organizationId, ownerId: userId, name: input.name, position: await nextListPosition(tx, access) },
      select: { id: true },
    });
    return list;
  });
};

export const updateExerciseList = async (
  userId: string,
  organizationId: string,
  listId: string,
  raw: ExerciseListUpdate,
) => {
  const input = exerciseListUpdate.parse(raw);
  const access = await requireOrgMember(userId, organizationId, "editExercises");
  const list = await ownList(prisma, access, listId);
  // Les Favoris restent la liste personnelle du coach : ni renommés, ni partagés.
  if (list.isFavorites) throw new AppError(409, "favorites_locked", m.exerciseLists.favoritesLocked);
  await prisma.exerciseList.update({
    where: { id: listId },
    data: { name: input.name, sharedWithCoaches: input.sharedWithCoaches },
  });
};

export const deleteExerciseList = async (userId: string, organizationId: string, listId: string) => {
  const access = await requireOrgMember(userId, organizationId, "editExercises");
  const list = await ownList(prisma, access, listId);
  if (list.isFavorites) throw new AppError(409, "favorites_locked", m.exerciseLists.favoritesLocked);
  // Les fiches restent dans la bibliothèque : seule la liste disparaît.
  await prisma.exerciseList.delete({ where: { id: listId } });
};

/** Le nouvel ordre des listes du coach : toutes les siennes, chacune une fois. */
export const reorderExerciseLists = async (userId: string, organizationId: string, raw: { listIds: string[] }) => {
  const { listIds } = exerciseListOrder.parse(raw);
  await requireOrgMember(userId, organizationId, "editExercises");
  await prisma.$transaction(async (tx) => {
    const mine = await tx.exerciseList.findMany({ where: { organizationId, ownerId: userId }, select: { id: true } });
    const known = new Set(mine.map((row) => row.id));
    if (
      listIds.length !== known.size ||
      new Set(listIds).size !== listIds.length ||
      listIds.some((id) => !known.has(id))
    )
      throw invalid();
    for (const [position, id] of listIds.entries()) await tx.exerciseList.update({ where: { id }, data: { position } });
  });
};

export const setListMembership = async (
  userId: string,
  organizationId: string,
  listId: string,
  exerciseId: string,
  member: boolean,
) => {
  const access = await requireOrgMember(userId, organizationId, "editExercises");
  await prisma.$transaction(async (tx) => {
    if (member) return addToOwnList(tx, access, listId, exerciseId);
    await ownList(tx, access, listId);
    await tx.exerciseListItem.deleteMany({ where: { listId, exerciseId } });
  });
};

/** L'étoile d'une fiche. La liste Favoris du coach naît à sa première étoile, une seule par coach et par espace. */
export const setFavorite = async (userId: string, organizationId: string, exerciseId: string, favorite: boolean) => {
  const access = await requireOrgMember(userId, organizationId, "editExercises");
  await prisma.$transaction(async (tx) => {
    // Deux étoiles simultanées ne créent pas deux listes Favoris.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`favorites:${organizationId}:${userId}`}))::text`;
    let list = await tx.exerciseList.findFirst({ where: { organizationId, ownerId: userId, isFavorites: true } });
    if (!favorite) {
      if (list) await tx.exerciseListItem.deleteMany({ where: { listId: list.id, exerciseId } });
      return;
    }
    await assertVisibleExercise(tx, organizationId, exerciseId);
    if (!list) {
      // Les Favoris prennent la première place, avant les listes déjà créées.
      await tx.exerciseList.updateMany({
        where: { organizationId, ownerId: userId },
        data: { position: { increment: 1 } },
      });
      list = await tx.exerciseList.create({
        data: { organizationId, ownerId: userId, name: m.exerciseLists.favorites, isFavorites: true, position: 0 },
      });
    }
    await addToOwnList(tx, access, list.id, exerciseId);
  });
};

/** Une fiche commune devient la copie de l'espace : les listes de l'espace suivent la copie. */
export const moveListItems = async (db: Db, organizationId: string, fromId: string, toId: string) => {
  const items = await db.exerciseListItem.findMany({ where: { exerciseId: fromId, list: { organizationId } } });
  for (const item of items) {
    await db.exerciseListItem.upsert({
      where: { listId_exerciseId: { listId: item.listId, exerciseId: toId } },
      create: { listId: item.listId, exerciseId: toId, position: item.position, addedAt: item.addedAt },
      update: {},
    });
  }
  await db.exerciseListItem.deleteMany({ where: { exerciseId: fromId, list: { organizationId } } });
};
