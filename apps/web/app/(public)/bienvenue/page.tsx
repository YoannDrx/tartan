import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { w } from "@tartan/i18n/web";
import { PublicPage } from "@/features/shell/public-page";
import { SignInScene } from "@/features/shell/start-scene";
import { getActor } from "@/lib/session";
import { AccountExit } from "@/features/onboarding/account-exit";
import { WelcomeChoices } from "@/features/onboarding/welcome-choices";
import { env } from "@/lib/env";
import { ageStatusOfUser } from "@/server/age.service";
import { getMe } from "@/server/me.service";
import { canCreateCoachSpace } from "@/server/org.service";
import { canCreatePersonalSpace } from "@/server/personal-space.service";

export const metadata: Metadata = { title: w.welcome.title };

const offerSchema = z.object({
  offre: z.enum(["coach", "club"]).optional().catch(undefined),
  rythme: z.enum(["month", "year"]).optional().catch(undefined),
});

// L'aiguillage d'un compte connecté : coach, athlète qui s'entraîne seul, ou invitation reçue. Trois chemins de même
// rang, puis le compte lui-même (déconnexion, suppression) : un compte sans espace n'est jamais dans une impasse.
export default async function BienvenuePage({
  searchParams,
}: {
  searchParams: Promise<{ offre?: string; rythme?: string }>;
}) {
  const { offre, rythme } = offerSchema.parse(await searchParams);
  // Une offre choisie sur les tarifs est un choix de coach : on va droit à la création de son espace.
  if (offre) redirect(`/bienvenue/coach?offre=${offre}&rythme=${rythme ?? "year"}`);
  const actor = await getActor();
  if (!actor) redirect(`/connexion?next=${encodeURIComponent("/bienvenue")}`);
  const me = await getMe(actor.userId);
  if (me.spaces.some((space) => space.role === "owner")) redirect("/accueil");
  if ((await ageStatusOfUser(actor.userId)) === "minor") redirect("/confirmer-age");
  const [coachOpen, athleteOpen] = await Promise.all([canCreateCoachSpace(actor.email), canCreatePersonalSpace()]);
  return (
    <PublicPage title={w.welcome.title} lead={w.welcome.lead} scene={<SignInScene />} scenePhone={false}>
      <WelcomeChoices
        coachOpen={coachOpen}
        athleteOpen={athleteOpen || me.spaces.some((space) => space.kind === "personal")}
        contact={env().EMAIL_CONTACT}
      />
      <AccountExit email={actor.email} />
    </PublicPage>
  );
}
