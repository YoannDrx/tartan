import { isStaff } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Redirect, useRouter } from "expo-router";
import { View } from "react-native";
import { FirstStepsCard } from "../src/features/first-steps";
import { useOnboarding } from "../src/lib/account-queries";
import { useActiveSpace } from "../src/lib/queries";
import { Button, Card, SectionTitle, T } from "../src/ui/primitives";
import { StackScreen } from "../src/ui/screen";
import { ErrorState, LoadingState } from "../src/ui/states";
import { space } from "../src/ui/theme";

const f = m.account.firstSteps;

// Les premiers pas du coach, toujours accessibles (Réglages, rubrique Aide) : la carte entière, le tour de piste, et
// l'espace de démonstration, qui reste sur le site.
export default function FirstStepsPage() {
  const { me, space: active, orgId } = useActiveSpace();
  const router = useRouter();
  const onboarding = useOnboarding(orgId);
  if (!me.isPending && !(active && isStaff(active.role))) return <Redirect href="/settings" />;
  return (
    <StackScreen title={m.firstSteps.title}>
      <T variant="small">{f.pageLead}</T>
      {onboarding.data ? (
        <FirstStepsCard state={onboarding.data} orgId={orgId} variant="page" />
      ) : onboarding.isPending ? (
        <LoadingState />
      ) : (
        <ErrorState error={onboarding.error} onRetry={() => void onboarding.refetch()} />
      )}
      <View style={{ gap: space.sm }}>
        <SectionTitle>{f.tourTitle}</SectionTitle>
        <Button testID="first-steps-tour" label={f.tourOpen} variant="secondary" onPress={() => router.push("/tour")} />
      </View>
      <View style={{ gap: space.sm }}>
        <SectionTitle>{f.demoTitle}</SectionTitle>
        {/* Pas de lien : la web app connectée montre l'offre de l'espace, que l'app native ne montre jamais. */}
        <Card>
          <T variant="small">{f.demoBody}</T>
        </Card>
      </View>
    </StackScreen>
  );
}
