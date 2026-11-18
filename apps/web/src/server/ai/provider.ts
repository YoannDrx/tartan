import "server-only";
import { z } from "zod";
import {
  exerciseCategory,
  exerciseClassification,
  snapshotItem,
  plannerGeneration,
  plannerProposeGeneration,
  plannerPeriod,
  plannerBrief,
  plannerPrescription,
  plannerItem,
  plannerRichInterpretation,
  trainingPhaseKind,
  clockTime,
  type PlannerFailureCode,
  type PlannerGeneration,
  type PlannerProposeGeneration,
  type PlannerRichInterpretation,
} from "@tartan/contracts";
import {
  ambiguousExerciseTerms,
  groundPlannerCitations,
  plannerCoachText,
  plannerDateHints,
  plannerDateReferences,
  plannerEquipmentAvailable,
  plannerGenerationToInterpretation,
  plannerProposeGenerationToInterpretation,
  plannerDistinctQuestions,
  plannerDropEmptyPercentages,
  plannerGuardIssues,
  plannerProposalIssues,
  plannerServerEnabled,
  plannerUnknownExerciseTerms,
  plannerWarnings,
  unresolvedExerciseAlias,
  validatePlannerInterpretation,
  type PlannerGuardIssue,
  type PlannerValidationContext,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { env } from "@/lib/env";
import { formatPrompt, proposePrompt } from "./planner-prompt";

const token = z
  .string()
  .regex(/^[a-z]+_[0-9]+$/)
  .max(60);
const phase = z
  .object({ kind: trainingPhaseKind, week: z.number().int().positive(), weeks: z.number().int().positive() })
  .strict()
  .nullable();
// Projection autorisée, strictement limitée. Le service d’accès construit ce contexte
// après contrôle des droits et du drapeau de l’espace. Aucun objet Prisma n’est accepté.
export const plannerProviderContext = z
  .object({
    mode: z.enum(["format", "propose"]).optional(),
    brief: plannerBrief.optional(),
    // Mode « Proposer » : l'heure demandée, posée par le serveur sur la séance.
    startTime: clockTime.nullable().optional(),
    resolvedExercises: z
      .array(z.object({ term: z.string().min(1).max(120), token }).strict())
      .max(50)
      .optional(),
    period: plannerPeriod,
    today: z.iso.date(),
    timeZone: z.string().min(1).max(80),
    targets: z
      .array(z.object({ token, kind: z.enum(["group", "athlete"]), phase }).strict())
      .min(1)
      .max(200),
    exercises: z
      .array(
        z
          .object({
            token,
            name: z.string().min(1).max(200),
            category: exerciseCategory,
            aliases: z.array(z.string().min(1).max(200)).max(20),
            classification: exerciseClassification.strict().nullable().optional(),
            strengthLoadKind: snapshotItem.shape.strengthLoadKind,
          })
          .strict(),
      )
      .min(1)
      .max(500),
    instructions: z.array(z.string().trim().min(1).max(12000)).min(1).max(6),
    phaseCalendar: z
      .array(z.object({ date: z.iso.date(), targetToken: token, phase }).strict())
      .max(1400)
      .optional(),
    // « Ajuster » : la séance précédente, dans la forme que le modèle écrit (jetons seulement, jamais de nom).
    previous: z
      .object({ sessions: z.array(plannerGeneration.shape.sessions.element).min(1).max(14) })
      .strict()
      .optional(),
  })
  .strict();
export type PlannerProviderContext = z.infer<typeof plannerProviderContext>;
export type PlannerProviderFailure = "disabled" | PlannerFailureCode;
export class PlannerProviderError extends Error {
  constructor(readonly code: PlannerProviderFailure) {
    super(`planner_${code}`);
    this.name = "PlannerProviderError";
  }
}

// Le statut HTTP du prestataire dit quoi faire : attendre (429), réessayer plus tard (5xx), ou prévenir (clé, modèle).
export const plannerHttpFailure = (status: number): PlannerFailureCode =>
  status === 429
    ? "saturated"
    : status >= 500
      ? "unavailable"
      : [400, 401, 403, 404].includes(status)
        ? "configuration"
        : "unavailable";
const plannerFetchFailure = (cause: unknown): PlannerFailureCode =>
  cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError") ? "timeout" : "unavailable";

/** Une étape franchie pendant la génération, pour l'écran qui attend. Aucun contenu, seulement l'avancée. */
export type PlannerProgress = { step: "context" | "model" | "checks" | "retry" };
export interface PlannerProvider {
  interpret(
    context: PlannerProviderContext,
    options?: { onProgress?: (progress: PlannerProgress) => void; onDelta?: (characters: number) => void },
  ): Promise<PlannerRichInterpretation>;
}

const clarification = (questions: PlannerRichInterpretation["questions"]): PlannerRichInterpretation => ({
  status: "clarification",
  sessions: [],
  assumptions: [],
  suggestions: [],
  questions,
});
const guardQuestion = (issue: PlannerGuardIssue, period: { from: string; to: string }) => {
  const field = issue === "session_count" ? ("other" as const) : issue === "missing_date" ? ("date" as const) : issue;
  const question = {
    date: m.aiPlanner.clarifyDate(period.from, period.to),
    missing_date: m.aiPlanner.clarifyDate(period.from, period.to),
    exercise: m.aiPlanner.clarifyExercise,
    target: m.aiPlanner.clarifyTarget,
    load: m.aiPlanner.clarifyLoad,
    session_count: m.aiPlanner.clarifySessionCount,
  }[issue];
  return { id: `guard-${issue}`, field, question, exerciseName: null, options: [] };
};

/**
 * Passe déterministe avant tout appel : un nom de mouvement absent de la bibliothèque devient une question
 * nommée, sans consommer d'appel au modèle. Mode « Mettre en forme » seulement.
 */
export function plannerUnknownQuestions(context: PlannerProviderContext): PlannerRichInterpretation | null {
  if (context.mode === "propose") return null;
  const unknown = plannerUnknownExerciseTerms(
    context.instructions.map(plannerCoachText).join("\n"),
    context.exercises,
    context.resolvedExercises,
  ).slice(0, 3);
  return unknown.length
    ? clarification(
        unknown.map((name, index) => ({
          id: `named-exercise-${index + 1}`,
          field: "exercise" as const,
          question: m.aiPlanner.unknownExercise(name),
          exerciseName: name,
          options: [],
        })),
      )
    : null;
}

// Une question sur un jour que la consigne nomme déjà, posée avec d'autres, ne sert qu'à faire confirmer : retirée.
function withoutDateConfirmation(value: PlannerRichInterpretation, context: PlannerProviderContext) {
  if (value.status !== "clarification" || value.questions.length < 2) return value;
  const text = context.instructions.map(plannerCoachText).join("\n");
  const references = plannerDateReferences(text, { today: context.today, period: context.period });
  const days = [...references.explicit.map((d) => d.iso), ...references.relative];
  const named =
    (days.length === 1 && days[0]! >= context.period.from && days[0]! <= context.period.to) ||
    (references.weekdayOnly && !days.length && !references.ranges.length);
  if (!named) return value;
  const questions = value.questions.filter((q) => q.field !== "date");
  return questions.length ? { ...value, questions } : value;
}

const CORRECTIONS = {
  citation:
    "Une citation ne se rattache pas à la consigne. Pour chaque exercice, recopie un extrait exact de la consigne ; si aucune fiche ne correspond au mouvement, pose une question field exercise avec exerciseName.",
  structure:
    "La structure était invalide. Le content de chaque bloc est un arbre ordonné : exercise, recovery pour une pause, repeat pour des tours, deux niveaux au plus. Les séries simples restent un seul exercise avec sets.",
  missing_date: "Ta réponse omet un jour cité dans la consigne. Refais-la avec une séance pour chaque jour cité.",
  exercise:
    "Un exercice de ta réponse n'est pas nommé dans la consigne. Ne remplace aucun mouvement : choisis la fiche nommée, ou pose une question field exercise avec exerciseName.",
};

// Adaptateur sans écriture : quotas, droits, reprises et confirmations restent dans les services appelants.
export function openAiPlannerProvider(fetcher: typeof fetch = fetch): PlannerProvider {
  return {
    async interpret(raw, options = {}) {
      const settings = env();
      if (!plannerServerEnabled(settings)) throw new PlannerProviderError("disabled");
      const key = settings.OPENAI_API_KEY ?? settings.OPEN_AI_API_KEY;
      if (!key) throw new PlannerProviderError("configuration");
      const parsed = plannerProviderContext.safeParse(raw);
      if (!parsed.success) throw new PlannerProviderError("configuration");
      const context = parsed.data;
      const propose = context.mode === "propose";
      if (propose && !context.brief) throw new PlannerProviderError("configuration");
      if (
        new Set(context.targets.map((t) => t.token)).size !== context.targets.length ||
        new Set(context.exercises.map((e) => e.token)).size !== context.exercises.length
      )
        throw new PlannerProviderError("configuration");
      try {
        new Intl.DateTimeFormat("fr-FR", { timeZone: context.timeZone });
      } catch {
        throw new PlannerProviderError("configuration");
      }
      options.onProgress?.({ step: "context" });
      if (propose) {
        context.exercises = context.exercises.filter((exercise) =>
          plannerEquipmentAvailable(exercise.classification, context.brief?.equipment ?? []),
        );
        if (!context.exercises.length)
          return clarification([
            {
              id: "equipment",
              field: "exercise",
              question: m.aiPlanner.clarifyEquipment,
              exerciseName: null,
              options: [],
            },
          ]);
      }
      const unknown = plannerUnknownQuestions(context);
      if (unknown) return unknown;
      const ambiguousTerms = ambiguousExerciseTerms(context.exercises).filter((term) =>
        term.exerciseTokens.every(
          (exerciseToken) =>
            unresolvedExerciseAlias(
              context.instructions.join("\n"),
              exerciseToken,
              context.exercises,
              context.resolvedExercises,
            ) !== null,
        ),
      );
      const generationSchema = propose ? plannerProposeGeneration : plannerGeneration;
      const { $schema: _schema, ...schema } = generationSchema.toJSONSchema({
        override: ({ zodSchema, jsonSchema }) => {
          if (propose && zodSchema === plannerPrescription.shape.load) {
            for (const property of Object.keys(jsonSchema)) delete jsonSchema[property];
            jsonSchema.type = "null";
          }
          if (zodSchema === plannerItem.shape.exerciseToken)
            jsonSchema.enum = context.exercises.map((exercise) => exercise.token);
          // Literal discriminators keep the branches disjoint. OpenAI supports anyOf, not oneOf.
          if (zodSchema instanceof z.ZodDiscriminatedUnion && jsonSchema.oneOf) {
            jsonSchema.anyOf = jsonSchema.oneOf;
            delete jsonSchema.oneOf;
          }
        },
      });
      const { phaseCalendar, ...visible } = context;
      const input = propose
        ? {
            brief: context.brief,
            targets: context.targets,
            exercises: context.exercises,
            instructions: context.instructions,
            ...(context.previous ? { previous: context.previous } : {}),
          }
        : {
            ...visible,
            ...(phaseCalendar?.length ? { phaseCalendar } : {}),
            ambiguousExerciseTerms: ambiguousTerms,
            dateHints: plannerDateHints(context.today, context.period),
          };
      // Les modèles GPT-5 refusent ce réglage ; les autres gagnent en constance.
      const determinism = settings.AI_PLANNER_MODEL.startsWith("gpt-4") ? { temperature: 0 } : {};
      const deadline = AbortSignal.timeout(100000);
      let attempts = 0;
      const known = {
        tokens: (context.previous?.sessions ?? []).flatMap((session) =>
          session.blocks.flatMap((block) => tokensIn(block.content)),
        ),
        loads: (context.previous?.sessions ?? []).flatMap((session) =>
          session.blocks.flatMap((block) => loadsIn(block.content)),
        ),
      };
      const guardContext = { ...context, known };

      const call = async (correction?: string): Promise<unknown> => {
        options.onProgress?.({ step: correction ? "retry" : "model" });
        let response: Response;
        try {
          response = await fetcher("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            signal: deadline,
            body: JSON.stringify({
              model: settings.AI_PLANNER_MODEL,
              store: false,
              ...determinism,
              instructions: propose ? proposePrompt : formatPrompt,
              input: JSON.stringify({ ...input, ...(correction ? { correction } : {}) }),
              max_output_tokens: 12000,
              text: { format: { type: "json_schema", name: "tartan_planner", strict: true, schema } },
            }),
          });
        } catch (cause) {
          throw new PlannerProviderError(plannerFetchFailure(cause));
        }
        // Ne jamais inclure le corps d’erreur, une clé ou le texte du coach dans une exception/journal.
        if (!response.ok) throw new PlannerProviderError(plannerHttpFailure(response.status));
        let result: {
          status?: string;
          output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
        } | null;
        try {
          result = await response.json();
        } catch (cause) {
          if (deadline.aborted) throw new PlannerProviderError(plannerFetchFailure(cause));
          throw new PlannerProviderError("invalid_output");
        }
        if (!result) throw new PlannerProviderError("invalid_output");
        if (result.status === "incomplete") throw new PlannerProviderError("incomplete");
        if (result.status !== "completed") throw new PlannerProviderError("unavailable");
        if (!Array.isArray(result.output)) throw new PlannerProviderError("invalid_output");
        const parts = result.output
          .filter((item) => item?.type === "message")
          .flatMap((item) => (Array.isArray(item.content) ? item.content : []));
        if (parts.some((part) => part?.type === "refusal")) throw new PlannerProviderError("refused");
        const texts = parts.filter((part) => part?.type === "output_text");
        if (texts.length !== 1 || typeof texts[0]?.text !== "string") throw new PlannerProviderError("invalid_output");
        options.onDelta?.(texts[0].text.length);
        try {
          return JSON.parse(texts[0].text);
        } catch {
          throw new PlannerProviderError("invalid_output");
        }
      };

      // Au plus deux appels par demande : une seule correction, quel que soit le nombre de défauts.
      const attempt = async (correction?: string): Promise<PlannerRichInterpretation> => {
        if (++attempts > 2) throw new PlannerProviderError("invalid_output");
        const output = await call(correction);
        options.onProgress?.({ step: "checks" });
        const retry = async (reason: string, fallback: () => PlannerRichInterpretation) => {
          if (correction) return fallback();
          try {
            return await attempt(reason);
          } catch (cause) {
            if (!(cause instanceof PlannerProviderError) || cause.code !== "invalid_output") throw cause;
            return fallback();
          }
        };
        const request = {
          date: context.brief?.date ?? context.period.from,
          startTime: context.startTime ?? null,
          targetTokens: context.targets.map((target) => target.token),
        };
        const generated = (propose ? plannerProposeGeneration : plannerGeneration).safeParse(output);
        // Une réponse déjà à plat (séances et exercices, sans arbre) reste lisible : c'est l'ancienne forme.
        const flat = generated.success ? null : plannerRichInterpretation.safeParse(output);
        if (!generated.success && !flat?.success) return retry(CORRECTIONS.structure, () => invalid());
        let value: PlannerRichInterpretation = generated.success
          ? propose
            ? plannerProposeGenerationToInterpretation(generated.data as PlannerProposeGeneration, request)
            : plannerGenerationToInterpretation(generated.data as PlannerGeneration)
          : flat!.data!;
        if (propose) {
          // La date, l'heure, les destinataires et la durée disponible sont ceux du coach, jamais ceux du modèle.
          const brief = context.brief!;
          value = {
            ...value,
            sessions: value.sessions.map((session) => ({
              ...session,
              ...request,
              durationMin: Math.min(session.durationMin ?? brief.durationMin, brief.durationMin),
            })),
          };
        }
        value = plannerDropEmptyPercentages(value);
        value = { ...value, questions: plannerDistinctQuestions(value.questions) };
        if (value.status === "clarification" && value.questions.length && !value.sessions.length)
          return withoutDateConfirmation(value, context);
        // Une proposition sans séance ni question n'est pas une panne : le coach reçoit une question, pas une erreur.
        if (value.status === "proposal" && !value.sessions.length && !value.questions.length)
          return clarification([
            {
              id: "empty-proposal",
              field: "other",
              question: m.aiPlanner.clarifyEmpty,
              exerciseName: null,
              options: [],
            },
          ]);
        // Une citation altérée est restaurée ; une perte de mouvement se corrige une fois, puis devient une question.
        if (!propose) {
          const grounded = groundPlannerCitations(value, context);
          if (grounded.removed)
            return retry(CORRECTIONS.citation, () => clarification([guardQuestion("exercise", context.period)]));
          value = grounded.value;
        }
        const validation: PlannerValidationContext = {
          mode: context.mode,
          brief: context.brief,
          period: context.period,
          reviewedInstructions: context.instructions,
          targetTokens: new Set(context.targets.map((target) => target.token)),
          // Seul le service sait transformer ces jetons en UUID après une nouvelle vérification des droits.
          exercises: new Map(
            context.exercises.map((exercise) => [
              exercise.token,
              { id: exercise.token, classification: exercise.classification },
            ]),
          ),
        };
        const checked = validatePlannerInterpretation(value, validation);
        if (!checked.ok) {
          // Une date ou un destinataire hors périmètre n'est jamais créé ni remplacé : le coach tranche.
          if (checked.issues.every((issue) => issue === "date" || issue === "target"))
            return clarification(
              checked.issues.map((issue) => ({
                id: `scope-${issue}`,
                field: issue === "date" ? ("date" as const) : ("target" as const),
                question:
                  issue === "date"
                    ? m.aiPlanner.clarifyAllowedDate(context.period.from, context.period.to)
                    : m.aiPlanner.clarifyAllowedTarget,
                exerciseName: null,
                options: [],
              })),
            );
          // Seul un arbre mal formé mérite une correction ; un état incohérent est inexploitable.
          if (value.sessions.some((session) => session.blocks.some((block) => block.sequence)))
            return retry(CORRECTIONS.structure, () => invalid());
          return invalid();
        }
        value = checked.value;
        // Défauts bloquants : une correction, puis une question. Jamais une séance douteuse.
        const blocking = propose
          ? plannerProposalIssues(value, { brief: context.brief })
          : plannerGuardIssues(value, guardContext);
        if (blocking.length) {
          const reason = blocking.includes("missing_date")
            ? CORRECTIONS.missing_date
            : blocking.includes("exercise")
              ? CORRECTIONS.exercise
              : null;
          const ask = () =>
            clarification(plannerDistinctQuestions(blocking.map((issue) => guardQuestion(issue, context.period))));
          return reason ? retry(reason, ask) : ask();
        }
        if (!propose && (ambiguousExerciseTerms(context.exercises).length || context.resolvedExercises?.length))
          for (const session of value.sessions)
            for (const block of session.blocks)
              for (const item of block.items) {
                const collision = unresolvedExerciseAlias(
                  [item.instruction, ...context.instructions.slice(1)].join("\n"),
                  item.exerciseToken,
                  context.exercises,
                  context.resolvedExercises,
                );
                if (collision)
                  return clarification([
                    {
                      id: "exercise-alias",
                      field: "exercise",
                      question: m.aiPlanner.ambiguousAlias(collision.term),
                      exerciseName: null,
                      options: [
                        ...new Set(
                          context.exercises
                            .filter((e) => collision.exerciseTokens.includes(e.token))
                            .map((e) => e.name),
                        ),
                      ].slice(0, 5),
                    },
                  ]);
              }
        // Points « À vérifier » : la séance passe, chaque point est rattaché à son exercice.
        const warnings = propose ? value.sessions.map(() => []) : plannerWarnings(value, guardContext);
        return plannerRichInterpretation.parse({
          ...value,
          sessions: value.sessions.map((session, index) => ({ ...session, warnings: warnings[index] ?? [] })),
        });
      };
      return attempt();
    },
  };
}

const invalid = (): never => {
  throw new PlannerProviderError("invalid_output");
};
type Content = z.infer<typeof plannerGeneration>["sessions"][number]["blocks"][number]["content"];
const tokensIn = (nodes: Content): string[] =>
  nodes.flatMap((node) =>
    node.kind === "exercise"
      ? [node.exerciseToken, ...(node.autonomous ? [node.autonomous.exerciseToken] : [])]
      : node.kind === "repeat"
        ? tokensIn(node.children as Content)
        : [],
  );
const loadsIn = (nodes: Content): number[] =>
  nodes.flatMap((node) => {
    if (node.kind === "repeat") return loadsIn(node.children as Content);
    if (node.kind !== "exercise") return [];
    return [node.prescription, ...(node.autonomous ? [node.autonomous.prescription] : [])].flatMap((p) => [
      ...(p.load ? [p.load.value] : []),
      ...(p.setPlan ?? []).flatMap((set) => (set.load ? [set.load.value] : [])),
    ]);
  });
