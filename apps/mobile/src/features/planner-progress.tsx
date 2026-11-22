import { m } from "@tartan/i18n";
import { useEffect } from "react";
import { AccessibilityInfo, ActivityIndicator, View } from "react-native";
import { PLANNER_PROGRESS_STEPS, plannerCurrentStep, type PlannerStreamState } from "../lib/planner-stream";
import { Check } from "../ui/icons";
import { SectionTitle, T } from "../ui/primitives";
import { space, usePalette } from "../ui/theme";

const t = m.aiPlanner.screen;

/**
 * Pendant la génération : ce que le planificateur a compris, à mesure qu'il l'écrit, ses étapes, puis le plan de la
 * séance. Chaque étape se lit en mots (faite, en cours) ; la roue système est la seule chose qui bouge.
 */
export function NativePlannerProgress({ state }: { state: PlannerStreamState }) {
  const p = usePalette();
  const current = plannerCurrentStep(state);
  const steps = state.steps.includes("retry") ? [...PLANNER_PROGRESS_STEPS, "retry" as const] : PLANNER_PROGRESS_STEPS;
  // Le lecteur d'écran entend chaque étape quand elle commence, sans relire tout l'écran.
  useEffect(() => {
    if (current) AccessibilityInfo.announceForAccessibility(t.stepCurrent(t.steps[current]));
  }, [current]);
  return (
    <View style={{ gap: space.lg }}>
      {/* Une fois la génération finie, le résumé est celui de la proposition, affiché au-dessus. */}
      {state.summary && state.running ? (
        <View style={{ gap: space.xs }}>
          <SectionTitle>{t.understood}</SectionTitle>
          <T testID="planner-understood">{state.summary}</T>
        </View>
      ) : null}
      <View style={{ gap: space.sm }}>
        {steps.map((step) => {
          const done = state.steps.includes(step) && step !== current;
          const now = step === current;
          const label = t.steps[step];
          return (
            <View
              key={step}
              accessible
              accessibilityLabel={done ? t.stepDone(label) : now ? t.stepCurrent(label) : label}
              style={{ flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 28 }}
            >
              <View style={{ width: 20, alignItems: "center" }}>
                {done ? (
                  <Check size={18} color={p.text} />
                ) : now ? (
                  <ActivityIndicator size="small" color={p.text} />
                ) : null}
              </View>
              <T variant={now ? "bodyStrong" : "body"} tone={done || now ? "default" : "muted"}>
                {label}
              </T>
            </View>
          );
        })}
      </View>
      {state.plan.length ? (
        <View style={{ gap: space.xs }}>
          <T variant="smallStrong">{t.planTitle}</T>
          {state.plan.map((line, index) => (
            <T
              key={`${index}-${line.label}`}
              variant={line.kind === "block" ? "smallStrong" : "small"}
              tone={line.kind === "block" ? "default" : "muted"}
              style={line.kind === "exercise" ? { paddingLeft: space.md } : undefined}
            >
              {line.label}
            </T>
          ))}
        </View>
      ) : null}
      {state.running ? (
        <T variant="small" tone="muted">
          {t.closedApp}
        </T>
      ) : null}
    </View>
  );
}
