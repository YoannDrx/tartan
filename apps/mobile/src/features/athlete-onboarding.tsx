import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AvatarGroupId, SignInMethodsResponse } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useAthleteWelcome, useOnboarding, useSignInMethods, useUpdateOnboarding } from "../lib/account-queries";
import { api } from "../lib/api";
import { getPushPermission, registerPush } from "../lib/notifications";
import { athleteWelcomeView } from "../lib/onboarding";
import { PresetArt } from "../ui/avatar-art";
import { ChevronRight } from "../ui/icons";
import { Button, Card, Divider, T } from "../ui/primitives";
import { space, TOUCH, usePalette } from "../ui/theme";
import { DefinePasswordForm } from "./password-forms";

const w = m.athleteWelcome;
const a = m.account.athlete;
const p = m.account.prompt;

// Chaque chose à savoir porte l'athlète de sa rubrique (DESIGN.md, « Le groupe »).
const PANELS: { key: "session" | "progress" | "videos"; athlete: AvatarGroupId }[] = [
  { key: "session", athlete: "tripleJump" },
  { key: "progress", athlete: "poleVault" },
  { key: "videos", athlete: "highJump" },
];
const HEAD = 48;

const WelcomePanels = ({ group, coach, onDone }: { group: string; coach: string; onDone: () => void }) => (
  <Card testID="athlete-welcome">
    <View style={{ gap: space.xs }}>
      <T variant="title1" heading>
        {w.title(group)}
      </T>
      <T>{w.body(coach)}</T>
    </View>
    <View accessibilityLabel={w.panelsLabel} style={{ gap: space.md }}>
      {PANELS.map((panel) => (
        <View key={panel.key} style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
          <View style={{ width: HEAD, height: HEAD, borderRadius: HEAD / 2, overflow: "hidden" }}>
            <PresetArt preset={`athlete:${panel.athlete}`} size={HEAD} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="smallStrong" heading>
              {w.panels[panel.key].title}
            </T>
            <T variant="small">{panel.key === "videos" ? w.panels.videos.body(coach) : w.panels[panel.key].body}</T>
          </View>
        </View>
      ))}
    </View>
    <Button testID="athlete-welcome-dismiss" label={w.dismiss} onPress={onDone} />
  </Card>
);

