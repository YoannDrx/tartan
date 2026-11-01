import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { m } from "@tartan/i18n";
import { PublicPage } from "@/features/shell/public-page";
import { getActor } from "@/lib/session";
import { OnboardingForm } from "@/features/onboarding/onboarding-form";
import { env } from "@/lib/env";
import { getMe } from "@/server/me.service";
import { canCreateCoachSpace } from "@/server/org.service";

export const metadata: Metadata = { title: "Bienvenue" };

export default async function BienvenuePage() {
  const actor = await getActor();
  if (!actor) redirect("/connexion?next=/bienvenue");
  const me = await getMe(actor.userId);
  if (me.spaces.length > 0) redirect("/accueil");
  if (!canCreateCoachSpace(actor.email)) {
    return (
      <PublicPage title={m.onboarding.closedTitle}>
        <div className="on-card flex flex-col gap-3 rounded-card bg-card p-5">
          <p>{m.onboarding.closed}</p>
          <a href={`mailto:${env().EMAIL_CONTACT}`} className="font-semibold">
            {env().EMAIL_CONTACT}
          </a>
          <p className="text-soft">{m.onboarding.joinHint}</p>
        </div>
      </PublicPage>
    );
  }
  return (
    <PublicPage title="Crée ton espace coach">
      <div className="on-card flex flex-col gap-5 rounded-card bg-card p-5">
        <OnboardingForm firstName={me.firstName ?? ""} lastName={me.lastName ?? ""} />
        <p className="text-soft">{m.onboarding.joinHint}</p>
      </div>
    </PublicPage>
  );
}
