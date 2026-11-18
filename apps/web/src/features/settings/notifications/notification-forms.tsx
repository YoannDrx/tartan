"use client";

import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CheckRow } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { saveNotificationPreferencesAction } from "@/features/notifications/notifications.action";
import { currentPushSubscription, disablePush, enablePush } from "@/features/shell/push";
import { revokeIcalLinkAction, setEmailPreferenceAction } from "../settings.action";
import { onErr } from "../shared";

export const WebPushToggle = ({ vapidKey }: { vapidKey: string }) => {
  const [state, setState] = useState<"idle" | "on" | "denied">("idle");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void currentPushSubscription()
      .then((subscription) => {
        if (subscription) setState("on");
      })
      .catch(() => undefined);
  }, []);
  const enable = async () => {
    setBusy(true);
    const outcome = await enablePush(vapidKey).catch(() => "unavailable" as const);
    setBusy(false);
    if (outcome === "denied") return setState("denied");
    if (outcome !== "on") return toast.error(m.common.genericError);
    setState("on");
    toast.ok(m.push.enabled);
  };
  const disable = async () => {
    setBusy(true);
    await disablePush().catch(() => toast.error(m.common.genericError));
    setBusy(false);
    setState("idle");
  };
  return (
    <div className="flex flex-col items-start gap-2">
      <p>{m.push.permissionBody}</p>
      {state === "denied" ? <p className="text-alert">{m.settings.pushDenied}</p> : null}
      <Button size="sm" variant="secondary" disabled={busy} onClick={state === "on" ? disable : enable}>
        {state === "on" ? m.push.disable : m.push.enable}
      </Button>
    </div>
  );
};

export const NotificationCategories = ({
  sessions,
  feedback,
  group,
  product,
}: {
  sessions: boolean;
  feedback: boolean;
  group: boolean;
  product: boolean;
}) => {
  const { execute, isPending } = useAction(saveNotificationPreferencesAction, { onError: onErr });
  const row = (key: "sessions" | "feedback" | "group" | "product", value: boolean) => (
    <CheckRow
      label={m.inbox[key]}
      defaultChecked={value}
      disabled={isPending}
      onChange={(e) => execute({ notifications: { [key]: e.target.checked } })}
    />
  );
  return (
    <div className="flex flex-col gap-1">
      <p>{m.inbox.categoriesDetail}</p>
      {row("sessions", sessions)}
      {row("feedback", feedback)}
      {row("group", group)}
      {row("product", product)}
    </div>
  );
};

export const EmailPreferences = ({
  digest,
  notifications,
  tips,
  showDigest,
}: {
  digest: boolean;
  notifications: boolean;
  tips: boolean;
  showDigest: boolean;
}) => {
  const { execute, isPending } = useAction(setEmailPreferenceAction, { onError: onErr });
  return (
    <div className="flex flex-col gap-1">
      <p>{m.settings.emailsDetail}</p>
      <CheckRow
        label={m.settings.emailNotifications}
        defaultChecked={notifications}
        disabled={isPending}
        onChange={(e) => execute({ kind: "notifications", on: e.target.checked })}
      />
      {showDigest ? (
        <CheckRow
          label={m.settings.emailDigest}
          defaultChecked={digest}
          disabled={isPending}
          onChange={(e) => execute({ kind: "digest", on: e.target.checked })}
        />
      ) : null}
      {showDigest ? (
        <CheckRow
          label={m.settings.emailTips}
          defaultChecked={tips}
          disabled={isPending}
          onChange={(e) => execute({ kind: "tips", on: e.target.checked })}
        />
      ) : null}
    </div>
  );
};

export const RevokeIcalLink = () => {
  const { execute, isPending } = useAction(revokeIcalLinkAction, { onError: onErr });
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="secondary" disabled={isPending}>
          {m.settings.calendarRevoke}
        </Button>
      }
      title={m.settings.calendarRevoke}
      description={m.settings.calendarRevokeDetail}
      tone="neutral"
      confirmLabel={m.settings.calendarRevoke}
      onConfirm={() => execute()}
    />
  );
};
