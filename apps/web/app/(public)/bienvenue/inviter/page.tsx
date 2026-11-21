import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { InviteStep } from "@/features/onboarding/onboarding-form";
import { PublicPage } from "@/features/shell/public-page";
import { SPACE_COOKIE } from "@/features/shell/space";
import { OnboardingScene } from "@/features/shell/start-scene";
import { getActor } from "@/lib/session";
import { getMe } from "@/server/me.service";
import { getGuideContext } from "@/server/onboarding.service";

export const metadata: Metadata = { title: w.onboarding.invite.title };

const offerSchema = z.object({
  offre: z.enum(["coach", "club"]).optional().catch(undefined),
  rythme: z.enum(["month", "year"]).optional().catch(undefined),
});

// Le dernier temps de la création de l'espace, facultatif : inviter le premier groupe sur place (lien, QR code,
// adresses). L'espace existe déjà : recharger cette page n'y perd rien, la quitter non plus.
export default async function InviterPage({
  searchParams,
}: {
  searchParams: Promise<{ offre?: string; rythme?: string }>;
}) {
  const { offre, rythme } = offerSchema.parse(await searchParams);
  const actor = await getActor();
  if (!actor) redirect("/connexion?next=%2Fbienvenue");
  const me = await getMe(actor.userId);
  const owned = me.spaces.filter((space) => space.role === "owner");
  const wanted = (await cookies()).get(SPACE_COOKIE)?.value;
  const space = owned.find((entry) => entry.organizationId === wanted) ?? owned[0];
  if (!space) redirect("/bienvenue");
  const { group } = await getGuideContext(actor.userId, space.organizationId);
  const nextPath = offre ? `/abonnement?offre=${offre}&rythme=${rythme ?? "year"}` : "/suivi";
  if (!group) redirect(nextPath);
  return (
    <PublicPage title={m.onboarding.title} scene={<OnboardingScene />} scenePhone={false}>
      <div className="on-card flex flex-col gap-5 rounded-card bg-card p-5">
        <InviteStep group={group} nextPath={nextPath} />
      </div>
    </PublicPage>
  );
}
