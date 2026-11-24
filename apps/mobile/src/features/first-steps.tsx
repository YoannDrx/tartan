import type { CoachOptionalStepKeyValue, CoachStepKeyValue, OnboardingResponse } from "@tartan/contracts";
import { tokens } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useOnboarding, useUpdateOnboarding } from "../lib/account-queries";
import { COACH_OPTIONAL_ROUTES, COACH_STEP_ROUTES, nextCoachStep } from "../lib/onboarding";
import { Check } from "../ui/icons";
import { Button, Card, Divider, T } from "../ui/primitives";
import { radius, space, TOUCH, usePalette } from "../ui/theme";
import { TrackLap } from "../ui/track-lap";

const f = m.account.firstSteps;

// Le numéro de couloir d'une étape, en Barlow Condensed, sur une pastille.
export const Lane = ({ n, done, next }: { n: number; done: boolean; next: boolean }) => {
  const p = usePalette();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 32,
        height: 32,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: done || next ? p.accent : "transparent",
        borderWidth: done || next ? 0 : 2,
        borderColor: p.border,
      }}
    >
      {done ? (
        <Check size={18} color={p.accentText} strokeWidth={2.6} />
      ) : (
        <T
          variant="figure"
          maxFontSizeMultiplier={1.2}
          style={{ color: next ? p.accentText : p.text, fontFamily: tokens.font.display }}
        >
          {String(n)}
        </T>
      )}
    </View>
  );
};

const useStepNavigation = () => {
  const router = useRouter();
  return (key: CoachStepKeyValue) => {
    const route = COACH_STEP_ROUTES[key];
    if (route === "new-session") router.push({ pathname: "/session-builder/[id]", params: { id: "new" } });
    else router.push(route);
  };
};

