import { useQuery } from "@tanstack/react-query";
import { tokens } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { InviteLinkSheet } from "../../../src/features/invite-link-sheet";
import { Shell } from "../../../src/features/push-step";
import { api } from "../../../src/lib/api";
import { welcomeChoices, type WelcomeChoice } from "../../../src/lib/personal-space";
import { useMe } from "../../../src/lib/queries";
import { useSession } from "../../../src/lib/session-store";
import { Button, Card, Divider, LaneLine, ListSurface, MutedChevron, ScreenTitle, T } from "../../../src/ui/primitives";
import { ErrorState, LoadingState } from "../../../src/ui/states";
import { space } from "../../../src/ui/theme";

const t = m.mobile.welcome;

const COPY: Record<WelcomeChoice, { title: string; detail: string }> = {
  coach: t.coach,
  solo: t.solo,
  invite: t.invite,
};

// Un chemin de l'aiguillage : son numéro de couloir, ce qu'il est, ce qu'il ouvre. Une seule cible de toute la largeur,
// lue d'un trait par le lecteur d'écran.
const ChoiceRow = ({ lane, choice, onPress }: { lane: number; choice: WelcomeChoice; onPress: () => void }) => {
  const copy = COPY[choice];
  return (
    <Pressable
      testID={`welcome-${choice}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t.choice(lane, copy.title, copy.detail)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.lg,
        paddingHorizontal: space.lg,
        paddingVertical: space.lg,
        minHeight: 88,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <T variant="display" maxFontSizeMultiplier={1.2} style={{ fontFamily: tokens.font.display, minWidth: 24 }}>
        {String(lane)}
      </T>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="title2">{copy.title}</T>
        <T variant="small" tone="muted">
          {copy.detail}
        </T>
      </View>
      <MutedChevron />
    </Pressable>
  );
};

// L'aiguillage d'un compte connecté qui n'a encore aucun espace : coach, athlète qui s'entraîne seul, invitation reçue.
// Seuls les choix que la console laisse ouverts sont montrés (`GET /signup-options`). Puis le compte lui-même :
// se déconnecter, ses réglages, et la suppression du compte (exigence d'Apple), jamais dans une impasse.
export default function Welcome() {
  const router = useRouter();
  const status = useSession((s) => s.status);
  const signOut = useSession((s) => s.signOut);
  const me = useMe(status === "signed-in");
  const options = useQuery({ queryKey: ["signup-options"], queryFn: api.signupOptions, staleTime: 0 });
  const [pasting, setPasting] = useState(false);

  if (status === "signed-out") return <Redirect href="/sign-in" />;
  if (me.data && me.data.spaces.length > 0) return <Redirect href="/" />;

  const choices = welcomeChoices(options.data);
  const open = (choice: WelcomeChoice) => {
    if (choice === "invite") setPasting(true);
    else router.push(choice === "coach" ? "/onboarding/coach" : "/onboarding/solo");
  };

  return (
    <Shell>
      <View style={{ gap: space.sm }}>
        <ScreenTitle title={t.title} testID="welcome-title" />
        <T>{t.lead}</T>
      </View>
      <LaneLine />
      {options.isPending ? <LoadingState inline /> : null}
      <View accessibilityRole="list" accessibilityLabel={t.choicesLabel}>
        <ListSurface>
          {choices.map((choice, index) => (
            <View key={choice}>
              {index > 0 ? <Divider /> : null}
              <ChoiceRow lane={index + 1} choice={choice} onPress={() => open(choice)} />
            </View>
          ))}
        </ListSurface>
      </View>
      {options.isError ? <ErrorState message={t.optionsError} onRetry={() => void options.refetch()} /> : null}

      <Card testID="welcome-account">
        <T variant="title2" heading>
          {t.account.title}
        </T>
        <View accessible style={{ gap: 2 }}>
          <T variant="caption" tone="muted">
            {t.account.signedInAs}
          </T>
          <T variant="smallStrong" testID="welcome-email">
            {me.data?.email ?? ""}
          </T>
        </View>
        <Button testID="welcome-sign-out" label={m.common.signOut} variant="secondary" onPress={() => void signOut()} />
        <Button
          testID="welcome-settings"
          label={t.account.settings}
          variant="secondary"
          compact
          onPress={() => router.push("/settings")}
        />
        <T variant="caption" tone="muted">
          {t.account.deleteHint}
        </T>
        <Button
          testID="welcome-delete"
          label={t.account.delete}
          variant="danger"
          compact
          onPress={() => router.push("/settings/confidentialite")}
        />
      </Card>
      {pasting ? <InviteLinkSheet onClose={() => setPasting(false)} /> : null}
    </Shell>
  );
}
