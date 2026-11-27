import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { w } from "@tartan/i18n/web";
import { PublicPage } from "@/features/shell/public-page";
import { OnboardingScene } from "@/features/shell/start-scene";
import { AccountExit } from "@/features/onboarding/account-exit";
import { PersonalSignupForm } from "@/features/onboarding/personal-signup-form";
import { NOTEBOOK_FOR_PLANNER } from "@/lib/onboarding-paths";
import { getActor } from "@/lib/session";
import { ageStatusOfUser } from "@/server/age.service";
import { getMe } from "@/server/me.service";
import { canCreatePersonalSpace, canOpenNotebook } from "@/server/personal-space.service";

// Depuis le planificateur, c'est l'athlète d'un club qui ouvre son carnet.
export const generateMetadata = async ({
  searchParams,
}: {
  searchParams: Promise<{ ensuite?: string }>;
}): Promise<Metadata> => ({
  title: (await searchParams).ensuite === "planificateur" ? w.welcome.notebookForm.title : w.welcome.soloForm.title,
});

// « Je m'entraîne seul » : l'espace personnel, gratuit, sans coach. Un compte qui l'a déjà y retourne.
export default async function SoloWelcomePage({ searchParams }: { searchParams: Promise<{ ensuite?: string }> }) {
  const planner = (await searchParams).ensuite === "planificateur";
  const actor = await getActor();
  if (!actor) redirect(`/connexion?next=${encodeURIComponent(planner ? NOTEBOOK_FOR_PLANNER : "/bienvenue/seul")}`);
  const me = await getMe(actor.userId);
  const personal = me.spaces.find((space) => space.kind === "personal");
  if (personal && planner && me.spaces.some((s) => s.role === "athlete" && s.kind !== "personal"))
    redirect("/planificateur");
  if (personal) redirect(`${planner ? "/planificateur" : "/aujourdhui"}?espace=${personal.organizationId}`);
  if ((await ageStatusOfUser(actor.userId)) === "minor") redirect("/confirmer-age");
  // Depuis un club, le carnet s'ouvre même inscriptions d'athlètes fermées ; sinon l'aiguillage le dit.
  if (!(await (planner ? canOpenNotebook(actor.userId) : canCreatePersonalSpace()))) redirect("/bienvenue");
  // Les comptes créés avant le correctif de `splitName` ont le début de leur adresse comme prénom.
  const firstName = me.firstName && me.firstName !== actor.email.split("@")[0] ? me.firstName : "";
  // L'athlète d'un club ouvre un carnet à côté : son nom et sa date de naissance sont déjà connus.
  const club = me.spaces.some((s) => s.role === "athlete" && s.kind !== "personal");
  const copy = club ? w.welcome.notebookForm : w.welcome.soloForm;
  return (
    <PublicPage title={copy.title} lead={copy.lead} scene={<OnboardingScene />} scenePhone={false}>
      {me.spaces.length === 0 || club ? (
        <Link
          href={club ? "/aujourdhui" : "/bienvenue"}
          className="flex min-h-11 items-center self-start font-semibold"
        >
          {club ? w.welcome.notebookForm.back : w.welcome.back}
        </Link>
      ) : null}
      <div className="on-card flex flex-col gap-5 rounded-card bg-card p-5">
        <PersonalSignupForm
          planner={planner}
          light={club && Boolean(firstName && me.lastName && me.birthDate)}
          firstName={firstName}
          lastName={me.lastName ?? ""}
          birthDate={me.birthDate ?? ""}
        />
      </div>
      {me.spaces.length === 0 ? <AccountExit email={actor.email} /> : null}
    </PublicPage>
  );
}
