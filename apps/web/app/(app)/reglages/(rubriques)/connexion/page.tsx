import { Check, Minus } from "lucide-react";
import type { Metadata } from "next";
import { w } from "@tartan/i18n/web";
import { Rows, Sheet, SheetSection } from "@/components/sheet";
import { ChangePasswordForm, ConfirmPasswordSetup, DefinePasswordForm } from "@/features/settings/connexion/password";
import { RevokeOtherSessionsButton, SignOutButton } from "@/features/settings/connexion/sessions";
import { requireRubric } from "@/features/settings/rubric-access";
import { getSignInMethods } from "@/server/credentials.service";

export const metadata: Metadata = { title: w.settings.rubrics.connexion.title };

// Un moyen de connexion et son état, dit en toutes lettres : la coche ne porte pas le sens à elle seule.
const Method = ({ name, state, on }: { name: string; state: string; on: boolean }) => (
  <li className="flex min-h-11 items-center justify-between gap-3 py-2">
    <span className="font-semibold">{name}</span>
    <span className="flex items-center gap-1.5 text-right">
      {on ? <Check aria-hidden className="size-4 shrink-0" /> : <Minus aria-hidden className="size-4 shrink-0" />}
      {state}
    </span>
  </li>
);

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ definir?: string; lien?: string }>;
}) {
  const { actor } = await requireRubric("connexion");
  const [{ definir, lien }, methods] = await Promise.all([searchParams, getSignInMethods(actor)]);
  const t = w.settings.connexion;
  const social = [
    { name: t.google, ...methods.google },
    { name: t.apple, ...methods.apple },
  ].filter((provider) => provider.available || provider.linked);
  return (
    <Sheet className="divide-y divide-card-line">
      <SheetSection id="moyens" title={t.methods}>
        <Rows>
          <Method name={t.link} state={t.linkState} on />
          <Method name={t.password} state={methods.password ? t.passwordOn : t.passwordOff} on={methods.password} />
          {social.map((provider) => (
            <Method
              key={provider.name}
              name={provider.name}
              state={provider.linked ? t.linked : t.notLinked}
              on={provider.linked}
            />
          ))}
        </Rows>
      </SheetSection>
      <SheetSection id="mot-de-passe" title={methods.password ? t.change.title : t.define.title}>
        {lien === "expire" ? (
          <p role="alert" className="mb-3 text-alert">
            {w.auth.linkExpired}
          </p>
        ) : null}
        {methods.password ? (
          <ChangePasswordForm email={methods.email} />
        ) : methods.canSetPasswordNow ? (
          <DefinePasswordForm email={methods.email} confirmed={definir !== undefined} />
        ) : (
          <ConfirmPasswordSetup email={methods.email} />
        )}
      </SheetSection>
      <SheetSection id="appareils" title={t.devices}>
        <div className="flex flex-col items-start gap-3">
          <p className="max-w-prose">{t.devicesDetail}</p>
          <RevokeOtherSessionsButton />
        </div>
      </SheetSection>
      <SheetSection id="deconnexion" title={t.here}>
        <div className="flex flex-col items-start gap-3">
          <p className="break-words">{t.hereDetail(actor.email)}</p>
          <SignOutButton />
        </div>
      </SheetSection>
    </Sheet>
  );
}
