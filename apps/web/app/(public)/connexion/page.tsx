import { safeReturnPath } from "@/lib/return-path";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PLANS } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { PublicPage } from "@/features/shell/public-page";
import { SignInScene } from "@/features/shell/start-scene";
import { enabledSocialProviders } from "@/lib/auth";
import { env } from "@/lib/env";
import { platformSettings } from "@/server/platform-settings.service";
import { getActor } from "@/lib/session";
import { SignInForm } from "@/features/auth/sign-in-form";

export const metadata: Metadata = { title: m.auth.signInTitle };

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; creer?: string; lien?: string }>;
}) {
  const { next, creer, lien } = await searchParams;
  const callbackURL = safeReturnPath(next);
  if (await getActor()) redirect(callbackURL);
  const signupOpen = (await platformSettings()).signupMode === "public";
  // On arrive ici depuis « Créer mon espace » : même formulaire, mais la page dit ce qu'on est venu faire.
  const creating = signupOpen && creer !== undefined;
  const otherHref = `/connexion${creating ? "" : "?creer=1"}${next ? `${creating ? "?" : "&"}next=${encodeURIComponent(next)}` : ""}`;
  return (
    <PublicPage
      title={creating ? m.auth.createTitle : m.auth.signInTitle}
      lead={creating ? m.auth.createLead(PLANS.discovery.limits.maxAthletes ?? 0) : m.auth.signInLead}
      scene={<SignInScene />}
    >
      <div className="on-card flex flex-col gap-4 rounded-card bg-card p-5">
        {lien === "expire" ? <p role="alert">{m.auth.resetInvalid}</p> : null}
        <SignInForm callbackURL={callbackURL} providers={enabledSocialProviders} creating={creating} />
      </div>
      {signupOpen ? (
        <p className="mt-4 font-medium">
          {creating ? m.auth.signInPrompt : m.auth.createPrompt}{" "}
          <Link href={otherHref} className="inline-flex min-h-11 items-center font-semibold underline">
            {creating ? m.auth.signInTitle : m.auth.createLink}
          </Link>
        </p>
      ) : null}
    </PublicPage>
  );
}
