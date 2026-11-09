"use client";

import { refundReasons, type RefundReason } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import {
  cancelAtPeriodEndAction,
  confirmRefundAction,
  confirmStoreAction,
  deleteUserAction,
  extendTrialAction,
  grantPlanAction,
  prepareRefundAction,
  resendVerificationAction,
  setMinimumVersionAction,
  setSuspendedAction,
  stopRolloutAction,
} from "./console.action";

const onError = ({ error }: { error: { serverError?: string } }) =>
  toast.error(error.serverError ?? m.common.genericError);

// Toute action sensible passe par une confirmation qui répète ce qu'elle va faire.
const Confirm = ({
  label,
  detail,
  disabled,
  onConfirm,
}: {
  label: string;
  detail: string;
  disabled?: boolean;
  onConfirm: () => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={label} description={detail}>
        <Button
          onClick={() => {
            setOpen(false);
            onConfirm();
          }}
        >
          {m.admin.confirm}
        </Button>
      </Dialog>
    </>
  );
};

export const UserActions = ({ userId, suspended, self }: { userId: string; suspended: boolean; self: boolean }) => {
  const router = useRouter();
  const resend = useAction(resendVerificationAction, { onSuccess: () => toast.ok(m.admin.done), onError });
  const suspend = useAction(setSuspendedAction, { onSuccess: () => router.refresh(), onError });
  const remove = useAction(deleteUserAction, { onSuccess: () => router.push("/admin/utilisateurs"), onError });
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" disabled={resend.isPending} onClick={() => resend.execute({ userId })}>
        {m.admin.resendVerification}
      </Button>
      {self ? null : (
        <Confirm
          label={suspended ? m.admin.restore : m.admin.suspend}
          detail={suspended ? m.admin.restoreDetail : m.admin.suspendDetail}
          disabled={suspend.isPending}
          onConfirm={() => suspend.execute({ userId, suspended: !suspended })}
        />
      )}
      {self ? null : (
        <Confirm
          label={m.admin.deleteUser}
          detail={m.admin.deleteUserDetail}
          disabled={remove.isPending}
          onConfirm={() => remove.execute({ userId })}
        />
      )}
    </div>
  );
};

