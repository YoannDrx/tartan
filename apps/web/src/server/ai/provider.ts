import "server-only";
import { z } from "zod";
import {
  isoDate,
  plannerComposedSession,
  plannerComposition,
  plannerItem,
  plannerMatchGeneration,
  plannerUnderstanding,
  plannerUnderstoodSession,
  type PlannerFailureCode,
  type PlannerStepName,
} from "@tartan/contracts";
import { plannerServerEnabled } from "@tartan/domain";
import { env, type Env } from "@/lib/env";
import { composePrompt, matchPrompt, repairPrompt, understandPrompt } from "./pipeline/prompts";
import {
  PlannerProviderError,
  type PlannerComposeInput,
  type PlannerMatchInput,
  type PlannerProvider,
  type PlannerStepOptions,
} from "./pipeline/types";

export {
  plannerProviderContext,
  PlannerProviderError,
  type PlannerProvider,
  type PlannerProviderContext,
  type PlannerProviderFailure,
} from "./pipeline/types";

// Adaptateur OpenAI : une fonction typée par étape, et rien d'autre. Il met en forme la demande (consigne,
// schéma strict, modèle, effort de raisonnement), l'envoie, lit la réponse et la rend dans le type de l'étape.
// Aucun contrôle métier ne vit ici : les règles de `packages/domain` s'appliquent ensuite à tout prestataire.
// Aucune écriture : quotas, droits, reprises et confirmations restent dans les services appelants.

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

// Les modèles d'avant GPT-5 ne raisonnent pas : ils reçoivent une température nulle, les autres un effort.
const reasons = (model: string) => !/^gpt-4/.test(model);
// Seuls les modèles rapides de la gamme GPT-6 (Luna, Terra) acceptent `none` ; Sol et Astra le refusent (HTTP 400)
// et reçoivent `low` à la place. Source : pages des modèles et guide « Reasoning », lus le 21 novembre 2026.
const effortFor = (model: string, effort: string) =>
  effort === "none" && !/^gpt-6[.\d]*-(?:luna|terra)/.test(model) ? "low" : effort;
// Les repères de cache explicites existent depuis GPT-5.6 ; les modèles d'avant mettent en cache d'eux-mêmes.
const explicitCache = (model: string) => /^gpt-(?:5\.[6-9]|[6-9])/.test(model);
/** Le modèle et l'effort de chaque étape : rapide pour comprendre et retrouver, principal pour composer et réparer. */
export const plannerStepSettings = (settings: Env, step: PlannerStepName) => {
  const model =
    step === "understand" || step === "match" ? settings.AI_PLANNER_FAST_MODEL : settings.AI_PLANNER_MODEL;
  const effort = {
    understand: settings.AI_PLANNER_UNDERSTAND_EFFORT,
    match: settings.AI_PLANNER_MATCH_EFFORT,
    compose: settings.AI_PLANNER_COMPOSE_EFFORT,
    repair: settings.AI_PLANNER_REPAIR_EFFORT,
  }[step];
  return { model, effort: effortFor(model, effort) };
};
// Jetons de sortie, raisonnement compris : une compréhension ou un rapprochement restent courts.
const MAX_OUTPUT: Record<PlannerStepName, number> = { understand: 6000, match: 4000, compose: 16000, repair: 16000 };
// Une saturation (429) est rejouée deux fois, après l'attente demandée par le fournisseur, avant de devenir une
// panne lisible : la limite de jetons par minute du compte se libère en quelques secondes.
const SATURATION_RETRIES = 2;
const MAX_WAIT_MS = 8000;

type Custom = (zodSchema: unknown, jsonSchema: Record<string, unknown>) => void;
const strictSchema = (schema: z.ZodType, custom: Custom, reused: "inline" | "ref" = "inline") => {
  const { $schema: _schema, ...rest } = schema.toJSONSchema({
    // Une séance répète la même prescription à chaque niveau de l'arbre : écrite une fois et citée par référence,
    // elle pèse trois fois moins de jetons d'entrée.
    reused,
    override: ({ zodSchema, jsonSchema }) => {
      custom(zodSchema, jsonSchema as Record<string, unknown>);
      // Les discriminants littéraux gardent les branches disjointes. OpenAI lit anyOf, pas oneOf.
      if (zodSchema instanceof z.ZodDiscriminatedUnion && jsonSchema.oneOf) {
        jsonSchema.anyOf = jsonSchema.oneOf;
        delete jsonSchema.oneOf;
      }
    },
  });
  return rest;
};

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new PlannerProviderError("timeout"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new PlannerProviderError("timeout"));
      },
      { once: true },
    );
  });
