"use client";

import type { InvitationStatus } from "@tartan/contracts";
import { tokens } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import { Check, Copy, Pencil, QrCode, Trash2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Image from "next/image";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { pillClass } from "@/components/filter-pill";
import { Chip } from "@/components/states";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CheckRow, Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import {
  createInvitationAction,
  groupLinkAction,
  resendInvitationAction,
  revokeInvitationAction,
} from "@/features/invitations/invitation.action";
import {
  deleteAccountAction,
  deleteGroupAction,
  saveGroupAction,
  setConsentAction,
  updateOrganizationAction,
  updateProfileAction,
  uploadAvatarAction,
} from "./settings.action";

type AnyErrors = Record<string, { _errors?: string[] }> | undefined;
const onErr = ({ error }: { error: { serverError?: string } }) => toast.error(error.serverError ?? m.errors.invalid);

const forgetThisDevice = async () => {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await fetch("/api/v1/devices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pushToken: JSON.stringify(subscription) }),
    });
    await subscription.unsubscribe();
  } catch {
    // Navigateur sans push ou réseau coupé : la déconnexion passe quand même.
  }
};

export const ProfileForm = ({
  firstName,
  lastName,
  birthDate,
  units,
}: {
  firstName: string;
  lastName: string;
  birthDate: string;
  units: string;
}) => {
  const [v, setV] = useState({ firstName, lastName, birthDate, units });
  const { execute, isPending, result } = useAction(updateProfileAction, {
    onSuccess: () => toast.ok("Profil enregistré."),
    onError: onErr,
  });
  const errors = result.validationErrors as AnyErrors;
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        execute({
          firstName: v.firstName,
          lastName: v.lastName,
          birthDate: v.birthDate || null,
          units: v.units as "kg" | "lb",
        });
      }}
    >
      <div className="grid gap-4 tablet:grid-cols-2">
        <Field label={m.onboarding.firstName} error={errors?.firstName?._errors?.[0]}>
          {(a) => (
            <Input
              {...a}
              autoComplete="given-name"
              value={v.firstName}
              onChange={(e) => setV({ ...v, firstName: e.target.value })}
            />
          )}
        </Field>
        <Field label={m.onboarding.lastName} error={errors?.lastName?._errors?.[0]}>
          {(a) => (
            <Input
              {...a}
              autoComplete="family-name"
              value={v.lastName}
              onChange={(e) => setV({ ...v, lastName: e.target.value })}
            />
          )}
        </Field>
        <Field label={m.invite.birthDate}>
          {(a) => (
            <Input {...a} type="date" value={v.birthDate} onChange={(e) => setV({ ...v, birthDate: e.target.value })} />
          )}
        </Field>
        <Field label="Unités">
          {(a) => (
            <Select {...a} value={v.units} onChange={(e) => setV({ ...v, units: e.target.value })}>
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </Select>
          )}
        </Field>
      </div>
      <Button type="submit" size="sm" variant="secondary" className="self-start" disabled={isPending}>
        {m.common.save}
      </Button>
    </form>
  );
};

export const ConsentSwitches = ({
  health,
  video,
  parentalPending,
}: {
  health: boolean;
  video: boolean;
  parentalPending: boolean;
}) => {
  const router = useRouter();
  const { execute, isPending } = useAction(setConsentAction, { onSuccess: () => router.refresh(), onError: onErr });
  return (
    <div className="flex flex-col">
      {parentalPending ? (
        <p className="mb-2 rounded-thumb bg-card-raised p-3 text-st-partial">{m.parental.pendingBanner}</p>
      ) : null}
      <CheckRow
        label={m.settings.healthConsent}
        detail={m.settings.healthConsentDetail}
        checked={health}
        disabled={isPending}
        onChange={(e) => execute({ kind: "health", granted: e.target.checked })}
      />
      <CheckRow
        label={m.settings.videoConsent}
        detail={m.settings.videoConsentDetail}
        checked={video}
        disabled={isPending}
        onChange={(e) => execute({ kind: "video", granted: e.target.checked })}
      />
    </div>
  );
};

export const DeleteAccount = ({ detail }: { detail: string }) => {
  const [word, setWord] = useState("");
  const { execute, isPending, result } = useAction(deleteAccountAction, {
    onSuccess: async () => {
      await authClient.signOut().catch(() => undefined);
      window.location.href = "/";
    },
    onError: onErr,
  });
  return (
    <Dialog
      title={m.settings.deleteAccount}
      description={detail}
      trigger={
        <Button size="sm" variant="danger">
          {m.settings.deleteAccount}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          execute({ confirmation: word });
        }}
      >
        <Field label={m.settings.deleteConfirmLabel} error={result.serverError}>
          {(a) => <Input {...a} autoComplete="off" value={word} onChange={(e) => setWord(e.target.value)} />}
        </Field>
        <Button type="submit" variant="danger" disabled={isPending || word !== m.settings.deleteConfirmWord}>
          {m.settings.deleteAccount}
        </Button>
      </form>
    </Dialog>
  );
};

