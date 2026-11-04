import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { ConfirmAgeForm } from "@/features/age/confirm-age-form";
import { DeleteAccount, SignOutButton } from "@/features/settings/settings-forms";
import { PublicPage } from "@/features/shell/public-page";
import { env } from "@/lib/env";
import { getActor } from "@/lib/session";
import { ageStatusOfUser } from "@/server/age.service";

export const metadata: Metadata = { title: m.age.title, robots: { index: false } };

export default async function ConfirmAgePage() {
  const actor = await getActor();
  if (!actor) redirect("/connexion?next=/confirmer-age");
  const status = await ageStatusOfUser(actor.userId);
  if (status === "adult") redirect("/accueil");
  if (status === "unknown") {
    return (
      <PublicPage title={m.age.title} lead={m.age.lead}>
        <div className="on-card rounded-card bg-card p-5">
          <ConfirmAgeForm />
        </div>
      </PublicPage>
    );
  }
  // Compte mineur : accès fermé, mais ses données restent à lui.
  return (
    <PublicPage title={m.age.restrictedTitle} lead={m.age.restricted}>
      <div className="on-card flex flex-col gap-4 rounded-card bg-card p-5">
        <p>{m.age.restrictedNext}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <a href="/api/v1/me/export" download>
              {m.settings.exportData}
            </a>
          </Button>
          <DeleteAccount detail={m.settings.deleteDetail} />
          <SignOutButton />
        </div>
        <a href={`mailto:${env().EMAIL_CONTACT}`} className="font-semibold">
          {env().EMAIL_CONTACT}
        </a>
      </div>
    </PublicPage>
  );
}
