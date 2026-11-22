import "server-only";
import { plannerUnderstanding } from "@tartan/contracts";
import {
  plannerCoachText,
  plannerDateHints,
  plannerNormalizeUnderstanding,
  type PlannerRequest,
  type PlannerRequestHints,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { plannerStep } from "./step";
import type { PlannerProvider, PlannerProviderContext, PlannerUnderstandInput } from "./types";

/** Le résumé déjà lisible dans le texte encore incomplet du modèle : il est écrit en premier. */
export function plannerSummaryPreview(text: string): string | null {
  const match = /"summary"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(text);
  if (!match?.[1]) return null;
  // Un échappement coupé en fin de morceau est retiré : rien n'est deviné.
  const raw = match[1].replace(/\\(?:u[0-9a-fA-F]{0,3})?$/, "");
  try {
    return (JSON.parse(`"${raw}"`) as string).slice(0, 2000);
  } catch {
    return null;
  }
}

/**
 * Les indices : le mode et le brief des clients d'avant le champ unique, ou les précisions facultatives de
 * l'écran. Ils ne décident de rien : la demande l'emporte.
 */
export const plannerHints = (context: PlannerProviderContext): PlannerRequestHints => ({
  intent: context.mode === "propose" ? "objective" : null,
  date: context.brief?.date ?? context.day ?? null,
  startTime: context.startTime ?? null,
  durationMin: context.brief?.durationMin ?? context.hints?.durationMin ?? null,
  level: context.brief?.level ?? context.hints?.level ?? null,
  equipment: context.brief ? context.brief.equipment : (context.hints?.equipment ?? null),
});

/** Le texte du coach, sans les questions du planificateur : la consigne, puis ses réponses. */
export const plannerCoachTexts = (context: PlannerProviderContext) =>
  context.instructions
    .map(plannerCoachText)
    .map((text) => text.replace(m.aiPlanner.adjustmentPrefix, "").trim())
    .filter(Boolean);

/**
 * Étape 1, « Comprendre » : le modèle rapide lit la demande, sans la bibliothèque. Sa lecture est ensuite
 * vérifiée par règles : dates, destinataires, mouvements. Ce qui manque devient un blocage nommé.
 */
export async function understandRequest(
  context: PlannerProviderContext,
  provider: PlannerProvider,
  deadline: AbortSignal,
  onSummary?: (summary: string | null, done: boolean) => void,
): Promise<PlannerRequest> {
  const texts = plannerCoachTexts(context);
  const adjusting = Boolean(context.previous);
  const hints = plannerHints(context);
  const dates = plannerDateHints(context.today, context.period);
  const request = adjusting ? texts.at(-1)! : texts[0]!;
  const input: PlannerUnderstandInput = {
    today: context.today,
    todayWeekday: dates.todayWeekday,
    calendar: dates.days,
    relative: {
      hier: dates.relative.hier,
      aujourdHui: dates.relative.aujourdHui,
      demain: dates.relative.demain,
      apresDemain: dates.relative.apresDemain,
    },
    recipients: context.targets.map((target) => ({ token: target.token, kind: target.kind })),
    recipientsChosen: context.targetsChosen !== false,
    request,
    followUps: adjusting ? [] : texts.slice(1),
    adjusting,
    hints: {
      intent: hints.intent ?? null,
      date: hints.date ?? null,
      durationMin: hints.durationMin ?? null,
      level: hints.level ?? null,
      equipment: hints.equipment ? [...hints.equipment] : null,
    },
  };
  onSummary?.(null, false);
  let written = "";
  let shown: string | null = null;
  const understood = await plannerStep("understand", deadline, plannerUnderstanding, (signal) =>
    provider.understand(input, {
      signal,
      ...(onSummary
        ? {
            onDelta: (delta: string) => {
              written += delta;
              const preview = plannerSummaryPreview(written);
              if (preview && preview !== shown) onSummary((shown = preview), false);
            },
          }
        : {}),
    }),
  );
  const normalized = plannerNormalizeUnderstanding(understood, {
    // Un ajustement ne se lit que dans son propre texte : la consigne d'origine est déjà dans la séance.
    text: adjusting ? request : texts.join("\n"),
    today: context.today,
    period: context.period,
    targets: context.targets,
    targetsChosen: context.targetsChosen !== false,
    hints,
    spaceEquipment: context.space?.equipment ?? [],
  });
  onSummary?.(normalized.summary, true);
  return normalized;
}
