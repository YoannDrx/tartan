import "server-only";
import { plannerTermKey } from "@tartan/domain";
import { notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireOrgMember } from "../access";

// Alias appris : le terme qu'un coach a dit au planificateur, et la fiche qu'il a choisie pour lui. Chaque choix y
// entre (fiche choisie pour un terme, fiche créée, fiche « probable » remplacée) ; la demande suivante le relit
// avant toute autre règle, et la dictée s'en sert comme vocabulaire. Un alias ne quitte jamais son espace : toute
// lecture et toute écriture portent l'identifiant de l'espace, après contrôle de l'appartenance.

const visibleExercise = (organizationId: string) => ({
  deletedAt: null,
  OR: [{ organizationId }, { organizationId: null }],
});

/** Retient qu'un terme dit désigne cette fiche, dans cet espace seulement. Le dernier choix remplace le précédent. */
export async function learnExerciseTermAlias(
  userId: string,
  organizationId: string,
  input: { said: string; exerciseId: string },
  db: Prisma.TransactionClient = prisma,
) {
  await requireOrgMember(userId, organizationId, "manageSessions", db);
  const said = input.said.trim().replace(/\s+/g, " ").slice(0, 120);
  const term = plannerTermKey(said);
  if (!term) return null;
  // La fiche est une fiche de cet espace, ou une fiche commune : jamais celle d'un autre espace.
  const exercise = await db.exercise.findFirst({
    where: { id: input.exerciseId, ...visibleExercise(organizationId) },
    select: { id: true },
  });
  if (!exercise) throw notFound();
  return db.exerciseTermAlias.upsert({
    where: { organizationId_term: { organizationId, term } },
    create: { organizationId, term, said, exerciseId: exercise.id, authorId: userId },
    update: { said, exerciseId: exercise.id, authorId: userId },
    select: { id: true, term: true, said: true, exerciseId: true },
  });
}

/** Les alias de l'espace, pour le planificateur et la dictée. L'appelant a déjà contrôlé l'appartenance. */
export async function learnedExerciseAliases(organizationId: string, db: Prisma.TransactionClient = prisma) {
  return db.exerciseTermAlias.findMany({
    where: { organizationId, exercise: visibleExercise(organizationId) },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: { term: true, said: true, exerciseId: true },
    take: 2000,
  });
}

/** Ce que l'espace a appris, lisible par ses encadrants. */
export async function listExerciseTermAliases(userId: string, organizationId: string) {
  await requireOrgMember(userId, organizationId, "manageSessions");
  const rows = await prisma.exerciseTermAlias.findMany({
    where: { organizationId, exercise: visibleExercise(organizationId) },
    orderBy: [{ said: "asc" }, { id: "asc" }],
    select: { id: true, said: true, exerciseId: true, updatedAt: true, exercise: { select: { name: true } } },
    take: 2000,
  });
  return {
    aliases: rows.map((row) => ({
      id: row.id,
      said: row.said,
      exerciseId: row.exerciseId,
      exerciseName: row.exercise.name,
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

/** Oublier un alias : le terme sera de nouveau cherché dans la bibliothèque. */
export async function forgetExerciseTermAlias(userId: string, organizationId: string, aliasId: string) {
  await requireOrgMember(userId, organizationId, "manageSessions");
  const removed = await prisma.exerciseTermAlias.deleteMany({ where: { id: aliasId, organizationId } });
  if (!removed.count) throw notFound();
  return { removed: true };
}
