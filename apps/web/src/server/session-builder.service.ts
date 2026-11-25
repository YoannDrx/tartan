import { draftExerciseIds } from "@tartan/domain";
import { sessionBuilderContext, type ExerciseSummary, type SessionDraft } from "@tartan/contracts";
import { prisma } from "@/lib/prisma";
import { m } from "@tartan/i18n";
import { requireOrgMember } from "./access";
import { listAthletes } from "./athlete.service";
import { exerciseSummariesByIds, listExerciseIndex, listExercises } from "./exercise.service";
import { listExerciseLists } from "./exercise-list.service";
import { listGroups } from "./org.service";
import { listTemplates, listTestKeys } from "./session.service";

const strengthTestKeys = (exercises: Pick<ExerciseSummary, "id" | "strengthLoadKind">[]) =>
  exercises
    .filter((e) => e.strengthLoadKind === "external_total" || e.strengthLoadKind === "added_weight")
    .map((e) => `exercise:${e.id}`);

// Le constructeur reçoit seulement les destinataires nécessaires, sans notes ni santé.
// `library: "referenced"` : le constructeur du web ne reçoit que les fiches que la séance et les modèles citent,
// sans guide ; le reste se cherche à la demande. L'API garde la bibliothèque complète pour les applications.
export const getSessionBuilderContext = async (
  userId: string,
  organizationId: string,
  supportsSequences = false,
  options: { library?: "all" | "referenced"; draft?: Pick<SessionDraft, "blocks"> | null } = {},
) => {
  const access = await requireOrgMember(userId, organizationId, "manageSessions");
  const referenced = options.library === "referenced";
  const [index, groups, athletes, templates, keys, space] = await Promise.all([
    referenced ? listExerciseIndex(userId, organizationId) : listExercises(userId, organizationId),
    listGroups(access),
    listAthletes(userId, organizationId),
    listTemplates(userId, organizationId, supportsSequences),
    listTestKeys(userId, organizationId),
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { progressionEnabled: true, phasesEnabled: true },
    }),
  ]);
  const exercises = referenced
    ? await exerciseSummariesByIds(userId, organizationId, [
        ...(options.draft ? draftExerciseIds(options.draft) : []),
        ...templates.flatMap(draftExerciseIds),
      ])
    : index;
  return sessionBuilderContext.parse({
    phasesEnabled: space.phasesEnabled,
    progressionEnabled: space.progressionEnabled,
    exercises,
    groups,
    templates,
    athletes: athletes.map(({ id, firstName, lastName }) => ({ id, firstName, lastName })),
    testKeys: [
      ...new Set([
        ...keys,
        ...Object.keys(m.strengthTest),
        ...(space.progressionEnabled ? strengthTestKeys(index) : []),
      ]),
    ],
  });
};

/** Le constructeur du web : les fiches citées, et les listes du coach pour le sélecteur. */
export const getSessionBuilderPage = async (
  userId: string,
  organizationId: string,
  draft: Pick<SessionDraft, "blocks"> | null,
) => {
  const [context, lists] = await Promise.all([
    getSessionBuilderContext(userId, organizationId, true, { library: "referenced", draft }),
    listExerciseLists(userId, organizationId),
  ]);
  return { ...context, lists };
};
