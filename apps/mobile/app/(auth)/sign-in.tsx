import { m } from "@tartan/i18n";
import { Redirect, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";
import * as AppleAuthentication from "expo-apple-authentication";
import { InviteLinkSheet } from "../../src/features/invite-link-sheet";
import { authClient } from "../../src/lib/auth-client";
import {
  appleAvailable,
  googleAvailable,
  signInWithApple,
  signInWithGoogle,
  socialErrorMessage,
} from "../../src/lib/social-auth";
import { useSession } from "../../src/lib/session-store";
import { Button, Card, Divider, Field, LaneLine, T } from "../../src/ui/primitives";
import { scene, space, usePagePad } from "../../src/ui/theme";

const CALLBACK = "/callback";
const emailSchema = z.email();

export default function SignIn() {
  const status = useSession((s) => s.status);
  const refresh = useSession((s) => s.refresh);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);
  const pad = usePagePad();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // Une réussite qui demande une action, pas une erreur : elle ne s'affiche pas en rouge.
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [busy, setBusy] = useState<null | "magic" | "password" | "apple" | "google">(null);

  if (status === "signed-in") return <Redirect href="/" />;

  const checkEmail = (): string | null => {
    const value = email.trim().toLowerCase();
    if (!emailSchema.safeParse(value).success) {
      setEmailError(m.mobile.auth.emailInvalid);
      return null;
    }
    setEmailError(null);
    return value;
  };

  const sendMagicLink = async () => {
    const value = checkEmail();
    if (!value) return;
    setBusy("magic");
    setFormError(null);
    const result = await authClient.signIn.magicLink({ email: value, callbackURL: CALLBACK }).catch(() => null);
    setBusy(null);
    if (!result || result.error) {
      setFormError(result?.error?.status === 429 ? m.errors.rateLimited : m.common.genericError);
      return;
    }
    setSentTo(value);
  };

  const submitPassword = async () => {
    const value = checkEmail();
    if (!value) return;
    if (creating && password.length < 10) {
      setPasswordError(m.mobile.auth.passwordTooShort);
      return;
    }
    if (!password) {
      setPasswordError(m.auth.invalidCredentials);
      return;
    }
    setPasswordError(null);
    setFormError(null);
    setFormNotice(null);
    setBusy("password");
    const result = await (
      creating
        ? authClient.signUp.email({ email: value, password, name: "" })
        : authClient.signIn.email({ email: value, password })
    ).catch(() => null);
    setBusy(null);
    if (!result) {
      setFormError(m.common.genericError);
      return;
    }
    if (result.error) {
      setFormError(
        result.error.status === 429
          ? m.errors.rateLimited
          : result.error.status === 403
            ? m.auth.verifyFirst
            : result.error.status === 401
              ? m.auth.invalidCredentials
              : (result.error.message ?? m.common.genericError),
      );
      return;
    }
    // Compte créé : la session n'existe qu'une fois l'adresse confirmée par e-mail.
    if (creating) {
      setFormNotice(m.auth.verifySent);
      setCreating(false);
      setPassword("");
      return;
    }
    await refresh();
    router.replace("/");
  };

  const social = async (provider: "apple" | "google") => {
    setBusy(provider);
    setFormError(null);
    const result = await (provider === "apple" ? signInWithApple() : signInWithGoogle());
    setBusy(null);
    if (result === "cancelled") return;
    if (result === "failed") {
      setFormError(socialErrorMessage);
      return;
    }
    await refresh();
    router.replace("/");
  };

  const hasSocial = appleAvailable || googleAvailable;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: scene.page }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
        bounces={false}
      >
        <View
          style={{
            flexGrow: 1,
            paddingTop: insets.top + space.xxl,
            paddingHorizontal: pad,
            paddingBottom: insets.bottom + space.xxl,
            gap: space.xl,
          }}
        >
          {/* Sur fond rouge, le logotype seul : l'icône s'y perdrait (§ 9.2). */}
          <T variant="title1" accessibilityLabel={m.brand.name}>
            {m.brand.name}
          </T>
          <T variant="screen" heading testID="sign-in-title" maxFontSizeMultiplier={1.3}>
            {m.auth.signInTitle}
          </T>
          <T variant="body" style={{ maxWidth: 320 }}>
            {m.auth.signInLead}
          </T>
          <LaneLine />
          {sentTo ? (
            <Card>
              <View style={{ gap: space.md }} accessibilityLiveRegion="polite">
                <T variant="title1" heading>
                  {m.mobile.auth.linkTitle}
                </T>
                <T>{m.mobile.auth.linkBody(sentTo)}</T>
                <T tone="muted" variant="small">
                  {m.mobile.auth.openOnPhone}
                </T>
                <Button label={m.mobile.auth.useOtherEmail} variant="secondary" onPress={() => setSentTo(null)} />
              </View>
            </Card>
          ) : (
            <>
              <Card>
                <Field
                  testID="sign-in-email"
                  label={m.auth.emailLabel}
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setEmailError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="username"
                  placeholder={m.auth.emailPlaceholder}
                  returnKeyType={usePassword ? "next" : "send"}
                  onSubmitEditing={() => (usePassword ? passwordRef.current?.focus() : void sendMagicLink())}
                  error={emailError}
                />
                {usePassword ? (
                  <>
                    <Field
                      ref={passwordRef}
                      testID="sign-in-password"
                      label={m.auth.passwordLabel}
                      value={password}
                      onChangeText={(v) => {
                        setPassword(v);
                        setPasswordError(null);
                      }}
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete={creating ? "new-password" : "current-password"}
                      textContentType={creating ? "newPassword" : "password"}
                      returnKeyType="go"
                      onSubmitEditing={() => void submitPassword()}
                      error={passwordError}
                    />
                    <Button
                      testID="sign-in-submit"
                      label={creating ? m.auth.signUpWithPassword : m.auth.signInWithPassword}
                      loading={busy === "password"}
                      onPress={() => void submitPassword()}
                    />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs, flexWrap: "wrap" }}>
                      <T variant="small" tone="muted">
                        {creating ? m.auth.hasAccount : m.auth.noAccount}
                      </T>
                      <Button
                        label={creating ? m.auth.signInWithPassword : m.auth.signUpWithPassword}
                        variant="ghost"
                        compact
                        style={{ paddingHorizontal: space.sm }}
                        onPress={() => {
                          setCreating(!creating);
                          setFormError(null);
                          setFormNotice(null);
                        }}
                      />
                    </View>
                    <Button
                      label={m.auth.useMagicLink}
                      variant="secondary"
                      compact
                      onPress={() => setUsePassword(false)}
                    />
                  </>
                ) : (
                  <>
                    <Button
                      testID="sign-in-magic"
                      label={m.auth.sendMagicLink}
                      loading={busy === "magic"}
                      onPress={() => void sendMagicLink()}
                    />
                    <Button
                      testID="sign-in-use-password"
                      label={m.auth.usePassword}
                      variant="secondary"
                      compact
                      onPress={() => setUsePassword(true)}
                    />
                  </>
                )}
                {formError ? (
                  <T variant="small" tone="danger" accessibilityLiveRegion="assertive">
                    {formError}
                  </T>
                ) : null}
                {formNotice ? (
                  <T testID="sign-in-notice" variant="small" accessibilityLiveRegion="polite">
                    {formNotice}
                  </T>
                ) : null}
                {hasSocial ? (
                  <View style={{ gap: space.sm }}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center", gap: space.md, marginVertical: space.xs }}
                    >
                      <View style={{ flex: 1 }}>
                        <Divider />
                      </View>
                      <T variant="caption" tone="muted">
                        {m.mobile.auth.or}
                      </T>
                      <View style={{ flex: 1 }}>
                        <Divider />
                      </View>
                    </View>
                    {appleAvailable && Platform.OS === "ios" ? (
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                        cornerRadius={26}
                        style={{ height: 52 }}
                        onPress={() => void social("apple")}
                      />
                    ) : null}
                    {appleAvailable && Platform.OS !== "ios" ? (
                      <Button
                        label={m.auth.withApple}
                        variant="secondary"
                        loading={busy === "apple"}
                        onPress={() => void social("apple")}
                      />
                    ) : null}
                    {googleAvailable ? (
                      <Button
                        label={m.auth.withGoogle}
                        variant="secondary"
                        loading={busy === "google"}
                        onPress={() => void social("google")}
                      />
                    ) : null}
                  </View>
                ) : null}
              </Card>
              <Button
                testID="invite-link-open"
                label={m.mobile.inviteLink.open}
                variant="ghost"
                compact
                style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
                onPress={() => setPasting(true)}
              />
              <T variant="caption">{m.auth.consentNotice}</T>
            </>
          )}
        </View>
      </ScrollView>
      {pasting ? <InviteLinkSheet onClose={() => setPasting(false)} /> : null}
    </KeyboardAvoidingView>
  );
}
