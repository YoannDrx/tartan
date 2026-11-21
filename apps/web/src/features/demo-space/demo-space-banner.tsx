"use client";

import { w } from "@tartan/i18n/web";
import { FlaskConical } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { onErr } from "@/features/settings/shared";
import { DEMO_SPACE_MARKER } from "@/lib/analytics";
import { FIRST_STEPS_PATH } from "@/lib/onboarding-paths";
import { deleteDemoSpaceAction, leaveDemoSpaceAction } from "./demo-space.action";

const t = w.demoSpace.banner;

// Sur chaque écran de l'espace de démonstration, en tête du contenu : on sait toujours où l'on est, comment revenir
// à son espace, et comment effacer la démonstration. Le contour en pointillés dit « ce n'est pas pour de vrai ».
// L'attribut coupe la mesure d'audience tant que le bandeau est affiché (`src/lib/analytics.ts`).
export const DemoSpaceBanner = ({ expiresAt }: { expiresAt: string | null }) => {
  const router = useRouter();
  const leave = useAction(leaveDemoSpaceAction, {
    onSuccess: () => {
      router.push("/suivi");
      router.refresh();
    },
    onError: onErr,
  });
  const remove = useAction(deleteDemoSpaceAction, {
    onSuccess: () => {
      toast.ok(t.removed);
      router.push(FIRST_STEPS_PATH);
      router.refresh();
    },
    onError: () => toast.error(t.failed),
  });
  const busy = leave.isPending || remove.isPending;
  // La marge du bas laisse au bandeau piste de l'écran la place qu'il prend au-dessus de lui (`--band-bleed`).
  return (
    <section
      {...{ [DEMO_SPACE_MARKER]: "" }}
      aria-label={t.label}
      className="on-card mb-2 flex flex-col gap-3 rounded-card border-2 border-dashed border-control-line bg-card p-4 tablet:flex-row tablet:items-center tablet:gap-4 desktop:mb-5"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <FlaskConical aria-hidden className="mt-0.5 size-6 shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          {/* Pas un titre : le titre de l'écran reste le premier de la page, le bandeau n'en est que le cadre. */}
          <p className="font-semibold">
            {t.title}
            {expiresAt ? <span className="t-caption font-normal text-soft"> {t.expires(expiresAt)}</span> : null}
          </p>
          <p className="max-w-prose text-[15px]">{t.body}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 max-tablet:pl-9">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => leave.execute()}>
          {leave.isPending ? t.backing : t.back}
        </Button>
        <ConfirmDialog
          title={t.confirmTitle}
          description={t.confirmBody}
          confirmLabel={t.confirm}
          cancelLabel={t.cancel}
          onConfirm={() => remove.execute()}
          trigger={
            <Button size="sm" variant="danger" disabled={busy} aria-label={t.removeLabel}>
              {t.remove}
            </Button>
          }
        />
      </div>
    </section>
  );
};
