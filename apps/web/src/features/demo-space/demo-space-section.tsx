"use client";

import { w } from "@tartan/i18n/web";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { TrackTile } from "@/components/states";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { onErr } from "@/features/settings/shared";
import { switchSpaceAction } from "@/features/shell/shell.action";
import { RUBRIC_ATHLETE } from "@/lib/rubric-athlete";
import { deleteDemoSpaceAction, openDemoSpaceAction } from "./demo-space.action";

const t = w.demoSpace.intro;

// Sur la page des premiers pas : ce qu'est la démonstration, puis l'ouvrir. Une fois ouverte, y revenir, la
// remettre à zéro ou la supprimer, sans quitter son espace.
export const DemoSpaceSection = ({ demo }: { demo: { organizationId: string; expiresAt: string } | null }) => {
  const router = useRouter();
  const enter = () => {
    router.push("/suivi");
    router.refresh();
  };
  const open = useAction(openDemoSpaceAction, { onSuccess: enter, onError: () => toast.error(t.failed) });
  const resume = useAction(switchSpaceAction, { onSuccess: enter, onError: onErr });
  const remove = useAction(deleteDemoSpaceAction, {
    onSuccess: () => {
      toast.ok(w.demoSpace.banner.removed);
      router.refresh();
    },
    onError: () => toast.error(w.demoSpace.banner.failed),
  });
  const busy = open.isPending || resume.isPending || remove.isPending;

  return (
    <section id="demonstration" aria-labelledby="demonstration-titre" className="flex scroll-mt-24 flex-col gap-3">
      <h2 id="demonstration-titre" className="t-section">
        {t.title}
      </h2>
      <div className="on-card flex items-start gap-4 rounded-card bg-card p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="max-w-prose">{t.lead}</p>
          <p className="t-caption max-w-prose font-normal text-soft">
            {t.apart} {demo ? t.expires(demo.expiresAt) : t.lifetime}
          </p>
          <div className="flex flex-wrap gap-2">
            {demo ? (
              <>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => resume.execute({ organizationId: demo.organizationId })}
                >
                  {t.resume}
                </Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => open.execute()}>
                  {open.isPending ? t.resetting : t.reset}
                </Button>
                <ConfirmDialog
                  title={w.demoSpace.banner.confirmTitle}
                  description={w.demoSpace.banner.confirmBody}
                  confirmLabel={w.demoSpace.banner.confirm}
                  cancelLabel={w.demoSpace.banner.cancel}
                  onConfirm={() => remove.execute()}
                  trigger={
                    <Button size="sm" variant="danger" disabled={busy}>
                      {remove.isPending ? t.removing : t.remove}
                    </Button>
                  }
                />
              </>
            ) : (
              <Button size="sm" disabled={busy} onClick={() => open.execute()}>
                {open.isPending ? t.opening : t.open}
              </Button>
            )}
          </div>
        </div>
        <TrackTile athlete={RUBRIC_ATHLETE.suivi} pose="run" className="hidden size-16 shrink-0 tablet:block" />
      </div>
    </section>
  );
};
