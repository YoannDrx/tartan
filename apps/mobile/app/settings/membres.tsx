import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { m } from "@tartan/i18n";
import { Redirect } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { api } from "../../src/lib/api";
import { errorMessage } from "../../src/lib/errors";
import { useActiveSpace } from "../../src/lib/queries";
import { canOpenRubric } from "../../src/lib/settings-rubrics";
import { normalizedEmail } from "../../src/lib/sign-in";
import { Send } from "../../src/ui/icons";
import { Button, Card, Divider, Field, ListSurface, SectionTitle, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { space } from "../../src/ui/theme";

const t = m.account.settings;

// Rubrique Membres : inviter un coach par e-mail, puis les invitations déjà envoyées.
export default function MemberSettings() {
  const { me, space: active, orgId } = useActiveSpace();
  const client = useQueryClient();
  const allowed = active ? canOpenRubric(active.role, "membres") : false;
  const invitations = useQuery({
    queryKey: ["invitations", orgId],
    queryFn: () => api.invitations(orgId),
    enabled: Boolean(orgId && allowed),
  });
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const invite = useMutation({
    mutationFn: (address: string) =>
      api.createInvitation(orgId, { kind: "personal_email", role: "coach", email: address, groupIds: [] }),
    onSuccess: (_result, address) => {
      setSentTo(address);
      setEmail("");
      void client.invalidateQueries({ queryKey: ["invitations", orgId] });
    },
    onError: (failure) => setFieldError(errorMessage(failure)),
  });

  if (!me.isPending && !allowed) return <Redirect href="/settings" />;

  const submit = () => {
    setSentTo(null);
    const address = normalizedEmail(email);
    if (!address) {
      setFieldError(m.mobile.auth.emailInvalid);
      return;
    }
    setFieldError(null);
    invite.mutate(address);
  };

  return (
    <StackScreen title={t.rubrics.membres.title}>
      <View style={{ gap: space.sm }}>
        <SectionTitle>{t.membersInvite}</SectionTitle>
        <Card>
          <T variant="small">{t.membersInviteDetail}</T>
          <Field
            testID="member-invite-email"
            label={m.auth.emailLabel}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setFieldError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            placeholder={m.auth.emailPlaceholder}
            returnKeyType="send"
            onSubmitEditing={submit}
            error={fieldError}
          />
          <Button
            testID="member-invite-send"
            label={t.membersInviteSend}
            icon={Send}
            loading={invite.isPending}
            onPress={submit}
          />
          {sentTo ? (
            <T variant="small" accessibilityLiveRegion="polite">
              {t.membersInvited(sentTo)}
            </T>
          ) : null}
        </Card>
      </View>
      <View style={{ gap: space.sm }}>
        <SectionTitle>{t.membersSent}</SectionTitle>
        {invitations.isError ? (
          <ErrorState error={invitations.error} onRetry={() => void invitations.refetch()} />
        ) : !invitations.data ? (
          <LoadingState inline />
        ) : invitations.data.length === 0 ? (
          <T variant="small">{t.membersEmpty}</T>
        ) : (
          <ListSurface>
            {invitations.data.map((invitation, index) => (
              <View key={invitation.id}>
                {index > 0 ? <Divider /> : null}
                <View style={{ padding: space.md, gap: 2, minHeight: 56 }} accessible>
                  <T variant="smallStrong">{invitation.email ?? invitation.phone ?? t.membersGroupLink}</T>
                  <T variant="caption" tone="muted">
                    {[
                      t.membersRole[invitation.role],
                      t.membersStatus(invitation.status),
                      invitation.kind === "group_link" || invitation.kind === "qr"
                        ? t.membersJoined(invitation.useCount)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </T>
                </View>
              </View>
            ))}
          </ListSurface>
        )}
      </View>
    </StackScreen>
  );
}
