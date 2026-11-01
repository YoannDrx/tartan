import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { m } from "@tartan/i18n";
import { Logo } from "@/components/logo";
import { enabledSocialProviders } from "@/lib/auth";
import { getActor } from "@/lib/session";
import { SignInForm } from "@/features/auth/sign-in-form";

export const metadata: Metadata = { title: m.auth.signInTitle };

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const callbackURL = next?.startsWith("/") && !next.startsWith("//") ? next : "/accueil";
  if (await getActor()) redirect(callbackURL);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Link href="/" aria-label="Tartan, retour au site" className="self-start">
        <Logo height={40} />
      </Link>
      <div>
        <h1 className="t-display">{m.auth.signInTitle}</h1>
        <p className="mt-1 text-muted">{m.auth.signInLead}</p>
      </div>
      <SignInForm callbackURL={callbackURL} providers={enabledSocialProviders} />
    </main>
  );
}