export const SignOutButton = () => (
  <Button
    size="sm"
    variant="secondary"
    onClick={async () => {
      await forgetThisDevice();
      await authClient.signOut();
      window.location.href = "/";
    }}
  >
    {m.common.signOut}
  </Button>
);

export const CopyButton = ({ text, label }: { text: string; label: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      label={copied ? m.settings.copied : label}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.ok(m.settings.copied);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
    </IconButton>
  );
};

const QrPreview = ({ link, groupName }: { link: string; groupName: string }) => {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toString(link, {
      type: "svg",
      margin: 1,
      width: 320,
      color: { dark: tokens.color.ink, light: tokens.color.surface },
    }).then(setSvg);
  }, [link]);
  return svg ? (
    <div
      role="img"
      aria-label={`QR code du groupe ${groupName}`}
      className="mx-auto w-full max-w-80 overflow-hidden rounded-thumb"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  ) : null;
};

export const ReferralLink = ({ link }: { link: string }) => (
  <div className="flex items-center gap-1">
    <Input
      readOnly
      aria-label={m.settings.referralLinkLabel}
      value={link}
      className="t-num text-[17px]"
      onFocus={(e) => e.target.select()}
    />
    <CopyButton text={link} label={m.settings.copyReferral} />
  </div>
);

export const OrganizationForm = ({ name, overdueReminders }: { name: string; overdueReminders: boolean }) => {
  const [v, setV] = useState({ name, overdueReminders });
  const { execute, isPending, result } = useAction(updateOrganizationAction, {
    onSuccess: () => toast.ok("Espace enregistré."),
    onError: onErr,
  });
  const errors = result.validationErrors as AnyErrors;
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        execute(v);
      }}
    >
      <Field label={m.onboarding.orgName} error={errors?.name?._errors?.[0]}>
        {(a) => <Input {...a} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
      </Field>
      <CheckRow
        label={m.settings.overdueReminders}
        detail={m.settings.overdueRemindersDetail}
        checked={v.overdueReminders}
        onChange={(e) => setV({ ...v, overdueReminders: e.target.checked })}
      />
      <Button type="submit" size="sm" variant="secondary" className="self-start" disabled={isPending}>
        {m.common.save}
      </Button>
    </form>
  );
};

type GroupValues = {
  id: string;
  name: string;
  color: string | null;
  level: string | null;
  goal: string | null;
  athleteCount: number;
};

const GroupDialog = ({ group }: { group: GroupValues }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    name: group.name,
    color: group.color ?? tokens.color.brand,
    level: group.level ?? "",
    goal: group.goal ?? "",
  });
  const { execute, isPending, result } = useAction(saveGroupAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
    onError: onErr,
  });
  const errors = result.validationErrors as AnyErrors;
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={group.name}
      trigger={
        <IconButton label={`${m.common.edit} ${group.name}`}>
          <Pencil aria-hidden className="size-4" />
        </IconButton>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          execute({ id: group.id, name: v.name, color: v.color, level: v.level || null, goal: v.goal || null });
        }}
      >
        <Field label="Nom" error={errors?.name?._errors?.[0]}>
          {(a) => <Input {...a} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
        </Field>
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Field label="Couleur">
            {(a) => (
              <Input
                {...a}
                type="color"
                className="w-16 p-1"
                value={v.color}
                onChange={(e) => setV({ ...v, color: e.target.value })}
              />
            )}
          </Field>
          <Field label="Niveau">
            {(a) => <Input {...a} value={v.level} onChange={(e) => setV({ ...v, level: e.target.value })} />}
          </Field>
        </div>
        <Field label="Objectif">
          {(a) => <Input {...a} value={v.goal} onChange={(e) => setV({ ...v, goal: e.target.value })} />}
        </Field>
        <Button type="submit" disabled={isPending}>
          {m.common.save}
        </Button>
      </form>
    </Dialog>
  );
};

