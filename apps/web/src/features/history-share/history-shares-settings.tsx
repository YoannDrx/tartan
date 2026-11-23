"use client";

import type { HistoryShareSummary } from "@tartan/contracts";
import { w } from "@tartan/i18n/web";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { onErr } from "@/features/settings/shared";
import { revokeHistoryShareAction } from "./history-share.action";

const t = w.personal.share;

const Revoke = ({ share }: { share: HistoryShareSummary }) => {
  const router = useRouter();
  const revoke = useAction(revokeHistoryShareAction, {
    onSuccess: () => {
      toast.ok(t.revoked);
      router.refresh();
    },
    onError: onErr,
  });
  return (
    <ConfirmDialog
      title={t.revokeTitle(share.organizationName)}
      description={t.revokeDetail}
      confirmLabel={t.revoke}
      onConfirm={() => revoke.execute({ organizationId: share.organizationId })}
      trigger={
        <Button size="sm" variant="danger" disabled={revoke.isPending}>
          {t.revoke}
        </Button>
      }
    />
  );
};

// Réglages, Confidentialité : chaque partage en cours, ce qu'il montre, et l'arrêt en un geste confirmé.
export const HistorySharesSettings = ({ shares }: { shares: HistoryShareSummary[] }) =>
  shares.length === 0 ? (
    <p className="text-soft">{t.settingsEmpty}</p>
  ) : (
    <ul className="divide-y divide-card-line">
      {shares.map((share) => (
        <li
          key={share.organizationId}
          className="flex flex-col items-start gap-2 py-3 first:pt-1 last:pb-1 tablet:flex-row tablet:items-center tablet:justify-between tablet:gap-6"
        >
          <div className="flex min-w-0 flex-col leading-snug">
            <span className="font-semibold">{share.organizationName}</span>
            <span className="t-caption font-normal text-soft">
              {share.scopes.map((scope) => t.scopes[scope]).join(", ")}
            </span>
            <span className="t-caption font-normal text-soft">
              {t.settingsSince(new Date(share.grantedAt).toLocaleDateString("fr-FR"))}
            </span>
          </div>
          <Revoke share={share} />
        </li>
      ))}
    </ul>
  );
