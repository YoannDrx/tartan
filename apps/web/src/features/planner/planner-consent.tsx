"use client";

import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { setAiConsentAction } from "./consent.action";

const t = w.planner.consent;
const onError = ({ error }: { error: { serverError?: string } }) =>
  toast.error(error.serverError ?? m.common.genericError);

// L'accord est donné une fois, pour ce que le coach écrit comme pour ce qu'il dicte : la dictée est transcrite par
// le même prestataire, et le serveur n'accepte aucun envoi, texte ou audio, sans cet accord.
export const PlannerConsent = () => {
  const router = useRouter();
  const accept = useAction(setAiConsentAction, { onSuccess: () => router.refresh(), onError });
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title={w.planner.title} />
      <section className="on-card flex flex-col gap-3 rounded-card bg-card p-4 desktop:p-6">
        <h2 className="t-section">{t.title}</h2>
        <p className="max-w-prose">{t.body}</p>
        <p className="max-w-prose">{t.dictation}</p>
        <p className="max-w-prose text-soft">{t.health}</p>
        <Link
          href="/confidentialite"
          className="inline-flex min-h-11 items-center self-start underline underline-offset-4"
        >
          {m.legal.privacy}
        </Link>
        <div>
          <Button disabled={accept.isPending} onClick={() => accept.execute({ granted: true })}>
            {t.accept}
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={withdraw.isPending}
        onClick={() => withdraw.execute({ granted: false })}
      >
        {t.withdraw}
      </Button>
      <p className="t-caption min-w-0 font-normal">{t.withdrawHint}</p>
    </div>
  );
};
