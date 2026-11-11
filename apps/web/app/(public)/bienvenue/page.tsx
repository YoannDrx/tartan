import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { m } from "@tartan/i18n";
import { PublicPage } from "@/features/shell/public-page";
import { getActor } from "@/lib/session";
import { OnboardingForm } from "@/features/onboarding/onboarding-form";
import { env } from "@/lib/env";
import { ageStatusOfUser } from "@/server/age.service";
import { getMe } from "@/server/me.service";
import { canCreateCoachSpace } from "@/server/org.service";

export const metadata: Metadata = { title: "Bienvenue" };

const offerSchema = z.object({
  offre: z.enum(["coach", "club"]).optional().catch(undefined),
  rythme: z.enum(["month", "year"]).optional().catch(undefined),
});

export default async function BienvenuePage({
  searchParams,
}: {
  searchParams: Promise<{ offre?: string; rythme?: string }>;
}) {
  const { offre, rythme } = offerSchema.parse(await searchParams);
  const offerQuery = offre ? `?offre=${offre}&rythme=${rythme ?? "year"}` : "";
  const actor = await getActor();
  if (!actor) redirect(`/connexion?next=${encodeURIComponent(`/bienvenue${offerQuery}`)}`);
  const me = await getMe(actor.userId);
  // Un athlète peut ouvrir son espace de coach : seul un espace possédé ramène à l'abonnement ou à l'accueil.
  if (me.spaces.some((space) => space.role === "owner")) {
    redirect(offerQuery ? `/abonnement${offerQuery}` : "/accueil");
  }
  if ((await ageStatusOfUser(actor.userId)) === "minor") redirect("/confirmer-age");
  if (!(await canCreateCoachSpace(actor.email))) {
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
  // Les comptes créés avant le correctif de `splitName` ont le début de leur adresse comme prénom.
  const firstName = me.firstName && me.firstName !== actor.email.split("@")[0] ? me.firstName : "";
  return (
    <PublicPage title={m.onboarding.title}>
      <div className="on-card flex flex-col gap-5 rounded-card bg-card p-5">
        <OnboardingForm
          firstName={firstName}
          lastName={me.lastName ?? ""}
          birthDate={me.birthDate ?? ""}
          nextPath={offerQuery ? `/abonnement${offerQuery}` : "/suivi"}
        />
        <p className="text-soft">{m.onboarding.joinHint}</p>
      </div>
    </PublicPage>
  );
}
