"use client";

import { m } from "@tartan/i18n";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

// Ce que plusieurs rubriques des réglages partagent : le retour d'erreur d'une action et la copie d'un lien.
export type AnyErrors = Record<string, { _errors?: string[] }> | undefined;

export const onErr = ({ error }: { error: { serverError?: string } }) =>
  toast.error(error.serverError ?? m.errors.invalid);

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

// Un lien à recopier : le champ et son bouton de copie disent de quel lien il s'agit.
export const LinkField = ({ link, label, copyLabel }: { link: string; label: string; copyLabel: string }) => (
  <div className="flex items-center gap-1">
    <Input readOnly aria-label={label} value={link} className="t-num text-[17px]" onFocus={(e) => e.target.select()} />
    <CopyButton text={link} label={copyLabel} />
  </div>
);

export const ReferralLink = ({ link }: { link: string }) => (
  <LinkField link={link} label={m.settings.referralLinkLabel} copyLabel={m.settings.copyReferral} />
);
