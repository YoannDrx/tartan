import Link from "next/link";
import type { Metadata } from "next";
import { exerciseFamily, type ExerciseFamily, type ExerciseFilter } from "@tartan/contracts";
import { formatPrescription } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { ExerciseLibrary, type LibraryRow } from "@/features/exercises/exercise-library";
import { requireResourceSpace } from "@/features/shell/space";
import { listFilming } from "@/server/exercise-filming.service";
import { listExerciseIndex } from "@/server/exercise.service";
import { listExerciseLists } from "@/server/exercise-list.service";

export const metadata: Metadata = { title: m.exercises.title };

// Un filtre se partage par l'adresse : `?favoris=1`, `?liste=…` ou `?famille=…`.
const filterOf = (
  params: { liste?: string; famille?: string; favoris?: string },
  listIds: string[],
): ExerciseFilter => {
  if (params.favoris === "1") return { kind: "favorites" };
  if (params.liste && listIds.includes(params.liste)) return { kind: "list", listId: params.liste };
  const family = exerciseFamily.safeParse(params.famille);
  return family.success ? { kind: "family", family: family.data } : { kind: "all" };
};

export default async function ExercicesPage({
  searchParams,
}: {
  searchParams: Promise<{ nouveau?: string; liste?: string; famille?: string; favoris?: string }>;
}) {
  const { actor, organizationId, space, planner, staff, clubSpace, personal } = await requireResourceSpace();
  const params = await searchParams;
  const [exercises, lists, filming] = await Promise.all([
    listExerciseIndex(actor.userId, organizationId),
    planner ? listExerciseLists(actor.userId, organizationId) : [],
    staff ? listFilming(actor.userId, organizationId) : [],
  ]);
  // La page n'embarque que ce qu'il faut pour filtrer et afficher : chaque fiche se lit à son adresse.
  const filmed = new Set(filming.filter((note) => note.filmed).map((note) => note.exerciseId));
  const rows: LibraryRow[] = exercises.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    filmed: staff ? filmed.has(exercise.id) : undefined,
    aliases: exercise.aliases ?? [],
    category: exercise.category,
    family: exercise.family as ExerciseFamily,
    hasFilmedVideo: exercise.hasFilmedVideo,
    motionKey: exercise.motionKey ?? null,
    shared: exercise.shared,
    prescription: formatPrescription(exercise.defaultPrescription),
  }));
  return (
    <>
      {personal && clubSpace.kind !== "personal" && (
        <Link className="inline-flex min-h-11 items-center" href="/club/exercices">
          {m.brand.clubLibrary}
        </Link>
      )}
      <ExerciseLibrary
        basePath={planner ? "/exercices" : "/club/exercices"}
        editable={planner}
        rows={rows}
        lists={lists}
        initialFilter={filterOf(
          params,
          lists.map((list) => list.id),
        )}
        openNew={planner && params.nouveau === "1"}
        progressionEnabled={space.progressionEnabled}
      />
    </>
  );
}