const Steps = ({ state }: { state: OnboardingResponse }) => {
  const go = useStepNavigation();
  const next = nextCoachStep(state);
  return (
    <View style={{ gap: space.md }}>
      {state.steps.map((step, index) => {
        const title = m.firstSteps.steps[step.key];
        const isNext = step.key === next;
        const stateLabel = step.done ? f.done : isNext ? f.next : f.todo;
        return (
          <View key={step.key} testID={`first-step-${step.key}`} style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
              <Lane n={index + 1} done={step.done} next={isNext} />
              <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={f.stepState(title, stateLabel)}>
                <T variant="smallStrong">{title}</T>
                <T variant="caption" tone="muted">
                  {step.done ? f.done : isNext ? `${f.next} · ${f.steps[step.key].detail}` : f.steps[step.key].detail}
                </T>
              </View>
            </View>
            {!step.done && isNext ? (
              <Button
                testID={`first-step-${step.key}-go`}
                label={f.steps[step.key].action}
                compact
                style={{ alignSelf: "flex-start", marginLeft: 32 + space.md }}
                onPress={() => go(step.key)}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const OptionalSteps = ({ state, orgId }: { state: OnboardingResponse; orgId: string }) => {
  const router = useRouter();
  const update = useUpdateOnboarding(orgId);
  const done = state.optionalSteps.filter((step) => step.done).length;
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md, flexWrap: "wrap" }}>
        <T variant="smallStrong" heading>
          {f.optionalTitle}
        </T>
        <T variant="caption" tone="muted">
          {f.optionalCount(done, state.optionalSteps.length)}
        </T>
      </View>
      {state.optionalSteps.map((step) => {
        const title = m.firstSteps.optional[step.key];
        const key: CoachOptionalStepKeyValue = step.key;
        return (
          <View key={key} testID={`first-step-optional-${key}`} style={{ gap: space.xs }}>
            <T variant="small" style={{ textDecorationLine: step.skipped ? "line-through" : "none" }}>
              {title}
            </T>
            <T variant="caption" tone="muted">
              {step.done ? f.done : step.skipped ? f.skipped : f.optional[key]}
            </T>
            {step.done ? null : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {step.skipped ? null : (
                  <Button
                    label={f.go}
                    accessibilityLabel={f.goTo(title)}
                    variant="secondary"
                    compact
                    onPress={() => router.push(COACH_OPTIONAL_ROUTES[key])}
                  />
                )}
                <Button
                  testID={`first-step-optional-${key}-${step.skipped ? "unskip" : "skip"}`}
                  label={step.skipped ? f.unskip : f.skip}
                  accessibilityLabel={step.skipped ? f.unskipLabel(title) : f.skipLabel(title)}
                  variant="ghost"
                  compact
                  onPress={() => update.mutate(step.skipped ? { unskip: key } : { skip: key })}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

// La carte « Pour démarrer » : la part courue, les cinq étapes déduites des faits de l'espace, la prochaine marquée,
// puis les étapes facultatives. Sur le suivi, elle se referme pour tous les appareils.
export const FirstStepsCard = ({
  state,
  orgId,
  variant,
  onClose,
}: {
  state: OnboardingResponse;
  orgId: string;
  variant: "suivi" | "page";
  onClose?: () => void;
}) => {
  const update = useUpdateOnboarding(orgId);
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <Card testID="first-steps-card">
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <TrackLap done={state.progress.done} total={state.progress.total} />
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="title2" heading>
            {variant === "suivi" ? f.cardTitle : f.stepsTitle}
          </T>
          <T variant="small" testID="first-steps-lap" accessibilityLiveRegion="polite">
            {state.progress.done >= state.progress.total && state.progress.total > 0
              ? f.stepsDone
              : f.lap(state.progress.done, state.progress.total)}
          </T>
        </View>
      </View>
      <Steps state={state} />
      <Divider />
      <OptionalSteps state={state} orgId={orgId} />
      {variant === "suivi" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, minHeight: TOUCH }}>
          {/* Le tour de piste ne s'ouvre jamais seul : il ne recouvre ni le suivi ni ses flux de test. */}
          {state.tourDue ? (
            <Button testID="first-steps-tour" label={f.tourOpen} compact onPress={() => router.push("/tour")} />
          ) : null}
          <Button
            testID="first-steps-all"
            label={f.all}
            variant="secondary"
            compact
            onPress={() => router.push("/premiers-pas")}
          />
          <Button
            testID="first-steps-close"
            label={f.close}
            accessibilityLabel={f.closeLabel}
            variant="ghost"
            compact
            onPress={() => {
              update.mutate({ dismissed: true });
              onClose?.();
            }}
          />
        </View>
      ) : state.dismissedAt ? (
        <Button
          testID="first-steps-reopen"
          label={f.reopen}
          variant="secondary"
          compact
          onPress={() => {
            update.mutate({ dismissed: false });
            setNotice(f.reopened);
          }}
        />
      ) : null}
      {notice ? (
        <T variant="caption" accessibilityLiveRegion="polite">
          {notice}
        </T>
      ) : null}
    </Card>
  );
};

// Sous le suivi du coach : la fin fêtée une fois, sinon la carte tant qu'elle n'est pas refermée, avec le tour de piste
// à portée tant qu'il n'a pas été vu. Rien ne s'ouvre seul par-dessus le suivi. Un coach que le suivi ne guide pas
// (`guided = false` : arrivé avant lui, comptes de la graine) ne voit la carte que selon l'ancienne règle du serveur.
export const CoachFirstSteps = ({ orgId }: { orgId: string }) => {
  const onboarding = useOnboarding(orgId);
  const [closed, setClosed] = useState(false);
  const state = onboarding.data;
  if (!state?.staff) return null;
  if (state.celebrationDue) return <FirstStepsCelebration orgId={orgId} />;
  if (state.guideVisible)
    return <FirstStepsCard state={state} orgId={orgId} variant="suivi" onClose={() => setClosed(true)} />;
  return closed ? (
    <T variant="caption" accessibilityLiveRegion="polite">
      {f.closed}
    </T>
  ) : null;
};

// La fin des premiers pas : un grand moment, une fois, refermé d'un geste.
export const FirstStepsCelebration = ({ orgId }: { orgId: string }) => {
  const update = useUpdateOnboarding(orgId);
  return (
    <Card testID="first-steps-celebration">
      <View style={{ gap: space.sm }} accessibilityLiveRegion="polite">
        <T variant="title1" heading>
          {f.celebrationTitle}
        </T>
        <T>{f.celebrationBody}</T>
      </View>
      <Button label={f.celebrationAction} onPress={() => update.mutate({ celebrated: true })} />
    </Card>
  );
};
