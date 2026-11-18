"use client";

import type { InvitationStatus } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { pillClass } from "@/components/filter-pill";
import { Chip } from "@/components/states";
import { Button } from "@/components/ui/button";
import { CheckRow, Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import {
  createInvitationAction,
  regenerateInvitationLinkAction,
  resendInvitationAction,
  revokeInvitationAction,
} from "@/features/invitations/invitation.action";
import { CopyButton, onErr, type AnyErrors } from "../shared";

const t = w.settings.membres;

export const InviteForm = ({
  groups,
  canInviteCoach,
}: {
  groups: { id: string; name: string }[];
  canInviteCoach: boolean;
}) => {
  const router = useRouter();
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [phone, setPhone] = useState("");
  const [smsLink, setSmsLink] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"athlete" | "coach" | "assistant">("athlete");
  const [groupIds, setGroupIds] = useState<string[]>(groups.length === 1 && groups[0] ? [groups[0].id] : []);
  const { execute, isPending, result } = useAction(createInvitationAction, {
    onSuccess: ({ data, input }) => {
      if (input.kind === "personal_sms" && data) {
        setSmsLink(`sms:${input.phone}?&body=${encodeURIComponent(`${m.settings.smsBody} ${data.link}`)}`);
      } else {
        setEmail("");
        toast.ok(t.invited);
      }
      router.refresh();
    },
    onError: onErr,
  });
  const errors = result.validationErrors as AnyErrors;
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setSmsLink(null);
        if (channel === "sms") execute({ kind: "personal_sms", phone, role, groupIds });
        else execute({ kind: "personal_email", email, role, groupIds });
      }}
    >
      <div role="group" aria-label={t.channel} className="flex gap-1.5">
        {(["email", "sms"] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={channel === c}
            className={pillClass(channel === c)}
            onClick={() => setChannel(c)}
          >
            {c === "email" ? m.settings.inviteByEmail : m.settings.inviteBySms}
          </button>
        ))}
      </div>
      <div className="grid gap-3 tablet:grid-cols-[minmax(0,1fr)_auto]">
        {channel === "email" ? (
          <Field label={m.auth.emailLabel} error={errors?.email?._errors?.[0]}>
            {(a) => (
              <Input {...a} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
          </Field>
        ) : (
          <Field label={m.settings.phone} hint={m.settings.smsHint} error={errors?.phone?._errors?.[0]}>
            {(a) => (
              <Input {...a} type="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />
            )}
          </Field>
        )}
        {canInviteCoach ? (
          <Field label={t.role}>
            {(a) => (
              <Select {...a} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                <option value="athlete">{m.roles.athlete}</option>
                <option value="coach">{m.roles.coach}</option>
                <option value="assistant">{m.roles.assistant}</option>
              </Select>
            )}
          </Field>
        ) : null}
      </div>
      {groups.length > 1 ? (
        <fieldset className="flex flex-wrap gap-x-4">
          <legend className="t-caption">{m.settings.groups}</legend>
          {groups.map((g) => (
            <CheckRow
              key={g.id}
              label={g.name}
              checked={groupIds.includes(g.id)}
              onChange={(e) => setGroupIds(e.target.checked ? [...groupIds, g.id] : groupIds.filter((x) => x !== g.id))}
            />
          ))}
        </fieldset>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {channel === "sms" ? m.settings.createSmsLink : m.common.send}
        </Button>
        {smsLink ? (
          <Button asChild size="sm" variant="secondary">
            <a href={smsLink}>{m.settings.openSms}</a>
          </Button>
        ) : null}
      </div>
    </form>
  );
};

export const InvitationList = ({
  invitations,
}: {
  invitations: {
    id: string;
    kind: string;
    role: string;
    email: string | null;
    phone: string | null;
    status: InvitationStatus;
    useCount: number;
    link: string | null;
  }[];
}) => {
  const router = useRouter();
  const revoke = useAction(revokeInvitationAction, { onSuccess: () => router.refresh(), onError: onErr });
  const regenerate = useAction(regenerateInvitationLinkAction, {
    onSuccess: () => {
      toast.ok(m.settings.linkRegenerated);
      router.refresh();
    },
    onError: onErr,
  });
  const resend = useAction(resendInvitationAction, {
    onSuccess: () => toast.ok(t.resent),
    onError: onErr,
  });
  if (invitations.length === 0) return <p className="text-soft">{t.empty}</p>;
  return (
    <ul className="divide-y divide-card-line">
      {invitations.map((inv) => {
        const label = inv.email ?? inv.phone ?? (inv.kind === "group_link" ? t.groupLink : t.qr);
        return (
          <li key={inv.id} className="flex flex-wrap items-center gap-x-1 gap-y-2 py-2">
            <div className="min-w-48 flex-1 leading-snug">
              <p className="break-all font-semibold">{label}</p>
              <p className="t-caption flex flex-wrap items-center gap-2 font-normal text-soft">
                <Chip>{m.invitationStatus[inv.status]}</Chip>
                {inv.kind === "group_link" || inv.kind === "qr"
                  ? t.joined(inv.useCount)
                  : m.roles[inv.role as keyof typeof m.roles]}
              </p>
            </div>
            {inv.link ? <CopyButton text={inv.link} label={m.settings.copyLink} /> : null}
            {inv.status !== "accepted" && inv.status !== "revoked" && inv.email ? (
              <Button size="sm" variant="quiet" onClick={() => resend.execute({ id: inv.id })}>
                {m.settings.resend}
              </Button>
            ) : null}
            {inv.status !== "revoked" && (inv.kind === "group_link" || inv.kind === "qr") ? (
              <Button size="sm" variant="quiet" onClick={() => regenerate.execute({ id: inv.id })}>
                {m.settings.regenerateLink}
              </Button>
            ) : null}
            {inv.status !== "revoked" ? (
              <Button size="sm" variant="quiet" onClick={() => revoke.execute({ id: inv.id })}>
                {m.settings.revoke}
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
};
