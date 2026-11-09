"use client";

import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { setAiConsentAction } from "./consent.action";

const onError = ({ error }: { error: { serverError?: string } }) =>
  toast.error(error.serverError ?? m.common.genericError);

export const PlannerConsent = () => {
  const t = m.aiPlanner;
  const router = useRouter();
  const accept = useAction(setAiConsentAction, { onSuccess: () => router.refresh(), onError });
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title={t.title} />
      <section className="on-card flex flex-col gap-3 rounded-card bg-card p-4">
        <h2 className="t-section">{t.consentTitle}</h2>
        <p>{t.consentBody}</p>
        <p className="text-soft">{t.consentHealth}</p>
        <Link href="/confidentialite">{m.legal.privacy}</Link>
        <div>
          <Button disabled={accept.isPending} onClick={() => accept.execute({ granted: true })}>
            {t.consentAccept}
          </Button>
        </div>
      </section>
    </div>
  );
};

export const PlannerConsentWithdraw = () => {
  const router = useRouter();
  const withdraw = useAction(setAiConsentAction, { onSuccess: () => router.refresh(), onError });
  return (
    <div>
      <Button
        size="sm"
        variant="secondary"
        disabled={withdraw.isPending}
        onClick={() => withdraw.execute({ granted: false })}
      >
        {m.aiPlanner.consentWithdraw}
      </Button>
    </div>
  );
};