export const GrantPlan = ({ organizationId, plan }: { organizationId: string; plan: string }) => {
  const router = useRouter();
  const [value, setValue] = useState(plan);
  const grant = useAction(grantPlanAction, { onSuccess: () => router.refresh(), onError });
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={m.admin.plan}>
        {(a) => (
          <Select {...a} value={value} onChange={(e) => setValue(e.target.value)}>
            {(["discovery", "coach", "club", "pilot"] as const).map((key) => (
              <option key={key} value={key}>
                {m.billing.plans[key]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Confirm
        label={m.admin.grantPlan}
        detail={m.admin.grantPlanDetail}
        disabled={grant.isPending}
        onConfirm={() => grant.execute({ organizationId, plan: value as "coach" })}
      />
    </div>
  );
};

export const SubscriptionActions = ({ subscriptionId }: { subscriptionId: string }) => {
  const router = useRouter();
  const cancel = useAction(cancelAtPeriodEndAction, { onSuccess: () => router.refresh(), onError });
  const extend = useAction(extendTrialAction, { onSuccess: () => router.refresh(), onError });
  return (
    <div className="flex flex-wrap gap-2">
      <Confirm
        label={m.admin.cancelAtEnd}
        detail={m.admin.cancelAtEndDetail}
        disabled={cancel.isPending}
        onConfirm={() => cancel.execute({ subscriptionId })}
      />
      <Confirm
        label={m.admin.extendTrial}
        detail={m.admin.extendTrialDetail}
        disabled={extend.isPending}
        onConfirm={() => extend.execute({ subscriptionId, days: 14 })}
      />
    </div>
  );
};

const toCents = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);

export const RefundForm = ({
  invoiceId,
  refundableCents,
  withdrawalOpen,
}: {
  invoiceId: string;
  refundableCents: number;
  withdrawalOpen: boolean;
}) => {
  const router = useRouter();
  const [amount, setAmount] = useState((refundableCents / 100).toFixed(2).replace(".", ","));
  const [reasonCode, setReason] = useState<RefundReason>(withdrawalOpen ? "withdrawal" : "goodwill");
  const [note, setNote] = useState("");
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState<{ refundId: string; token: string; amountCents: number } | null>(null);
  const prepare = useAction(prepareRefundAction, {
    onSuccess: ({ data }) => (data ? setPending(data) : undefined),
    onError,
  });
  const confirm = useAction(confirmRefundAction, {
    onSuccess: ({ data }) => {
      setPending(null);
      setTyped("");
      if (data?.state === "succeeded") toast.ok(m.admin.refundDone);
      else if (data?.state === "pending") toast.ok(m.admin.refundPending);
      else toast.error(m.admin.refundFailed);
      router.refresh();
    },
    onError,
  });
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        prepare.execute({
          invoiceId,
          amountCents: toCents(amount),
          reasonCode,
          withdrawal: reasonCode === "withdrawal",
          note: note.trim() || null,
        });
      }}
    >
      <Field label={m.admin.refundAmount}>
        {(a) => (
          <Input {...a} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        )}
      </Field>
      <Field label={m.admin.refundReason}>
        {(a) => (
          <Select {...a} value={reasonCode} onChange={(e) => setReason(e.target.value as RefundReason)}>
            {refundReasons.map((reason) => (
              <option key={reason} value={reason}>
                {m.admin.refundReasons[reason]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={m.admin.refundNote} hint={m.admin.refundNoteHint}>
        {(a) => <Input {...a} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      <div>
        <Button type="submit" size="sm" disabled={prepare.isPending || refundableCents <= 0}>
          {m.admin.refundPrepare}
        </Button>
      </div>
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={m.admin.refundConfirmTitle}
        description={m.admin.refundConfirmDetail}
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (pending) confirm.execute(pending);
          }}
        >
          <Field label={m.admin.refundRetype}>
            {(a) => (
              <Input {...a} inputMode="decimal" value={typed} onChange={(e) => setTyped(e.target.value)} required />
            )}
          </Field>
          <Button type="submit" disabled={confirm.isPending || !pending || toCents(typed) !== pending.amountCents}>
            {m.admin.refundConfirm}
          </Button>
        </form>
      </Dialog>
    </form>
  );
};

export const ReleaseActions = ({ id, canConfirm, canStop }: { id: string; canConfirm: boolean; canStop: boolean }) => {
  const router = useRouter();
  const store = useAction(confirmStoreAction, { onSuccess: () => router.refresh(), onError });
  const stop = useAction(stopRolloutAction, { onSuccess: () => router.refresh(), onError });
  return (
    <div className="flex flex-wrap gap-2">
      {canConfirm ? (
        <Confirm
          label={m.admin.confirmStore}
          detail={m.admin.confirmStoreDetail}
          disabled={store.isPending}
          onConfirm={() => store.execute({ id })}
        />
      ) : null}
      {canStop ? (
        <Confirm
          label={m.admin.stopRollout}
          detail={m.admin.stopRolloutDetail}
          disabled={stop.isPending}
          onConfirm={() => stop.execute({ id })}
        />
      ) : null}
    </div>
  );
};

export const MinimumVersionForm = ({ platform, current }: { platform: "ios" | "android"; current: string | null }) => {
  const router = useRouter();
  const [version, setVersion] = useState(current ?? "");
  const save = useAction(setMinimumVersionAction, { onSuccess: () => router.refresh(), onError });
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save.execute({ platform, minimumVersion: version.trim() || null, reason: null });
      }}
    >
      <Field label={m.admin.minimumVersion(m.admin.platformName(platform))} hint={m.admin.minimumVersionHint}>
        {(a) => <Input {...a} value={version} placeholder="1.2.0" onChange={(e) => setVersion(e.target.value)} />}
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={save.isPending}>
        {m.admin.save}
      </Button>
    </form>
  );
};

export const PasskeyGate = ({ hasPasskey, next }: { hasPasskey: boolean; next: string }) => {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const verify = async () => {
    const result = await authClient.signIn.passkey();
    if (result?.error) throw new Error("passkey");
    router.replace(next);
    router.refresh();
  };
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    await task().catch(() => toast.error(m.admin.passkeyFailed));
    setBusy(false);
  };
  if (hasPasskey) {
    return (
      <Button disabled={busy} onClick={() => run(verify)}>
        {m.admin.passkeyVerify}
      </Button>
    );
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          const created = await authClient.passkey.addPasskey({
            fetchOptions: { headers: { "x-admin-bootstrap": token } },
          });
          if (created?.error) throw new Error("passkey");
          await verify();
        });
      }}
    >
      <Field label={m.admin.bootstrapToken}>
        {(a) => <Input {...a} type="password" value={token} onChange={(e) => setToken(e.target.value)} required />}
      </Field>
      <div>
        <Button type="submit" disabled={busy}>
          {m.admin.passkeyCreate}
        </Button>
      </div>
    </form>
  );
};
