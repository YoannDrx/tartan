import "server-only";
import { z } from "zod";
import {
  plannerComposition,
  plannerMatchJudgement,
  plannerUnderstanding,
  type PlannerFailureCode,
  type PlannerStepName,
} from "@tartan/contracts";
import { plannerMatchVerdict, plannerServerEnabled } from "@tartan/domain";
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
/**
 * Le modèle et l'effort de chaque étape : rapide pour comprendre et retrouver, principal pour réparer. Composer
 * dépend de la demande : une demande seulement décrite (rien à proposer) n'est qu'une mise en forme, confiée au
 * modèle de `AI_PLANNER_DESCRIBED_MODEL` (par défaut le rapide) ; dès qu'une partie est à proposer, le principal.
 */
export const plannerStepSettings = (settings: Env, step: PlannerStepName, described = false) => {
  const model =
    step === "understand" || step === "match"
      ? settings.AI_PLANNER_FAST_MODEL
      : step === "compose" && described
        ? (settings.AI_PLANNER_DESCRIBED_MODEL ?? settings.AI_PLANNER_FAST_MODEL)
        : settings.AI_PLANNER_MODEL;
  const effort = {
    understand: settings.AI_PLANNER_UNDERSTAND_EFFORT,
    match: settings.AI_PLANNER_MATCH_EFFORT,
    compose: settings.AI_PLANNER_COMPOSE_EFFORT,
    repair: settings.AI_PLANNER_REPAIR_EFFORT,
  }[step];
  return { model, effort: effortFor(model, effort) };
};
/**
 * Rien à proposer : la demande est seulement décrite, aucune séance n'a de partie à composer, et ce n'est pas un
 * ajustement (qui réécrit une séance déjà composée, propositions comprises).
 */
export const plannerOnlyDescribed = (input: PlannerComposeInput) =>
  input.understanding.intent === "described" &&
  input.understanding.sessions.every((session) => session.proposal === null) &&
  input.previous === null;
// Jetons de sortie, raisonnement compris : une compréhension ou un rapprochement restent courts.
const MAX_OUTPUT: Record<PlannerStepName, number> = { understand: 6000, match: 4000, compose: 16000, repair: 16000 };
// Une saturation (429) est rejouée deux fois, après l'attente demandée par le fournisseur, avant de devenir une
// panne lisible : la limite de jetons par minute du compte se libère en quelques secondes.
const SATURATION_RETRIES = 2;
const MAX_WAIT_MS = 8000;

const strictSchema = (schema: z.ZodType, reused: "inline" | "ref" = "inline") => {
  const { $schema: _schema, ...rest } = schema.toJSONSchema({
    // Une séance répète la même prescription à chaque niveau de l'arbre : écrite une fois et citée par référence,
    // elle pèse trois fois moins de jetons d'entrée.
    reused,
    override: ({ zodSchema, jsonSchema }) => {
      // Les discriminants littéraux gardent les branches disjointes. OpenAI lit anyOf, pas oneOf.
      if (zodSchema instanceof z.ZodDiscriminatedUnion && jsonSchema.oneOf) {
        jsonSchema.anyOf = jsonSchema.oneOf;
        delete jsonSchema.oneOf;
      }
    },
  });
  return rest;
};
// Un schéma par étape, le même pour toutes les demandes. Un schéma qui change d'une demande à l'autre (une liste
// de dates, de jetons de fiches) est recompilé par le fournisseur à chaque appel et sort l'entrée du cache : la
// mesure du 22 novembre 2026 ne lisait aucun jeton en cache à l'étape « Composer ». Ce que le schéma ne borne
// plus est vérifié par règles : date dans la période, destinataire connu (`plannerNormalizeUnderstanding`),
// fiche donnée au modèle, séance comprise (`plannerCompositionToInterpretation`).
const UNDERSTANDING_SCHEMA = strictSchema(plannerUnderstanding);
const MATCH_SCHEMA = strictSchema(plannerMatchJudgement);
const COMPOSITION_SCHEMA = strictSchema(plannerComposition, "ref");

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
  // Composer : la demande est seulement décrite (`plannerOnlyDescribed`).
  described?: boolean;
};

export function openAiPlannerProvider(fetcher: typeof fetch = fetch): PlannerProvider {
  const call = async ({ step, name, prompt, reference, input, schema, options, described }: Call): Promise<unknown> => {
    const settings = env();
    if (!plannerServerEnabled(settings)) throw new PlannerProviderError("disabled", step);
    const key = settings.OPENAI_API_KEY ?? settings.OPEN_AI_API_KEY;
    if (!key) throw new PlannerProviderError("configuration", step);
    const { model, effort } = plannerStepSettings(settings, step, described);
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
  return {
    async understand(input, options = {}) {
      return typed(
        plannerUnderstanding,
        "understand",
        await call({
          step: "understand",
          name: "tartan_understanding",
          prompt: understandPrompt,
          input,
          schema: UNDERSTANDING_SCHEMA,
          options,
        }),
      );
    },
    async match(input, options = {}) {
      // Le modèle dit la relation de chaque fiche au terme ; la confiance en découle par règle, jamais de lui.
      return plannerMatchVerdict(
        typed(
          plannerMatchJudgement,
          "match",
          await call({
            step: "match",
            name: "tartan_matches",
            prompt: matchPrompt,
            reference: libraryLines(input.library),
            input: { movements: input.movements },
            schema: MATCH_SCHEMA,
            options,
          }),
        ),
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
          schema: COMPOSITION_SCHEMA,
          options,
          described: plannerOnlyDescribed(input),
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
          schema: COMPOSITION_SCHEMA,
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
