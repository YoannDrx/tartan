import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PASSWORD_MIN_LENGTH, type SignInMethodsResponse } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { View } from "react-native";
import { api } from "../lib/api";
import { CONFIRM_PASSWORD_CALLBACK } from "../lib/auth-callback";
import { authClient } from "../lib/auth-client";
import { errorMessage } from "../lib/errors";
import { linkRequestOutcome } from "../lib/sign-in";
import { PasswordField } from "../ui/password-field";
import { Button, T } from "../ui/primitives";
import { space } from "../ui/theme";
import { ToggleRow } from "./settings-rows";

const c = m.account.connexion;

const Status = ({ notice, error, testID }: { notice: string | null; error: string | null; testID?: string }) => (
  <View accessibilityLiveRegion="polite">
    {notice ? (
      <T testID={testID} variant="small">
        {notice}
      </T>
    ) : null}
    {error ? (
      <T testID={testID ? `${testID}-error` : undefined} variant="small" tone="danger">
        {error}
      </T>
    ) : null}
  </View>
);

// La session date de plus d'une heure : un lien de connexion rouvre l'app sur la rubrique Connexion, avec une
// session neuve. Le serveur ne laisse définir un mot de passe qu'à une connexion récente.
export const ConfirmBeforePassword = ({ email }: { email: string }) => {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: async () => {
      const result = await authClient.signIn
        .magicLink({ email, callbackURL: CONFIRM_PASSWORD_CALLBACK })
        .catch(() => null);
      return linkRequestOutcome(result);
    },
    onSuccess: (outcome) => {
      setNotice(outcome === "sent" ? c.define.confirmSent(email) : null);
      setError(
        outcome === "limited" ? m.account.sent.resendLimited : outcome === "sent" ? null : m.common.genericError,
      );
    },
  });
  return (
    <View style={{ gap: space.md }}>
      <T variant="small">{c.define.confirmLead}</T>
      <Button
        testID="password-confirm-link"
        label={c.define.confirmCta}
        variant="secondary"
        loading={send.isPending}
        onPress={() => send.mutate()}
      />
      <Status notice={notice} error={error} testID="password-confirm-status" />
    </View>
  );
};

// Définir un mot de passe sur un compte qui n'en a pas, la session étant récente.
export const DefinePasswordForm = ({
  methods,
  submitLabel = c.define.submit,
  fieldLabel = c.define.field,
  doneLabel = c.define.done,
  onDone,
  testID = "password-define",
}: {
  methods: SignInMethodsResponse;
  submitLabel?: string;
  fieldLabel?: string;
  doneLabel?: string;
  onDone?: () => void;
  testID?: string;
}) => {
  const client = useQueryClient();
  const [value, setValue] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const define = useMutation({
    mutationFn: () => api.setPassword({ newPassword: value }),
    onSuccess: (result) => {
      setError(null);
      setValue("");
      setNotice(result.status === "set" ? doneLabel : c.define.confirmSent(methods.email));
      void client.invalidateQueries({ queryKey: ["sign-in-methods"] });
      if (result.status === "set") onDone?.();
    },
    onError: (failure) => setError(errorMessage(failure)),
  });
  const submit = () => {
    setNotice(null);
    if (value.length < PASSWORD_MIN_LENGTH) {
      setFieldError(m.account.signIn.passwordTooShort(PASSWORD_MIN_LENGTH));
      return;
    }
    setFieldError(null);
    define.mutate();
  };
  return (
    <View style={{ gap: space.md }}>
      <PasswordField
        testID={`${testID}-field`}
        purpose="new"
        label={fieldLabel}
        hint={m.account.signIn.passwordHint(PASSWORD_MIN_LENGTH)}
        value={value}
        onChangeText={(next) => {
          setValue(next);
          setFieldError(null);
        }}
        returnKeyType="go"
        onSubmitEditing={submit}
        error={fieldError}
      />
      <Button testID={`${testID}-submit`} label={submitLabel} loading={define.isPending} onPress={submit} />
      <Status notice={notice} error={error} testID={`${testID}-status`} />
    </View>
  );
};

// Changer le mot de passe : l'actuel est demandé, et les autres appareils peuvent être déconnectés.
export const ChangePasswordForm = () => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [revoke, setRevoke] = useState(false);
  const [errors, setErrors] = useState<{ current?: string; next?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: () => api.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: revoke }),
    onSuccess: () => {
      setError(null);
      setCurrent("");
      setNext("");
      setNotice(revoke ? c.change.doneRevoked : c.change.done);
    },
    onError: (failure) => setError(errorMessage(failure)),
  });
  const submit = () => {
    setNotice(null);
    setError(null);
    const found = {
      current: current ? undefined : c.change.currentRequired,
      next: next.length < PASSWORD_MIN_LENGTH ? m.account.signIn.passwordTooShort(PASSWORD_MIN_LENGTH) : undefined,
    };
    setErrors(found);
    if (found.current || found.next) return;
    change.mutate();
  };
  return (
    <View style={{ gap: space.md }}>
      <PasswordField
        testID="password-current"
        purpose="current"
        label={c.change.current}
        value={current}
        onChangeText={(value) => {
          setCurrent(value);
          setErrors((e) => ({ ...e, current: undefined }));
        }}
        error={errors.current}
      />
      <PasswordField
        testID="password-next"
        purpose="new"
        label={c.change.next}
        hint={m.account.signIn.passwordHint(PASSWORD_MIN_LENGTH)}
        value={next}
        onChangeText={(value) => {
          setNext(value);
          setErrors((e) => ({ ...e, next: undefined }));
        }}
        error={errors.next}
      />
      <ToggleRow
        testID="password-revoke-others"
        title={c.change.revoke}
        detail={c.change.revokeDetail}
        value={revoke}
        disabled={change.isPending}
        onChange={setRevoke}
      />
      <Button testID="password-change-submit" label={c.change.submit} loading={change.isPending} onPress={submit} />
      <Status notice={notice} error={error} testID="password-change-status" />
    </View>
  );
};
