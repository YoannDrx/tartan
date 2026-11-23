import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useOnboarding, useUpdateOnboarding } from "../lib/account-queries";
import { nextPersonalStep, personalStepRoute, type PersonalStepKey } from "../lib/onboarding";
import { Button, Card, T } from "../ui/primitives";
import { space, TOUCH } from "../ui/theme";
import { TrackLap } from "../ui/track-lap";
import { Lane } from "./first-steps";

const t = m.mobile.solo.guide;

// La carte « Pour démarrer » de l'athlète autonome, sous sa séance du jour : la même mécanique que celle du coach
// (tour de piste, prochaine étape marquée, refermable pour tous les appareils), avec ses étapes d'athlète. Elle ne
// s'ouvre jamais par-dessus la journée ; la fin des premiers pas se fête une fois.
// Sur la page des premiers pas (Réglages, Aide), la carte se montre même refermée, avec de quoi la remettre.
export const PersonalFirstSteps = ({
  orgId,
  athleteId,
  variant = "today",
}: {
  orgId: string;
  athleteId: string;
  variant?: "today" | "page";
}) => {
  const router = useRouter();
  const onboarding = useOnboarding(orgId);
  const update = useUpdateOnboarding(orgId);
  const [closed, setClosed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const personal = onboarding.data?.personal;
  if (!personal) return null;
  if (personal.celebrationDue && variant === "today")
    return (
      <Card testID="personal-celebration">
        <View style={{ gap: space.sm }} accessibilityLiveRegion="polite">
          <T variant="title1" heading>
            {t.celebrationTitle}
          </T>
          <T>{t.celebrationBody}</T>
        </View>
        <Button label={t.celebrationAction} onPress={() => update.mutate({ celebrated: true })} />
      </Card>
    );
  if (!personal.guideVisible && variant === "today")
    return closed ? (
      <T variant="caption" accessibilityLiveRegion="polite">
        {t.closed}
      </T>
    ) : null;

  const next = nextPersonalStep(personal);
  const go = (key: PersonalStepKey) => {
    const route = personalStepRoute(key, athleteId);
    if (route === "today") return;
    if (route === "new-session") router.push({ pathname: "/session-builder/[id]", params: { id: "new" } });
    else router.push(route);
  };
  return (
    <Card testID="personal-first-steps">
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <TrackLap done={personal.progress.done} total={personal.progress.total} />
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="title2" heading>
            {t.title}
          </T>
          <T variant="small" testID="personal-first-steps-lap" accessibilityLiveRegion="polite">
            {t.lap(personal.progress.done, personal.progress.total)}
          </T>
        </View>
      </View>
      {personal.steps.map((step, index) => {
        const copy = t.steps[step.key];
        const isNext = step.key === next;
        const state = step.done ? t.done : isNext ? t.next : t.todo;
        return (
          <View key={step.key} testID={`personal-step-${step.key}`} style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
              <Lane n={index + 1} done={step.done} next={isNext} />
              <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={t.stepState(copy.title, state)}>
                <T variant="smallStrong">{copy.title}</T>
                <T variant="caption" tone="muted">
                  {step.done ? t.done : isNext ? `${t.next} · ${copy.body}` : copy.body}
                </T>
              </View>
            </View>
            {!step.done && isNext && step.key !== "validate" ? (
              <Button
                testID={`personal-step-${step.key}-go`}
                label={copy.action}
                compact
                style={{ alignSelf: "flex-start", marginLeft: 32 + space.md }}
                onPress={() => go(step.key)}
              />
            ) : null}
          </View>
        );
      })}
      {variant === "today" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, minHeight: TOUCH }}>
          <Button
            testID="personal-first-steps-close"
            label={t.dismiss}
            accessibilityLabel={t.dismissLabel}
            variant="ghost"
            compact
            onPress={() => {
              update.mutate({ dismissed: true });
              setClosed(true);
            }}
          />
        </View>
      ) : onboarding.data?.dismissedAt ? (
        <Button
          testID="personal-first-steps-reopen"
          label={t.reopen}
          variant="secondary"
          compact
          onPress={() => {
            update.mutate({ dismissed: false });
            setNotice(t.reopened);
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