// L'attente demandée par le fournisseur, bornée : une demande ne reste jamais suspendue à un en-tête.
const retryDelay = (response: Response, attempt: number) => {
  const ms = Number(response.headers.get("retry-after-ms"));
  const seconds = Number(response.headers.get("retry-after"));
  const asked = ms > 0 ? ms : seconds > 0 ? seconds * 1000 : 1500 * (attempt + 1);
  return Math.min(MAX_WAIT_MS, Math.max(10, asked));
};

type Call = {
  step: PlannerStepName;
  name: string;
  prompt: string;
  // Partie stable de l'entrée (la bibliothèque), placée avant la demande pour rester en cache chez le fournisseur.
  reference?: string;
  input: unknown;
  schema: Record<string, unknown>;
  options: PlannerStepOptions;
};

export function openAiPlannerProvider(fetcher: typeof fetch = fetch): PlannerProvider {
  const call = async ({ step, name, prompt, reference, input, schema, options }: Call): Promise<unknown> => {
    const settings = env();
    if (!plannerServerEnabled(settings)) throw new PlannerProviderError("disabled", step);
    const key = settings.OPENAI_API_KEY ?? settings.OPEN_AI_API_KEY;
    if (!key) throw new PlannerProviderError("configuration", step);
    const { model, effort } = plannerStepSettings(settings, step);
    // Cache du fournisseur : seule la partie stable (consignes, puis bibliothèque) est mise en cache, par un
    // repère explicite à sa fin. Sans cela, GPT-5.6 et suivants écrivent en cache toute l'entrée de chaque demande,
    // facturée 1,25 fois, alors que la demande du coach ne se relit jamais (guide « Prompt caching »).
    const cached = explicitCache(model);
    const stable = [prompt, ...(reference ? [reference] : [])];
    const body = JSON.stringify({
      model,
      store: false,
      // Consignes stables d'abord, en messages `developer` : GPT-6.2 ajoute le champ `instructions` après
      // l'entrée, hors du préfixe mis en cache.
      input: [
        ...stable.map((text, index) => ({
          role: "developer",
          content:
            cached && index === stable.length - 1
              ? [{ type: "input_text", text, prompt_cache_breakpoint: { mode: "explicit" } }]
              : text,
        })),
        { role: "user", content: JSON.stringify(input) },
      ],
      ...(cached ? { prompt_cache_options: { mode: "explicit" } } : {}),
      ...(reasons(model) ? { reasoning: { effort } } : { temperature: 0 }),
      max_output_tokens: MAX_OUTPUT[step],
      text: { format: { type: "json_schema", name, strict: true, schema } },
      // Diffusé quand l'écran attend : le résumé puis la séance apparaissent pendant qu'ils s'écrivent.
      ...(options.onDelta ? { stream: true } : {}),
    });
    let response: Response;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await fetcher("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          signal: options.signal,
          body,
        });
      } catch (cause) {
        throw new PlannerProviderError(plannerFetchFailure(cause), step);
      }
      if (response.status !== 429 || attempt >= SATURATION_RETRIES) break;
      await wait(retryDelay(response, attempt), options.signal);
    }
    // Ne jamais inclure le corps d'erreur, une clé ou le texte du coach dans une exception ou un journal.
    if (!response.ok) throw new PlannerProviderError(plannerHttpFailure(response.status), step);
    let result: ProviderResult | null;
    try {
      result = options.onDelta ? await readStream(response, options.onDelta) : await response.json();
    } catch (cause) {
      if (cause instanceof PlannerProviderError) throw new PlannerProviderError(cause.code, step);
      if (options.signal?.aborted) throw new PlannerProviderError("timeout", step);
      throw new PlannerProviderError("invalid_output", step);
    }
    if (!result) throw new PlannerProviderError("invalid_output", step);
    if (result.status === "incomplete") throw new PlannerProviderError("incomplete", step);
    if (result.status !== "completed") throw new PlannerProviderError("unavailable", step);
    if (!Array.isArray(result.output)) throw new PlannerProviderError("invalid_output", step);
    const parts = result.output
      .filter((item) => item?.type === "message")
      .flatMap((item) => (Array.isArray(item.content) ? item.content : []));
    if (parts.some((part) => part?.type === "refusal")) throw new PlannerProviderError("refused", step);
    const texts = parts.filter((part) => part?.type === "output_text");
    if (texts.length !== 1 || typeof texts[0]?.text !== "string") throw new PlannerProviderError("invalid_output", step);
    try {
      return JSON.parse(texts[0].text);
    } catch {
      throw new PlannerProviderError("invalid_output", step);
    }
  };
  const typed = <T>(schema: z.ZodType<T>, step: PlannerStepName, output: unknown): T => {
    const parsed = schema.safeParse(output);
    if (!parsed.success) throw new PlannerProviderError("invalid_output", step);
    return parsed.data;
  };
  // La séance ne peut citer que les fiches et les emplacements donnés, et que les séances de la compréhension.
  const compositionSchema = (input: PlannerComposeInput) =>
    strictSchema(
      plannerComposition,
      (zodSchema, jsonSchema) => {
        if (zodSchema === plannerItem.shape.exerciseToken)
          jsonSchema.enum = [
            ...input.exercises.map((exercise) => exercise.token),
            ...input.slots.map((s) => s.token),
          ];
        if (zodSchema === plannerComposedSession.shape.index)
          jsonSchema.enum = input.understanding.sessions.map((session) => session.index);
      },
      "ref",
    );
  return {
    async understand(input, options = {}) {
      const schema = strictSchema(plannerUnderstanding, (zodSchema, jsonSchema) => {
        // Une date hors du calendrier ne peut pas s'écrire : aucune date n'est inventée dès cette étape.
        if (zodSchema === isoDate) jsonSchema.enum = input.calendar.map((day) => day.date);
        if (zodSchema === plannerUnderstoodSession.shape.targetTokens.element && input.recipients.length)
          jsonSchema.enum = input.recipients.map((recipient) => recipient.token);
      });
      return typed(
        plannerUnderstanding,
        "understand",
        await call({ step: "understand", name: "tartan_understanding", prompt: understandPrompt, input, schema, options }),
      );
    },
    async match(input, options = {}) {
      return typed(
        plannerMatchGeneration,
        "match",
        await call({
          step: "match",
          name: "tartan_matches",
          prompt: matchPrompt,
          reference: libraryLines(input.library),
          input: { movements: input.movements },
          schema: strictSchema(plannerMatchGeneration, () => undefined),
          options,
        }),
      );
    },
    async compose(input, options = {}) {
      return typed(
        plannerComposition,
        "compose",
        await call({
          step: "compose",
          name: "tartan_session",
          prompt: composePrompt,
          input,
          schema: compositionSchema(input),
          options,
        }),
      );
    },
    async repair(input, options = {}) {
      return typed(
        plannerComposition,
        "repair",
        await call({
          step: "repair",
          name: "tartan_session",
          prompt: repairPrompt,
          input,
          schema: compositionSchema(input),
          options,
        }),
      );
    },
  };
}