// L'accueil de l'athlète arrivé depuis moins d'une semaine. Il ne retarde jamais la séance : un jour de séance, il
// tient en une ligne sous elle (`placement="after"`) ; sinon il ouvre l'écran (`placement="top"`).
export const AthleteWelcome = ({
  orgId,
  sessionToday,
  placement,
}: {
  orgId: string;
  sessionToday: boolean;
  placement: "top" | "after";
}) => {
  const onboarding = useOnboarding(orgId);
  const welcome = useAthleteWelcome(orgId, Boolean(onboarding.data && !onboarding.data.welcomeSeenAt));
  const update = useUpdateOnboarding(orgId);
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const mode = athleteWelcomeView({
    welcome: welcome.data?.welcome,
    welcomeSeenAt: onboarding.data?.welcomeSeenAt,
    sessionToday,
  });
  const info = welcome.data?.welcome;
  if (!mode || !info) return null;
  if ((mode === "panels") !== (placement === "top")) return null;
  const done = () => update.mutate({ welcomeSeen: true });
  if (mode === "panels" || open) return <WelcomePanels group={info.group} coach={info.coach} onDone={done} />;
  return (
    <Pressable
      testID="athlete-welcome-line"
      accessibilityRole="button"
      accessibilityLabel={w.discover}
      accessibilityHint={a.welcomeLineHint}
      accessibilityState={{ expanded: false }}
      onPress={() => setOpen(true)}
      style={({ pressed }) => ({
        minHeight: TOUCH,
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <T variant="smallStrong" style={{ flex: 1 }}>
        {w.discover}
      </T>
      <ChevronRight size={18} color={palette.text} accessibilityElementsHidden importantForAccessibility="no" />
    </Pressable>
  );
};

// « Un mot de passe pour revenir plus vite » : facultatif, après la séance, jamais un passage obligé.
const PasswordPrompt = ({ methods, embedded }: { methods: SignInMethodsResponse; embedded?: boolean }) => {
  const client = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const dismiss = useMutation({
    mutationFn: api.dismissPasswordPrompt,
    onSuccess: () => {
      setNotice(p.dismissed);
      void client.invalidateQueries({ queryKey: ["sign-in-methods"] });
    },
  });
  if (notice) {
    return (
      <T variant="small" accessibilityLiveRegion="polite">
        {notice}
      </T>
    );
  }
  const body = (
    <View testID="password-prompt" style={{ gap: space.md }}>
      <View style={{ gap: space.xs }}>
        <T variant={embedded ? "smallStrong" : "title2"} heading>
          {embedded ? a.extrasPassword : p.title}
        </T>
        <T variant="small">{p.body}</T>
      </View>
      {open ? (
        <>
          <DefinePasswordForm
            methods={methods}
            fieldLabel={p.field}
            submitLabel={p.submit}
            doneLabel={p.done}
            testID="password-prompt-define"
          />
          <Button label={p.cancel} variant="ghost" compact onPress={() => setOpen(false)} />
        </>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Button
            testID="password-prompt-open"
            label={p.open}
            compact
            onPress={() => (methods.canSetPasswordNow ? setOpen(true) : router.push("/settings/connexion"))}
            accessibilityHint={methods.canSetPasswordNow ? undefined : p.later}
          />
          <Button
            testID="password-prompt-dismiss"
            label={p.dismiss}
            variant="ghost"
            compact
            loading={dismiss.isPending}
            onPress={() => dismiss.mutate()}
          />
        </View>
      )}
    </View>
  );
  return embedded ? body : <Card>{body}</Card>;
};

const NotificationsExtra = () => {
  const [push, setPush] = useState<"granted" | "denied" | "undetermined" | null>(null);
  useEffect(() => {
    void getPushPermission()
      .then(setPush)
      .catch(() => setPush("undetermined"));
  }, []);
  if (push === null) return null;
  return (
    <View style={{ gap: space.xs }}>
      <T variant="smallStrong" heading>
        {a.extrasNotifications}
      </T>
      <T variant="small">
        {push === "granted"
          ? m.mobile.settings.notificationsOn
          : push === "denied"
            ? m.mobile.push.denied
            : a.extrasNotificationsBody}
      </T>
      {push === "undetermined" ? (
        <Button
          label={m.mobile.settings.enableNotifications}
          variant="secondary"
          compact
          style={{ alignSelf: "flex-start" }}
          // Toujours sur un geste, jamais à l'ouverture de l'écran.
          onPress={() => void registerPush({ prompt: true }).then(setPush)}
        />
      ) : null}
    </View>
  );
};

// Sous la séance du jour : la proposition de mot de passe, puis, après la première validation, la carte facultative
// « Pour aller plus loin » qui l'héberge avec la photo et les notifications.
export const AthleteAfterSession = ({ orgId }: { orgId: string }) => {
  const router = useRouter();
  const onboarding = useOnboarding(orgId);
  const methods = useSignInMethods();
  const update = useUpdateOnboarding(orgId);
  const [closed, setClosed] = useState(false);
  const prompt = methods.data?.passwordPrompt ? methods.data : null;
  if (onboarding.data?.extrasVisible) {
    return (
      <Card testID="athlete-extras">
        <View style={{ gap: space.xs }}>
          <T variant="title2" heading>
            {m.athleteExtras.title}
          </T>
          <T variant="small" tone="muted">
            {m.athleteExtras.lead}
          </T>
        </View>
        <View style={{ gap: space.xs }}>
          <T variant="smallStrong" heading>
            {m.athleteExtras.photoTitle}
          </T>
          <T variant="small">{m.athleteExtras.photoBody}</T>
          <Button
            testID="athlete-extras-photo"
            label={m.athleteExtras.photoAction}
            variant="secondary"
            compact
            style={{ alignSelf: "flex-start" }}
            onPress={() => router.push("/settings/profil")}
          />
        </View>
        {prompt ? (
          <>
            <Divider />
            <PasswordPrompt methods={prompt} embedded />
          </>
        ) : null}
        <Divider />
        <NotificationsExtra />
        <Button
          testID="athlete-extras-close"
          label={m.athleteExtras.close}
          variant="ghost"
          compact
          style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
          onPress={() => {
            update.mutate({ dismissed: true });
            setClosed(true);
          }}
        />
      </Card>
    );
  }
  if (closed) {
    return (
      <T variant="caption" accessibilityLiveRegion="polite">
        {a.closed}
      </T>
    );
  }
  return prompt ? <PasswordPrompt methods={prompt} /> : null;
};
