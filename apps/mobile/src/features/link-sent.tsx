import { m } from "@tartan/i18n";
import { useEffect, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { cooldownAfter, secondsLeft, type LinkOutcome } from "../lib/sign-in";
import { MailCheck } from "../ui/icons";
import { Button, Card, Divider, T } from "../ui/primitives";
import { space, usePalette } from "../ui/theme";

export type SentKind = "magic" | "verify";

const t = m.account.sent;

// L'écran d'attente après l'envoi d'un lien : il rappelle l'adresse, permet de renvoyer le lien et de changer
// d'adresse, et dit quoi faire si rien n'arrive. Le même que sur le web (`link-sent.tsx`).
export const LinkSent = ({
  kind,
  email,
  notice,
  onResend,
  onChangeEmail,
}: {
  kind: SentKind;
  email: string;
  // Une précision sur la raison de l'attente (adresse pas encore confirmée).
  notice?: string;
  onResend: () => Promise<LinkOutcome>;
  onChangeEmail: () => void;
}) => {
  const p = usePalette();
  const [clock, setClock] = useState(() => {
    const now = Date.now();
    return { now, until: now + cooldownAfter("sent") };
  });
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<LinkOutcome | null>(null);
  const wait = secondsLeft(clock.until, clock.now);
  const title = kind === "magic" ? t.magicTitle : t.verifyTitle;

  // L'écran remplace le formulaire : le lecteur d'écran annonce son titre et l'adresse.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${title}. ${email}`);
  }, [title, email]);

  useEffect(() => {
    const tick = setInterval(() => setClock((current) => ({ ...current, now: Date.now() })), 1000);
    return () => clearInterval(tick);
  }, []);

  const resend = async () => {
    setPending(true);
    setOutcome(null);
    const result = await onResend();
    setPending(false);
    setOutcome(result);
    const now = Date.now();
    setClock({ now, until: now + cooldownAfter(result) });
  };

  const status =
    outcome === "sent"
      ? t.resent
      : outcome === "limited"
        ? t.resendLimited
        : outcome === "unreachable"
          ? m.auth.emailUnreachable
          : outcome === "failed"
            ? m.common.genericError
            : null;

  return (
    <Card testID="link-sent">
      <View style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
        <MailCheck size={24} color={p.text} accessibilityElementsHidden importantForAccessibility="no" />
        <View style={{ flex: 1, gap: space.xs }}>
          <T variant="title2" heading testID="link-sent-title">
            {title}
          </T>
          {notice ? <T variant="bodyStrong">{notice}</T> : null}
          <T>{kind === "magic" ? t.magicLead : t.verifyLead}</T>
          <T variant="bodyStrong" testID="link-sent-email">
            {email}
          </T>
          <T>{kind === "magic" ? t.magicDetail : t.verifyDetail}</T>
        </View>
      </View>
      <Button
        testID="link-sent-resend"
        label={wait > 0 ? t.resendIn(wait) : t.resend}
        variant="secondary"
        loading={pending}
        disabled={wait > 0}
        onPress={() => void resend()}
      />
      <Button testID="link-sent-change" label={t.changeEmail} variant="ghost" onPress={onChangeEmail} />
      <View accessibilityLiveRegion="polite">
        {status ? (
          <T variant="small" tone={outcome === "sent" ? "default" : "danger"}>
            {status}
          </T>
        ) : null}
      </View>
      <Divider />
      <View style={{ gap: space.xs }}>
        <T variant="smallStrong" heading>
          {t.helpTitle}
        </T>
        {t.help.map((line) => (
          <View key={line} style={{ flexDirection: "row", gap: space.sm }}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: p.textMuted, marginTop: 9 }}
            />
            <T variant="small" style={{ flex: 1 }}>
              {line}
            </T>
          </View>
        ))}
      </View>
    </Card>
  );
};