export const GroupRow = ({ group, canDelete }: { group: GroupValues; canDelete: boolean }) => {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const getLink = useAction(groupLinkAction, { onSuccess: ({ data }) => setLink(data?.link ?? null), onError: onErr });
  const remove = useAction(deleteGroupAction, { onSuccess: () => router.refresh(), onError: onErr });
  return (
    <li className="flex flex-wrap items-center gap-x-1 gap-y-2 py-2">
      <div className="min-w-48 flex-1">
        <div className="min-w-0 leading-tight">
          <p className="flex items-center gap-2 break-words font-semibold">
            {group.color ? (
              // Couleur choisie par le coach pour son groupe : une donnée, pas un jeton.
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
            ) : null}
            {group.name}
          </p>
          <p className="t-caption font-normal text-soft">
            {[`${group.athleteCount} athlète${group.athleteCount > 1 ? "s" : ""}`, group.level, group.goal]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
      </div>
      {link ? <CopyButton text={link} label={m.settings.copyLink} /> : null}
      <Button
        size="sm"
        variant="secondary"
        disabled={getLink.isPending}
        onClick={() => {
          setShowQr(false);
          getLink.execute({ groupId: group.id });
        }}
      >
        {m.settings.groupLink}
      </Button>
      <IconButton
        label={m.settings.showQr}
        onClick={() => {
          setShowQr(true);
          getLink.execute({ groupId: group.id });
        }}
      >
        <QrCode aria-hidden className="size-5" />
      </IconButton>
      <GroupDialog group={group} />
      {canDelete ? (
        <IconButton
          label={`${m.common.delete} ${group.name}`}
          onClick={() => window.confirm(`Supprimer le groupe « ${group.name} » ?`) && remove.execute({ id: group.id })}
        >
          <Trash2 aria-hidden className="size-4" />
        </IconButton>
      ) : null}
      {link && !showQr ? (
        <Input
          readOnly
          aria-label="Lien d'invitation du groupe"
          value={link}
          className="w-full"
          onFocus={(e) => e.target.select()}
        />
      ) : null}
      <Dialog
        open={showQr && link !== null}
        onOpenChange={setShowQr}
        title={group.name}
        description="Scanne ce code avec ton téléphone pour rejoindre le groupe."
      >
        {link ? <QrPreview link={link} groupName={group.name} /> : null}
      </Dialog>
    </li>
  );
};

export const NewGroupForm = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const { execute, isPending, result } = useAction(saveGroupAction, {
    onSuccess: () => {
      setName("");
      router.refresh();
    },
    onError: onErr,
  });
  const errors = result.validationErrors as AnyErrors;
  return (
    <form
      noValidate
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        execute({ name });
      }}
    >
      <Field label={m.settings.newGroup} className="flex-1" error={errors?.name?._errors?.[0]}>
        {(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
        {m.common.add}
      </Button>
    </form>
  );
};

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
        toast.ok("Invitation envoyée.");
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
      <div role="group" aria-label="Moyen d'invitation" className="flex gap-1.5">
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
          <Field label="Rôle">
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

export const AvatarForm = ({ avatarUrl, name }: { avatarUrl: string | null; name: string }) => {
  const router = useRouter();
  const { execute, isPending } = useAction(uploadAvatarAction, { onSuccess: () => router.refresh(), onError: onErr });
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card-raised font-semibold">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={`Photo de ${name}`} fill sizes="64px" className="object-cover" unoptimized />
        ) : (
          name.slice(0, 2).toUpperCase()
        )}
      </span>
      <Field label={m.settings.photo} hint={m.settings.photoHint} className="flex-1">
        {(a) => (
          <Input
            {...a}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="py-2"
            disabled={isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) execute({ file });
            }}
          />
        )}
      </Field>
    </div>
  );
};

export const WebPushToggle = ({ vapidKey }: { vapidKey: string }) => {
  const [state, setState] = useState<"idle" | "on" | "denied">("idle");
  const enable = async () => {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setState("denied");
    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey,
    });
    const res = await fetch("/api/v1/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pushToken: JSON.stringify(subscription), platform: "web" }),
    });
    if (!res.ok) return toast.error(m.common.genericError);
    setState("on");
    toast.ok("Notifications activées sur cet appareil.");
  };
  return (
    <div className="flex flex-col items-start gap-2">
      <p>{m.push.permissionBody}</p>
      {state === "denied" ? <p className="text-alert">{m.settings.pushDenied}</p> : null}
      <Button size="sm" variant="secondary" disabled={state === "on"} onClick={enable}>
        {state === "on" ? "Notifications activées" : m.push.enable}
      </Button>
    </div>
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
  const resend = useAction(resendInvitationAction, {
    onSuccess: () => toast.ok("Invitation relancée."),
    onError: onErr,
  });
  if (invitations.length === 0) return <p className="text-soft">Aucune invitation pour l'instant.</p>;
  return (
    <ul className="divide-y divide-card-line border-t border-card-line">
      {invitations.map((inv) => {
        const label = inv.email ?? inv.phone ?? (inv.kind === "group_link" ? "Lien de groupe" : "QR code");
        return (
          <li key={inv.id} className="flex flex-wrap items-center gap-x-1 gap-y-2 py-2">
            <div className="min-w-48 flex-1 leading-tight">
              <p className="break-all font-semibold">{label}</p>
              <p className="t-caption flex flex-wrap items-center gap-2 font-normal text-soft">
                <Chip>{m.invitationStatus[inv.status]}</Chip>
                {inv.kind === "group_link" || inv.kind === "qr"
                  ? `${inv.useCount} inscrits`
                  : m.roles[inv.role as keyof typeof m.roles]}
              </p>
            </div>
            {inv.link ? <CopyButton text={inv.link} label={m.settings.copyLink} /> : null}
            {inv.status !== "accepted" && inv.status !== "revoked" && inv.email ? (
              <Button size="sm" variant="quiet" onClick={() => resend.execute({ id: inv.id })}>
                {m.settings.resend}
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
