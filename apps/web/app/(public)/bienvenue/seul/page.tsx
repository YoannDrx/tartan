import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { w } from "@tartan/i18n/web";
import { PublicPage } from "@/features/shell/public-page";
import { OnboardingScene } from "@/features/shell/start-scene";
import { AccountExit } from "@/features/onboarding/account-exit";
import { PersonalSignupForm } from "@/features/onboarding/personal-signup-form";
import { getActor } from "@/lib/session";
import { ageStatusOfUser } from "@/server/age.service";
import { getMe } from "@/server/me.service";
import { canCreatePersonalSpace } from "@/server/personal-space.service";

export const metadata: Metadata = { title: w.welcome.soloForm.title };

// « Je m'entraîne seul » : l'espace personnel, gratuit, sans coach. Un compte qui l'a déjà y retourne.
export default async function SoloWelcomePage({ searchParams }: { searchParams: Promise<{ ensuite?: string }> }) {
  const planner = (await searchParams).ensuite === "planificateur";
  const actor = await getActor();
  if (!actor)
    redirect(
      `/connexion?next=${encodeURIComponent(planner ? "/bienvenue/seul?ensuite=planificateur" : "/bienvenue/seul")}`,
    );
  const me = await getMe(actor.userId);
  const personal = me.spaces.find((space) => space.kind === "personal");
  if (personal) redirect(`${planner ? "/planificateur" : "/aujourdhui"}?espace=${personal.organizationId}`);
  if ((await ageStatusOfUser(actor.userId)) === "minor") redirect("/confirmer-age");
  if (!(await canCreatePersonalSpace())) redirect("/bienvenue");
  // Les comptes créés avant le correctif de `splitName` ont le début de leur adresse comme prénom.
  const firstName = me.firstName && me.firstName !== actor.email.split("@")[0] ? me.firstName : "";
  return (
    <PublicPage
      title={w.welcome.soloForm.title}
      lead={w.welcome.soloForm.lead}
      scene={<OnboardingScene />}
      scenePhone={false}
    >
      {me.spaces.length === 0 ? (
        <Link href="/bienvenue" className="flex min-h-11 items-center self-start font-semibold">
          {w.welcome.back}
        </Link>
      ) : null}
      <div className="on-card flex flex-col gap-5 rounded-card bg-card p-5">
        <PersonalSignupForm
          planner={planner}
          firstName={firstName}
          lastName={me.lastName ?? ""}
          birthDate={me.birthDate ?? ""}
        />
      </div>
      {me.spaces.length === 0 ? <AccountExit email={actor.email} /> : null}
    </PublicPage>
  );
}
