import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { PublicPage } from "@/features/shell/public-page";
import { OnboardingScene } from "@/features/shell/start-scene";
import { getActor } from "@/lib/session";
import { AccountExit } from "@/features/onboarding/account-exit";
import { OnboardingForm } from "@/features/onboarding/onboarding-form";
import { ageStatusOfUser } from "@/server/age.service";
import { getMe } from "@/server/me.service";
import { canCreateCoachSpace } from "@/server/org.service";

export const metadata: Metadata = { title: m.onboarding.title };

const offerSchema = z.object({
  offre: z.enum(["coach", "club"]).optional().catch(undefined),
  rythme: z.enum(["month", "year"]).optional().catch(undefined),
});

// « Je suis coach » : la création de l'espace en trois temps, puis l'invitation du premier groupe.
export default async function CoachWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ offre?: string; rythme?: string }>;
}) {
  const { offre, rythme } = offerSchema.parse(await searchParams);
  const offerQuery = offre ? `?offre=${offre}&rythme=${rythme ?? "year"}` : "";
  const actor = await getActor();
  if (!actor) redirect(`/connexion?next=${encodeURIComponent(`/bienvenue/coach${offerQuery}`)}`);
  const me = await getMe(actor.userId);
  // Un athlète peut ouvrir son espace de coach : seul un espace possédé ramène à l'abonnement ou à l'accueil.
  if (me.spaces.some((space) => space.role === "owner")) {
    redirect(offerQuery ? `/abonnement${offerQuery}` : "/accueil");
  }
  if ((await ageStatusOfUser(actor.userId)) === "minor") redirect("/confirmer-age");
  // Inscriptions des coachs fermées : l'aiguillage le dit, avec ce qu'il faut faire.
  if (!(await canCreateCoachSpace(actor.email))) redirect("/bienvenue");
  // Les comptes créés avant le correctif de `splitName` ont le début de leur adresse comme prénom.
  const firstName = me.firstName && me.firstName !== actor.email.split("@")[0] ? me.firstName : "";
  return (
    <PublicPage title={m.onboarding.title} scene={<OnboardingScene />} scenePhone={false}>
      {me.spaces.length === 0 ? (
        <Link href="/bienvenue" className="flex min-h-11 items-center self-start font-semibold">
          {w.welcome.back}
        </Link>
      ) : null}
      <div className="on-card flex flex-col gap-5 rounded-card bg-card p-5">
        <OnboardingForm
          firstName={firstName}
          lastName={me.lastName ?? ""}
          birthDate={me.birthDate ?? ""}
          offer={offre ? { offre, rythme: rythme ?? "year" } : undefined}
        />
      </div>
      {me.spaces.length === 0 ? <AccountExit email={actor.email} /> : null}
    </PublicPage>
  );
}
