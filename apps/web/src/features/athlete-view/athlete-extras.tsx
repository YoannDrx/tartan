"use client";

import { m } from "@tartan/i18n";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordPrompt } from "@/features/auth/password-prompt";
import { updateOnboardingAction } from "@/features/onboarding/onboarding-state.action";
import { InstallOfferRow } from "@/features/shell/install-banner";

const t = m.athleteExtras;

// Après la première validation : ce qui rend l'app plus pratique, regroupé en une carte facultative, sous les
// séances. Photo ou avatar, mot de passe (la proposition de `password-prompt.tsx`), installation et notifications.
// Refermée d'un geste, elle ne revient sur aucun appareil ; chaque réglage reste dans les réglages.
export const AthleteExtras = ({
  photo,
  password,
}: {
  photo: boolean;
  password: { email: string; canSetNow: boolean } | null;
}) => {
  const [closed, setClosed] = useState(false);
  const [install, setInstall] = useState(false);
  const onInstall = useCallback((available: boolean) => setInstall(available), []);
  if (closed) return null;
  const empty = !photo && !password && !install;
  return (
    <section
      aria-labelledby="pour-aller-plus-loin"
      hidden={empty}
      className="on-card flex flex-col gap-3 rounded-card bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="pour-aller-plus-loin" className="t-h2">
          {t.title}
        </h2>
        <p className="t-caption font-normal text-soft">{t.lead}</p>
      </div>
      <div className="flex flex-col divide-y divide-card-line [&>*]:py-3 [&>*:first-child]:pt-0">
        {photo ? (
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold">{t.photoTitle}</h3>
            <p className="t-caption font-normal text-soft">{t.photoBody}</p>
            <div>
              <Button asChild size="sm" variant="secondary">
                <Link href="/reglages/profil">{t.photoAction}</Link>
              </Button>
            </div>
          </div>
        ) : null}
        {password ? <PasswordPrompt email={password.email} canSetNow={password.canSetNow} embedded /> : null}
        <div hidden={!install}>
          <InstallOfferRow onAvailable={onInstall} />
        </div>
      </div>
      <div>
        <Button
          size="sm"
          variant="quiet"
          onClick={() => {
            setClosed(true);
            void updateOnboardingAction({ dismissed: true });
          }}
        >
          {t.close}
        </Button>
      </div>
    </section>
  );
};
