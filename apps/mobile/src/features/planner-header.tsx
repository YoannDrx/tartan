import type { PlannerStepName, PlannerUsageResponse } from "@tartan/contracts";
import { plannerProposalsExhausted } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useEffect } from "react";
import { AccessibilityInfo, View } from "react-native";
import { T } from "../ui/primitives";
import { space } from "../ui/theme";

const t = m.aiPlanner.screen;

/**
 * Le haut de l'écran, aux deux temps : ce qui reste du quota, l'étape, et l'erreur du moment. Aucun prix ni offre : un quota atteint le dit, sans lien.
 */
export function PlannerHeader({
  usage,
  stage,
  error,
  step,
}: {
  usage: PlannerUsageResponse;
  stage: 1 | 2;
  error: string;
  step?: PlannerStepName | null;
}) {
  const exhausted = plannerProposalsExhausted(usage);
  const left = Math.max(0, usage.limit.proposals - usage.used.proposals - usage.reserved.proposals);
  const message = [step ? t.failedAt(step) : null, error].filter(Boolean).join(" ");
  // Une erreur est dite au lecteur d'écran dès qu'elle paraît, où que soit le focus.
  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return (
    <View style={{ gap: space.sm }}>
      <T variant="small" tone="muted">
        {exhausted ? m.aiPlanner.quotaExceeded : t.quota(left)}
      </T>
      <T variant="smallStrong" accessibilityRole="header">
        {t.stage(stage)}
      </T>
      {stage === 1 ? <T tone="muted">{t.lead}</T> : null}
      {error ? (
        <T tone="danger" accessibilityLiveRegion="assertive" testID="planner-error">
          {message}
        </T>
      ) : null}
    </View>
  );
}
