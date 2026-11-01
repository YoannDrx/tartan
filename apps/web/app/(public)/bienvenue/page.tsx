import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { m } from "@tartan/i18n";
import { Logo } from "@/components/logo";
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
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-4 py-10">
        <Logo height={40} />
        <h1 className="t-display">{m.onboarding.closedTitle}</h1>
        <p>{m.onboarding.closed}</p>
        <a href={`mailto:${env().EMAIL_CONTACT}`} className="font-semibold">
          {env().EMAIL_CONTACT}
        </a>
        <p className="text-muted">{m.onboarding.joinHint}</p>
      </main>
    );
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-4 py-10">
      <Logo height={40} />
      <h1 className="t-display">Crée ton espace coach</h1>
      <OnboardingForm firstName={me.firstName ?? ""} lastName={me.lastName ?? ""} />
      <p className="text-muted">{m.onboarding.joinHint}</p>
    </main>
  );
}