/** La bibliothèque donnée au modèle : une ligne par fiche, cinq champs, rien d'autre. */
export const libraryLines = (library: PlannerMatchInput["library"]) =>
  [
    "Fiches (clé | nom | alias | famille | matériel) :",
    ...library.map((entry) =>
      [
        entry.key,
        entry.name,
        entry.aliases.join(", ") || "-",
        entry.family ?? "-",
        entry.equipment === null ? "?" : entry.equipment.join(", ") || "aucun",
      ].join(" | "),
    ),
  ].join("\n");

type ProviderResult = {
  status?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
};
/**
 * Lit la réponse diffusée du prestataire : chaque morceau de texte part vers l'écran, la réponse complète
 * (statut, sortie) est rendue à la fin comme une réponse ordinaire. Aucun contenu d'erreur n'est repris.
 */
async function readStream(response: Response, onDelta: (text: string) => void): Promise<ProviderResult | null> {
  if (!response.body) throw new PlannerProviderError("invalid_output");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let final: ProviderResult | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    const events = buffer.split("\n\n");
    buffer = done ? "" : events.pop()!;
    for (const event of events) {
      const data = event
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");
      if (!data || data === "[DONE]") continue;
      let parsed: { type?: string; delta?: unknown; response?: ProviderResult; error?: { code?: string } };
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (parsed.type === "response.output_text.delta" && typeof parsed.delta === "string") onDelta(parsed.delta);
      else if (
        parsed.type === "response.completed" ||
        parsed.type === "response.incomplete" ||
        parsed.type === "response.failed"
      )
        final = parsed.response ?? null;
      else if (parsed.type === "error")
        throw new PlannerProviderError(parsed.error?.code === "rate_limit_exceeded" ? "saturated" : "unavailable");
    }
    if (done) break;
  }
  return final;
}
