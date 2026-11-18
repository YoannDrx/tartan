"use client";

import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { CheckRow, Field, Input } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { clearOfflinePages } from "@/features/offline/service-worker";
import { authClient } from "@/lib/auth-client";
import {
  deleteAccountAction,
  leaveOrganizationAction,
  resendParentalAction,
  setConsentAction,
} from "../settings.action";
import { onErr } from "../shared";

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
  const [confirming, setConfirming] = useState<"health" | "video" | null>(null);
  const { execute, isPending } = useAction(setConsentAction, { onSuccess: () => router.refresh(), onError: onErr });
  const resend = useAction(resendParentalAction, {
    onSuccess: () => toast.ok(m.parental.resent),
    onError: onErr,
  });
  return (
    <div className="flex flex-col">
      {parentalPending ? (
        <div className="mb-2 flex flex-col items-start gap-2 rounded-thumb bg-card-raised p-3">
          <p className="text-st-partial">{m.parental.pendingBanner}</p>
          <Button size="sm" variant="secondary" disabled={resend.isPending} onClick={() => resend.execute()}>
            {m.parental.resend}
          </Button>
        </div>
      ) : null}
      <CheckRow
        label={m.settings.healthConsent}
        detail={m.settings.healthConsentDetail}
        checked={health}
        disabled={isPending}
        onChange={(e) => (e.target.checked ? execute({ kind: "health", granted: true }) : setConfirming("health"))}
      />
      <CheckRow
        label={m.settings.videoConsent}
        detail={m.settings.videoConsentDetail}
        checked={video}
        disabled={isPending}
        onChange={(e) => (e.target.checked ? execute({ kind: "video", granted: true }) : setConfirming("video"))}
      />
      {/* Retirer efface pour de bon : la décision se confirme, et le texte dit exactement ce qui part. */}
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming === "health" ? m.settings.healthRevokeTitle : m.settings.videoRevokeTitle}
        description={confirming === "health" ? m.settings.healthRevokeDetail : m.settings.videoRevokeDetail}
        confirmLabel={m.settings.revokeConsent}
        onConfirm={() => {
          if (confirming) execute({ kind: confirming, granted: false });
          setConfirming(null);
        }}
      />
    </div>
  );
};

export const DeleteAccount = ({ detail }: { detail: string }) => {
  const [word, setWord] = useState("");
  const { execute, isPending, result } = useAction(deleteAccountAction, {
    onSuccess: async () => {
      await clearOfflinePages();
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

export const LeaveSpace = ({ name }: { name: string }) => {
  const leave = useAction(leaveOrganizationAction, {
    onSuccess: () => {
      window.location.href = "/accueil";
    },
    onError: onErr,
  });
  return (
    <ConfirmDialog
      title={m.settings.leaveSpace}
      description={m.settings.leaveDetail(name)}
      confirmLabel={m.settings.leaveConfirm(name)}
      onConfirm={() => leave.execute()}
      trigger={
        <Button size="sm" variant="danger" disabled={leave.isPending}>
          {m.settings.leaveSpace}
        </Button>
      }
    />
  );
};
