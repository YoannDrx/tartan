"use client";

import type { PlatformSettings } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { Confirm } from "./console-actions";
import {
  addPlatformAdminAction,
  reconcileVideosAction,
  removePlatformAdminAction,
  sendTestEmailsAction,
  updatePlatformSettingsAction,
} from "./configuration.action";

const onError = ({ error }: { error: { serverError?: string } }) =>
  toast.error(error.serverError ?? m.common.genericError);
const t = m.admin.config;

export const SettingsForm = ({ settings }: { settings: PlatformSettings }) => {
  const router = useRouter();
  const [signupMode, setSignupMode] = useState(settings.signupMode);
  const [checkout, setCheckout] = useState(settings.checkoutEnabled);
  const [limit, setLimit] = useState(settings.muxVideoLimit === null ? "" : String(settings.muxVideoLimit));
  const save = useAction(updatePlatformSettingsAction, {
    onSuccess: () => {
      toast.ok(t.saved);
      router.refresh();
    },
    onError,
  });
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 tablet:grid-cols-3">
        <Field label={t.signupMode}>
          {(a) => (
            <Select {...a} value={signupMode} onChange={(e) => setSignupMode(e.target.value as "closed" | "public")}>
              <option value="closed">{t.signupClosed}</option>
              <option value="public">{t.signupPublic}</option>
            </Select>
          )}
        </Field>
        <Field label={t.checkout}>
          {(a) => (
            <Select {...a} value={checkout ? "on" : "off"} onChange={(e) => setCheckout(e.target.value === "on")}>
              <option value="on">{t.checkoutOn}</option>
              <option value="off">{t.checkoutOff}</option>
            </Select>
          )}
        </Field>
        <Field label={t.videoLimit} hint={t.videoLimitHint}>
          {(a) => <Input {...a} inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} />}
        </Field>
      </div>
      <div>
        <Confirm
          label={m.common.save}
          detail={signupMode === "public" ? t.confirmPublic : t.confirmSettings}
          disabled={save.isPending || (limit !== "" && !/^[1-9]\d*$/.test(limit))}
          onConfirm={() =>
            save.execute({
              signupMode,
              checkoutEnabled: checkout,
              muxVideoLimit: limit === "" ? null : Number(limit),
            })
          }
        />
      </div>
    </div>
  );
};

export const AdminsPanel = ({
  canManage,
  roots,
  others,
}: {
  canManage: boolean;
  roots: string[];
  others: { email: string; enrollUntil: Date | null }[];
}) => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const add = useAction(addPlatformAdminAction, {
    onSuccess: () => {
      setEmail("");
      router.refresh();
    },
    onError,
  });
  const remove = useAction(removePlatformAdminAction, { onSuccess: () => router.refresh(), onError });
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-card-line">
        {roots.map((value) => (
          <li key={value} className="flex min-h-11 items-center justify-between gap-3 py-1">
            <span className="min-w-0 truncate">{value}</span>
            <span className="t-caption text-soft">{t.rootAdmin}</span>
          </li>
        ))}
        {others.map((row) => (
          <li key={row.email} className="flex min-h-11 items-center justify-between gap-3 py-1">
            <span className="min-w-0 truncate">{row.email}</span>
            {canManage ? (
              <Confirm
                label={t.removeAdmin}
                detail={t.removeAdminDetail(row.email)}
                disabled={remove.isPending}
                onConfirm={() => remove.execute({ email: row.email })}
              />
            ) : null}
          </li>
        ))}
      </ul>
      {canManage ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add.execute({ email });
          }}
        >
          <Field label={t.addAdmin} hint={t.addAdminHint}>
            {(a) => <Input {...a} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Button type="submit" size="sm" variant="secondary" disabled={add.isPending}>
            {t.addAdminButton}
          </Button>
        </form>
      ) : null}
    </div>
  );
};

export const BackupPasskey = () => {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const created = await authClient.passkey.addPasskey().catch(() => ({ error: true }));
        setBusy(false);
        if (created?.error) toast.error(t.backupPasskeyFailed);
        else toast.ok(t.backupPasskeyDone);
      }}
    >
      {t.backupPasskey}
    </Button>
  );
};

export const TestEmails = ({ keys, defaultTo }: { keys: string[]; defaultTo: string }) => {
  const [to, setTo] = useState(defaultTo);
  const [key, setKey] = useState("all");
  const send = useAction(sendTestEmailsAction, {
    onSuccess: ({ data }) => toast.ok(t.testSent(data?.sent ?? 0)),
    onError,
  });
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        send.execute({ to, key });
      }}
    >
      <Field label={t.testTo}>
        {(a) => <Input {...a} type="email" required value={to} onChange={(e) => setTo(e.target.value)} />}
      </Field>
      <Field label={t.testKey}>
        {(a) => (
          <Select {...a} value={key} onChange={(e) => setKey(e.target.value)}>
            <option value="all">{t.testAll(keys.length)}</option>
            {keys.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={send.isPending}>
        {send.isPending ? t.testSending : t.testSend}
      </Button>
    </form>
  );
};

export const ReconcileVideos = () => {
  const router = useRouter();
  const run = useAction(reconcileVideosAction, {
    onSuccess: ({ data }) => {
      toast.ok(t.reconcileDone(data?.repaired ?? 0, data?.failed ?? 0));
      router.refresh();
    },
    onError,
  });
  return (
    <Button size="sm" variant="secondary" disabled={run.isPending} onClick={() => run.execute()}>
      {t.reconcile}
    </Button>
  );
};
