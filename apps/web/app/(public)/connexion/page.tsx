import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { m } from "@tartan/i18n";
import { PublicPage } from "@/features/shell/public-page";
import { enabledSocialProviders } from "@/lib/auth";
import { getActor } from "@/lib/session";
import { SignInForm } from "@/features/auth/sign-in-form";

export const metadata: Metadata = { title: m.auth.signInTitle };

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const callbackURL = next?.startsWith("/") && !next.startsWith("//") ? next : "/accueil";
  if (await getActor()) redirect(callbackURL);
  return (
    <PublicPage title={m.auth.signInTitle} lead={m.auth.signInLead}>
      <div className="on-card rounded-card bg-card p-5">
        <SignInForm callbackURL={callbackURL} providers={enabledSocialProviders} />
      </div>
    </PublicPage>
  );
}
