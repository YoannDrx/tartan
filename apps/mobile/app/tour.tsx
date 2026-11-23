import type { AvatarGroupId } from "@tartan/contracts";
import { tokens } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useUpdateOnboarding } from "../src/lib/account-queries";
import { TOUR_FEATURES, type TourFeature } from "../src/lib/onboarding";
import { useActiveSpace } from "../src/lib/queries";
import { PresetArt } from "../src/ui/avatar-art";
import { Button, Card, T } from "../src/ui/primitives";
import { StackScreen } from "../src/ui/screen";
import { space } from "../src/ui/theme";

const f = m.account.firstSteps;

// L'athlète de la rubrique de chaque fonction (DESIGN.md, « Le groupe »).
const FEATURE_ATHLETE: Record<TourFeature, AvatarGroupId> = {
  suivi: "longJump",
  calendrier: "hurdles",
  exercices: "discus",
  videos: "highJump",
  planificateur: "tripleJump",
  progression: "poleVault",
  annonces: "longJump",
};
const ART = 120;

// Le tour de piste, en quelques écrans : une fonction par écran, refermable à tout moment, vu une fois pour tous les
// appareils. Il se rouvre depuis les premiers pas.
export default function Tour() {
  const router = useRouter();
  const { orgId } = useActiveSpace();
  const update = useUpdateOnboarding(orgId);
  const [step, setStep] = useState(0);
  const feature = TOUR_FEATURES[step]!;
  const last = step === TOUR_FEATURES.length - 1;
  const close = () => {
    if (orgId) update.mutate({ tourSeen: true });
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  const text = f.tourFeatures[feature];
  return (
    <StackScreen
      title={f.tourTitle}
      subtitle={f.tourProgress(step + 1, TOUR_FEATURES.length)}
      backIcon="close"
      onBack={close}
      footer={
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {step > 0 ? (
            <Button
              testID="tour-previous"
              label={f.tourPrevious}
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => setStep(step - 1)}
            />
          ) : null}
          <Button
            testID={last ? "tour-finish" : "tour-next"}
            label={last ? f.tourFinish : f.tourNext}
            style={{ flex: 1 }}
            onPress={() => (last ? close() : setStep(step + 1))}
          />
        </View>
      }
    >
      <T variant="small">{f.tourLead}</T>
      <Card testID={`tour-step-${feature}`}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
          <View style={{ width: ART, height: ART, borderRadius: ART / 2, overflow: "hidden" }}>
            <PresetArt preset={`athlete:${FEATURE_ATHLETE[feature]}`} size={ART} />
          </View>
          <T
            variant="display"
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ fontFamily: tokens.font.display }}
          >
            {String(step + 1)}
          </T>
        </View>
        <View accessibilityLiveRegion="polite" style={{ gap: space.sm }}>
          <T variant="title1" heading>
            {text.title}
          </T>
          <T>{text.body}</T>
        </View>
      </Card>
    </StackScreen>
  );
}
