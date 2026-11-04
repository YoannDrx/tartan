import { safeReturnPath } from "@/lib/return-path";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PLANS } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { PublicPage } from "@/features/shell/public-page";
import { enabledSocialProviders } from "@/lib/auth";
import { env } from "@/lib/env";
import { getActor } from "@/lib/session";
import { SignInForm } from "@/features/auth/sign-in-form";

export const metadata: Metadata = { title: m.auth.signInTitle };

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; creer?: string }>;
}) {
  const { next, creer } = await searchParams;
  const callbackURL = safeReturnPath(next);
  if (await getActor()) redirect(callbackURL);
  const signupOpen = env().COACH_SIGNUP_MODE === "public";
  // On arrive ici depuis « Créer mon espace » : même formulaire, mais la page dit ce qu'on est venu faire.
  const creating = signupOpen && creer !== undefined;
  const otherHref = `/connexion${creating ? "" : "?creer=1"}${next ? `${creating ? "?" : "&"}next=${encodeURIComponent(next)}` : ""}`;
  return (
    <PublicPage
      title={creating ? m.auth.createTitle : m.auth.signInTitle}
      lead={creating ? m.auth.createLead(PLANS.discovery.limits.maxAthletes ?? 0) : m.auth.signInLead}
    >
      <div className="on-card rounded-card bg-card p-5">
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
