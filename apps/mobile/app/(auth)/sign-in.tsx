import { PASSWORD_MIN_LENGTH } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import { InviteLinkSheet } from "../../src/features/invite-link-sheet";
import { LinkSent, type SentKind } from "../../src/features/link-sent";
import { authClient } from "../../src/lib/auth-client";
import {
  failureMessage,
  linkRequestOutcome,
  normalizedEmail,
  passwordSignInOutcome,
  type LinkOutcome,
} from "../../src/lib/sign-in";
import {
  appleAvailable,
  googleAvailable,
  signInWithApple,
  signInWithGoogle,
  socialErrorMessage,
} from "../../src/lib/social-auth";
import { useSession } from "../../src/lib/session-store";
import { KeyRound, Mail } from "../../src/ui/icons";
import { PasswordField } from "../../src/ui/password-field";
import { Button, Card, Divider, Field, LaneLine, ScreenTitle, T } from "../../src/ui/primitives";
import { useSceneStatusBar } from "../../src/ui/screen";
import { scene, space, usePagePad } from "../../src/ui/theme";

const CALLBACK = "/callback";
const t = m.account.signIn;

type Intent = "signin" | "create";

// L'adresse d'abord, puis deux chemins de même rang : le mot de passe, ou un lien reçu par e-mail.
// Le même formulaire sert à la connexion et à la création de compte ; seul le chemin par mot de passe diffère.
export default function SignIn() {
  useSceneStatusBar();
  const status = useSession((s) => s.status);
  const refresh = useSession((s) => s.refresh);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);
  const pad = usePagePad();
  // Une invitation ouvre la création de compte : la personne invitée n'en a souvent pas encore.
  const params = useLocalSearchParams<{ intent?: string }>();
  const [intent, setIntent] = useState<Intent>(params.intent === "create" ? "create" : "signin");
  const [step, setStep] = useState<"paths" | "password">("paths");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  // Une réussite qui demande une action, pas une erreur : elle ne s'affiche pas en rouge.
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [sent, setSent] = useState<{ kind: SentKind; email: string; notice?: string } | null>(null);
  const [pasting, setPasting] = useState(false);
  const [busy, setBusy] = useState<null | "magic" | "password" | "apple" | "google">(null);

  if (status === "signed-in") return <Redirect href="/" />;

  const creating = intent === "create";

  const checkEmail = (): string | null => {
    const value = normalizedEmail(email);
    if (!value) setErrors({ email: m.mobile.auth.emailInvalid });
    return value;
  };

  const requestLink = async (to: string): Promise<LinkOutcome> =>
    linkRequestOutcome(await authClient.signIn.magicLink({ email: to, callbackURL: CALLBACK }).catch(() => null));

  const sendLink = async () => {
    const value = checkEmail();
    if (!value) return;
    setErrors({});
    setFormNotice(null);
    setBusy("magic");
    const outcome = await requestLink(value);
    setBusy(null);
    if (outcome === "sent") setSent({ kind: "magic", email: value });
    else
      setErrors({
        form:
          outcome === "limited"
            ? t.rateLimited
            : outcome === "unreachable"
              ? m.auth.emailUnreachable
              : m.common.genericError,
      });
  };

  const choosePassword = () => {
    if (!checkEmail()) return;
    setErrors({});
    setFormNotice(null);
    setStep("password");
    setTimeout(() => passwordRef.current?.focus(), 50);
  };

  const submitPassword = async () => {
    const value = checkEmail();
    if (!value) return;
    if (creating && password.length < PASSWORD_MIN_LENGTH) {
      setErrors({ password: t.passwordTooShort(PASSWORD_MIN_LENGTH) });
      return;
    }
    if (!password) {
      setErrors({ password: t.passwordRequired });
      return;
    }
    setErrors({});
    setFormNotice(null);
    setBusy("password");
    if (creating) {
      const result = await authClient.signUp
        .email({ email: value, password, name: value.split("@")[0] ?? value, callbackURL: CALLBACK })
        .catch(() => null);
      setBusy(null);
      // Même écran qu'un compte existe déjà ou non : c'est l'e-mail qui fait la différence.
      if (!result || result.error) setErrors({ form: failureMessage(result?.error, m.common.genericError) });
      else {
        setPassword("");
        setSent({ kind: "verify", email: value });
      }
      return;
    }
    const result = await authClient.signIn.email({ email: value, password, callbackURL: CALLBACK }).catch(() => null);
    setBusy(null);
    if (!result) {
      setErrors({ form: m.common.genericError });
      return;
    }
    const outcome = passwordSignInOutcome(result.error);
    if (outcome.kind === "verify") {
      // Bon mot de passe sur une adresse pas encore confirmée : le lien de confirmation vient de repartir.
      setSent({ kind: "verify", email: value, notice: m.account.sent.verifyFirst });
      return;
    }
    if (outcome.kind === "error") {
      setErrors({ form: outcome.message });
      return;
    }
    await refresh();
    router.replace("/");
  };

  const social = async (provider: "apple" | "google") => {
    setBusy(provider);
    setErrors({});
    const result = await (provider === "apple" ? signInWithApple() : signInWithGoogle());
    setBusy(null);
    if (result === "cancelled") return;
    if (result === "failed") {
      setErrors({ form: socialErrorMessage });
      return;
    }
    await refresh();
    router.replace("/");
  };

  const askPasswordReset = async () => {
    const address = checkEmail();
    if (!address) return;
    setErrors({});
    const res = await authClient
      .requestPasswordReset({ email: address, redirectTo: "/nouveau-mot-de-passe" })
      .catch(() => null);
    // Même réponse que l'adresse existe ou non : le formulaire ne révèle pas qui a un compte.
    if (res?.error?.status === 429) setErrors({ form: t.rateLimited });
    else setFormNotice(m.auth.resetSent);
  };

  const hasSocial = appleAvailable || googleAvailable;
  const pending = busy !== null;

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
          {/* Sur fond rouge, le logotype seul : l'icône s'y perdrait. */}
          <T variant="title1" accessibilityLabel={m.brand.name}>
            {m.brand.name}
          </T>
          <ScreenTitle title={creating ? t.createTitle : m.auth.signInTitle} testID="sign-in-title" />
          <T variant="body" style={{ maxWidth: 320 }}>
            {creating ? t.createLead : m.auth.signInLead}
          </T>
          <LaneLine />
          {sent ? (
            <LinkSent
              kind={sent.kind}
              email={sent.email}
              notice={sent.notice}
              onResend={async () =>
                sent.kind === "magic"
                  ? requestLink(sent.email)
                  : linkRequestOutcome(
                      await authClient
                        .sendVerificationEmail({ email: sent.email, callbackURL: CALLBACK })
                        .catch(() => null),
                    )
              }
              onChangeEmail={() => {
                setSent(null);
                setStep("paths");
                setPassword("");
              }}
            />
          ) : (
            <>
              <Card>
                <Field
                  testID="sign-in-email"
                  label={m.auth.emailLabel}
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setErrors((e) => ({ ...e, email: undefined }));
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="username"
                  placeholder={m.auth.emailPlaceholder}
                  returnKeyType={step === "password" ? "next" : "go"}
                  onSubmitEditing={() => (step === "password" ? passwordRef.current?.focus() : choosePassword())}
                  error={errors.email}
                />
                {step === "password" ? (
                  <PasswordField
                    ref={passwordRef}
                    testID="sign-in-password"
                    purpose={creating ? "new" : "current"}
                    label={creating ? t.createPasswordLabel : t.passwordLabel}
                    hint={creating ? t.passwordHint(PASSWORD_MIN_LENGTH) : undefined}
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      setErrors((e) => ({ ...e, password: undefined }));
                    }}
                    returnKeyType="go"
                    onSubmitEditing={() => void submitPassword()}
                    error={errors.password}
                  />
                ) : null}
                {errors.form ? (
                  <T testID="sign-in-error" variant="small" tone="danger" accessibilityLiveRegion="assertive">
                    {errors.form}
                  </T>
                ) : null}
                {formNotice ? (
                  <T testID="sign-in-notice" variant="small" accessibilityLiveRegion="polite">
                    {formNotice}
                  </T>
                ) : null}
                {step === "paths" ? (
                  <View accessibilityLabel={t.paths} style={{ gap: space.md }}>
                    <Button
                      testID="sign-in-use-password"
                      label={creating ? t.createWithPassword : t.withPassword}
                      icon={KeyRound}
                      disabled={pending}
                      onPress={choosePassword}
                    />
                    <Button
                      testID="sign-in-magic"
                      label={creating ? t.createWithLink : t.withLink}
                      icon={Mail}
                      variant="secondary"
                      loading={busy === "magic"}
                      disabled={pending}
                      onPress={() => void sendLink()}
                    />
                  </View>
                ) : (
                  <View style={{ gap: space.md }}>
                    <Button
                      testID="sign-in-submit"
                      label={creating ? t.createSubmit : t.submit}
                      loading={busy === "password"}
                      disabled={pending}
                      onPress={() => void submitPassword()}
                    />
                    <Button
                      testID="sign-in-magic"
                      label={t.linkInstead}
                      icon={Mail}
                      variant="secondary"
                      loading={busy === "magic"}
                      disabled={pending}
                      onPress={() => void sendLink()}
                    />
                    {!creating ? (
                      <Button
                        testID="sign-in-forgot"
                        label={t.forgot}
                        variant="ghost"
                        compact
                        style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
                        onPress={() => void askPasswordReset()}
                      />
                    ) : null}
                  </View>
                )}
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
                testID="sign-in-switch-intent"
                label={creating ? t.haveAccount : t.noAccountYet}
                variant="ghost"
                compact
                style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
                onPress={() => {
                  setIntent(creating ? "signin" : "create");
                  setErrors({});
                  setFormNotice(null);
                }}
              />
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
