import type { FilmingNote } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { AppError, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "./access";

const select = { exerciseId: true, filmed: true, comment: true, revision: true } as const;

export async function listFilming(userId: string, organizationId: string, exerciseId?: string) {
  await requireOrgMember(userId, organizationId, "filmAndAnnotate");
  return prisma.exerciseFilming.findMany({
    where: { organizationId, exerciseId, exercise: { deletedAt: null } },
    select,
  });
}

export async function saveFilming(userId: string, organizationId: string, note: FilmingNote) {
  const { exerciseId, filmed, comment, revision } = note;
  return prisma.$transaction(async (tx) => {
    await requireOrgMember(userId, organizationId, "filmAndAnnotate", tx);
    const exercise = await tx.exercise.findFirst({
      where: { id: exerciseId, deletedAt: null, OR: [{ organizationId }, { organizationId: null }] },
      select: { id: true },
    });
    if (!exercise) throw notFound();
    const result =
      revision === 0
        ? await tx.exerciseFilming.createMany({
            data: [{ organizationId, exerciseId, filmed, comment }],
            skipDuplicates: true,
          })
        : await tx.exerciseFilming.updateMany({
            where: { organizationId, exerciseId, revision },
            data: { filmed, comment, revision: { increment: 1 } },
          });
    if (!result.count) throw new AppError(409, "filming_conflict", m.filming.conflict);
    return { ...note, revision: revision + 1 };
  });
}
