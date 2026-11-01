import { m } from "@tartan/i18n";
import { Redirect, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";
import { authClient } from "../../src/lib/auth-client";
import { config } from "../../src/lib/config";
import { useSession } from "../../src/lib/session-store";
import { LaneArcs } from "../../src/ui/glyphs";
import { Button, Divider, Field, T } from "../../src/ui/primitives";
import { color, GUTTER, radius, space } from "../../src/ui/theme";

const CALLBACK = "/callback";
const emailSchema = z.email();

export default function SignIn() {
  const status = useSession((s) => s.status);
  const refresh = useSession((s) => s.refresh);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
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
      const known = result.error.status === 401 || result.error.status === 403;
      setFormError(
        result.error.status === 429
          ? m.errors.rateLimited
          : known
            ? m.auth.invalidCredentials
            : (result.error.message ?? m.common.genericError),
      );
      return;
    }
    await refresh();
    router.replace("/");
  };

  const social = async (provider: "apple" | "google") => {
    setBusy(provider);
    setFormError(null);
    const result = await authClient.signIn.social({ provider, callbackURL: CALLBACK }).catch(() => null);
    setBusy(null);
    if (!result || result.error) {
      setFormError(m.mobile.auth.socialFailed);
      return;
    }
    await refresh();
    router.replace("/");
  };

  const hasSocial = config.appleSignIn || config.googleSignIn;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: color.brand }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
        bounces={false}
      >
        <View
          style={{
            paddingTop: insets.top + space.xxl,
            paddingHorizontal: GUTTER,
            paddingBottom: space.xxl,
            gap: space.lg,
            overflow: "hidden",
            minHeight: 240,
          }}
        >
          <View
            style={{ position: "absolute", right: -40, bottom: -70 }}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <LaneArcs color={color.white} width={260} height={260} />
          </View>
          {/* Sur fond rouge, le logotype seul : l'icône s'y perdrait (§ 9.2). */}
          <T variant="title1" tone="white" accessibilityLabel={m.brand.name}>
            {m.brand.name}
          </T>
          <T variant="display" tone="white" heading testID="sign-in-title">
            {m.auth.signInTitle}
          </T>
          <T variant="body" tone="white" style={{ maxWidth: 280 }}>
            {m.auth.signInLead}
          </T>
        </View>

        <View
          style={{
            flexGrow: 1,
            backgroundColor: color.bg,
            borderTopLeftRadius: radius.hero,
            borderTopRightRadius: radius.hero,
            paddingHorizontal: GUTTER,
            paddingTop: space.xxl,
            paddingBottom: insets.bottom + space.xxl,
            gap: space.lg,
          }}
        >
          {sentTo ? (
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
          ) : (
            <>
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
              {hasSocial ? (
                <View style={{ gap: space.sm }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, marginVertical: space.xs }}>
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
                  {config.appleSignIn ? (
                    <Button
                      label={m.auth.withApple}
                      variant="secondary"
                      loading={busy === "apple"}
                      onPress={() => void social("apple")}
                    />
                  ) : null}
                  {config.googleSignIn ? (
                    <Button
                      label={m.auth.withGoogle}
                      variant="secondary"
                      loading={busy === "google"}
                      onPress={() => void social("google")}
                    />
                  ) : null}
                </View>
              ) : null}
              <T variant="caption" tone="muted">
                {m.auth.consentNotice}
              </T>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
