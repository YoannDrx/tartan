import { useMutation } from "@tanstack/react-query";
import { m } from "@tartan/i18n";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Share as NativeShare, useWindowDimensions, View } from "react-native";
import { z } from "zod";
import { QrCode } from "../src/features/qr-code";
import { api } from "../src/lib/api";
import { errorMessage } from "../src/lib/errors";
import { useActiveSpace, useAthletes, useGroupLink, useGroups } from "../src/lib/queries";
import { Copy, Send, Share } from "../src/ui/icons";
import { Button, Card, Chip, Field, SectionTitle, T } from "../src/ui/primitives";
import { StackScreen } from "../src/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../src/ui/states";
import { radius, Scene, scene, space, usePagePad } from "../src/ui/theme";

const emailSchema = z.email();
const QR_MAX = 320;

const PersonalInvite = ({
  orgId,
  groupIds,
  athlete,
}: {
  orgId: string;
  groupIds: string[];
  athlete: { id: string; name: string } | null;
}) => {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: (address: string) =>
      api.createInvitation(orgId, {
        kind: "personal_email",
        email: address,
        groupIds,
        ...(athlete ? { athleteId: athlete.id } : {}),
      }),
    onSuccess: (_result, address) => {
      setSentTo(address);
      setEmail("");
    },
    onError: (error) => setFieldError(errorMessage(error)),
  });
  const submit = () => {
    const value = email.trim().toLowerCase();
    setSentTo(null);
    if (!emailSchema.safeParse(value).success) {
      setFieldError(m.mobile.auth.emailInvalid);
      return;
    }
    setFieldError(null);
    send.mutate(value);
  };
  return (
    <View style={{ gap: space.sm }}>
      <SectionTitle>{m.mobile.invitePage.personalTitle}</SectionTitle>
      <Card>
        <T variant="small">
          {athlete ? m.mobile.invitePage.personalForAthlete(athlete.name) : m.mobile.invitePage.personalLead}
        </T>
        <Field
          testID="invite-email"
          label={m.mobile.invitePage.emailLabel}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setFieldError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          keyboardType="email-address"
          returnKeyType="send"
          onSubmitEditing={submit}
          placeholder={m.auth.emailPlaceholder}
          error={fieldError}
        />
        <Button
          testID="invite-send"
          label={m.mobile.invitePage.send}
          icon={Send}
          loading={send.isPending}
          onPress={submit}
        />
        {sentTo ? (
          <T variant="small" accessibilityLiveRegion="polite">
            {m.mobile.invitePage.sent(sentTo)}
          </T>
        ) : null}
      </Card>
    </View>
  );
};

export default function Invite() {
  const params = useLocalSearchParams<{ groupId?: string; athleteId?: string }>();
  const { orgId } = useActiveSpace();
  const groups = useGroups(orgId);
  const athletes = useAthletes(orgId);
  const { width } = useWindowDimensions();
  const pad = usePagePad();
  const [picked, setPicked] = useState<string | undefined>(params.groupId);
  const [copied, setCopied] = useState(false);
  const group = groups.data?.find((g) => g.id === picked) ?? groups.data?.[0];
  const link = useGroupLink(orgId, group?.id);
  const target = athletes.data?.find((a) => a.id === params.athleteId);
  const athlete = target ? { id: target.id, name: `${target.firstName} ${target.lastName}`.trim() } : null;
  const qrSize = Math.min(width - pad * 2 - space.xxl * 2, QR_MAX);
  const url = link.data?.link;

  return (
    <StackScreen title={m.mobile.invitePage.title}>
      {groups.isPending ? <LoadingState /> : null}
      {groups.isError && !groups.data ? <ErrorState error={groups.error} onRetry={() => void groups.refetch()} /> : null}
      {groups.data?.length === 0 ? <EmptyState body={m.mobile.coach.noGroup} /> : null}

      {group ? (
        <>
          {groups.data && groups.data.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {groups.data.map((g) => (
                <Chip
                  key={g.id}
                  tall
                  label={g.name}
                  active={g.id === group.id}
                  onPress={() => {
                    setPicked(g.id);
                    setCopied(false);
                  }}
                />
              ))}
            </ScrollView>
          ) : null}

          {/* La carte craie, seule de l'écran : on tend le téléphone, le QR code doit se lire de loin. */}
          <Scene scene="hero">
            <View
              style={{
                backgroundColor: scene.hero,
                borderRadius: radius.hero,
                padding: space.xxl,
                alignItems: "center",
                gap: space.md,
              }}
            >
              <T variant="title1" heading style={{ textAlign: "center" }}>
                {group.name}
              </T>
              <View
                style={{
                  width: qrSize,
                  height: qrSize,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radius.thumb,
                  overflow: "hidden",
                }}
              >
                {url ? (
                  <QrCode value={url} size={qrSize} label={m.mobile.invitePage.qrLabel(group.name)} />
                ) : link.isError ? (
                  <ErrorState message={m.mobile.invitePage.linkError} onRetry={() => void link.refetch()} />
                ) : (
                  <LoadingState inline />
                )}
              </View>
              <T variant="small" tone="muted" style={{ textAlign: "center" }}>
                {m.mobile.invitePage.qrHint}
              </T>
            </View>
          </Scene>

          <View style={{ gap: space.sm }}>
            <Button
              testID="invite-share"
              label={m.mobile.invitePage.share}
              icon={Share}
              disabled={!url}
              onPress={() => {
                if (url) void NativeShare.share({ message: m.mobile.coach.inviteMessage(group.name, url) });
              }}
            />
            <Button
              testID="invite-copy"
              label={m.mobile.invitePage.copy}
              icon={Copy}
              variant="secondary"
              compact
              disabled={!url}
              onPress={() => {
                if (!url) return;
                void Clipboard.setStringAsync(url).then(() => setCopied(true));
              }}
            />
            {copied ? (
              <T variant="small" accessibilityLiveRegion="polite" style={{ textAlign: "center" }}>
                {m.mobile.invitePage.copied}
              </T>
            ) : null}
          </View>

          <PersonalInvite orgId={orgId} groupIds={[group.id]} athlete={athlete} />
        </>
      ) : null}
    </StackScreen>
  );
}
