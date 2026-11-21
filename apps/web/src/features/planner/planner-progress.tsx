"use client";

import type { PlannerStreamStep } from "@tartan/contracts";
import { w } from "@tartan/i18n/web";
import { Check, Dumbbell, Layers } from "lucide-react";
import { TrackLine } from "@/components/track";
import { cn } from "@/lib/cn";
import type { PlannerStreamState } from "./use-planner-stream";

const t = w.planner;
const ORDER: PlannerStreamStep[] = ["context", "model", "checks", "saved"];

/**
 * La génération en direct : les étapes franchies, puis le plan de la séance à mesure que le modèle l'écrit.
 * Le plan ne montre que des noms de blocs et de fiches ; la séance complète arrive avec la proposition.
 */
export function PlannerProgress({ state }: { state: PlannerStreamState }) {
  const reached = ORDER.filter((step) => state.steps.includes(step));
  const current = state.running ? (ORDER.find((step) => !state.steps.includes(step)) ?? "saved") : null;
  return (
    <section aria-label={t.preparing} aria-busy={state.running} className="flex min-w-0 flex-col gap-4">
      <ol className="flex flex-col gap-2" aria-live="polite">
        {ORDER.map((step) => {
          const done = reached.includes(step) && step !== current;
          const active = step === current;
          if (!done && !active) return null;
          return (
            <li key={step} className="flex min-h-8 items-center gap-3">
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                  done ? "border-accent bg-accent text-on-accent" : "border-control-line",
                )}
              >
                {done ? <Check className="size-4" /> : <span className="size-2 rounded-full bg-accent" />}
              </span>
              <span className={cn(done ? "text-soft" : "font-semibold")}>
                {step === "checks" && state.steps.includes("retry") ? t.steps.retry : t.steps[step]}
              </span>
            </li>
          );
        })}
      </ol>
      {state.plan.length ? (
        <div className="flex min-w-0 flex-col gap-2">
          <TrackLine trace />
          <h3 className="font-semibold">{t.planTitle}</h3>
          <ul className="flex flex-col gap-1">
            {state.plan.map((line, index) => (
              <li
                key={`${index}-${line.label}`}
                className={cn(
                  "plan-line-enter flex min-w-0 items-center gap-2 break-words",
                  line.kind === "block" ? "pt-2 font-semibold" : "pl-6 text-soft",
                )}
              >
                {line.kind === "block" ? (
                  <Layers aria-hidden className="size-4 shrink-0" />
                ) : (
                  <Dumbbell aria-hidden className="size-4 shrink-0" />
                )}
                {line.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.running ? <p className="t-caption text-soft">{t.closedTab}</p> : null}
    </section>
  );
}
