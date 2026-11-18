"use client";

import { INVITE_EMAILS_MAX, inviteEmailsInput } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { QrCode } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { groupLinkAction } from "@/features/invitations/invitation.action";
import { QrPreview } from "@/features/settings/groupes/groups";
import { LinkField, onErr } from "@/features/settings/shared";
import { inviteEmailsAction } from "./onboarding-state.action";

const t = w.onboarding.invite;

const splitEmails = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

// Inviter sur place : le lien du groupe à copier, son QR code, quelques adresses e-mail. Sans passer par les
// réglages. Sert au dernier temps de la création de l'espace, à la carte et à la page des premiers pas.
export const InvitePanel = ({
  groupId,
  groupName,
  qrOpen = false,
  onSent,
}: {
  groupId: string;
  groupName: string;
  qrOpen?: boolean;
  onSent?: (count: number) => void;
}) => {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(qrOpen);
  const [emails, setEmails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const getLink = useAction(groupLinkAction, { onSuccess: ({ data }) => setLink(data?.link ?? null), onError: onErr });
  const send = useAction(inviteEmailsAction, {
    onSuccess: ({ data }) => {
      const count = data?.sent ?? 0;
      setEmails("");
      toast.ok(t.sent(count));
      onSent?.(count);
      router.refresh();
    },
    onError: ({ error: failure }) => setError(failure.serverError ?? m.common.genericError),
  });
  const { execute: loadLink } = getLink;

  useEffect(() => {
    // Le lien du groupe existe dès qu'on le demande : on le prépare à l'ouverture, sans attendre un clic.
    loadLink({ groupId });
  }, [groupId, loadLink]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {link ? (
          <LinkField link={link} label={t.linkLabel} copyLabel={m.settings.copyLink} />
        ) : (
          <p role="status" className="t-caption text-soft">
            {t.linkLoading}
          </p>
        )}
        <div>
          <Button
            size="sm"
            variant="secondary"
            aria-expanded={showQr}
            disabled={!link}
            onClick={() => setShowQr(!showQr)}
          >
            <QrCode aria-hidden className="size-4" />
            {showQr ? t.hideQr : t.showQr}
          </Button>
        </div>
        {showQr && link ? (
          <figure className="flex flex-col items-start gap-2">
            <div className="w-full max-w-60">
              <QrPreview link={link} groupName={groupName} />
            </div>
            <figcaption className="t-caption font-normal text-soft">{t.qrHint}</figcaption>
          </figure>
        ) : null}
      </div>
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const list = splitEmails(emails);
          if (list.length === 0) return setError(t.empty);
          if (list.length > INVITE_EMAILS_MAX) return setError(t.tooMany(INVITE_EMAILS_MAX));
          const parsed = inviteEmailsInput.safeParse({ groupId, emails: list });
          if (!parsed.success) {
            const wrong = list.filter((email) => !inviteEmailsInput.shape.emails.element.safeParse(email).success);
            return setError(t.invalid(wrong.join(", ")));
          }
          setError(null);
          send.execute(parsed.data);
        }}
      >
        <Field label={t.emailsLabel} hint={t.emailsHint} error={error ?? undefined}>
          {(a11y) => (
            <Textarea
              {...a11y}
              rows={2}
              autoComplete="off"
              inputMode="email"
              value={emails}
              onChange={(event) => setEmails(event.target.value)}
            />
          )}
        </Field>
        <div>
          <Button type="submit" size="sm" disabled={send.isPending}>
            {t.send}
          </Button>
        </div>
      </form>
    </div>
  );
};
