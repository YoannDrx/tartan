import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { Logo } from "@/components/logo";
import { ParentalForm } from "@/features/invitations/parental-form";
import { previewParentalConsent } from "@/server/consent.service";

export const metadata: Metadata = { title: "Accord parental", robots: { index: false } };

export default async function AccordParentalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await previewParentalConsent(token);
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-4 py-10">
      <Logo height={40} />
      {preview ? (
        <>
          <h1 className="t-display">{m.parental.title(preview.athleteFirstName)}</h1>
          <p>{m.parental.lead(preview.athleteFirstName, preview.coachName)}</p>
          <ParentalForm token={token} />
        </>
      ) : (
        <p role="alert" className="rounded-card border border-border bg-surface p-4">
          {m.parental.invalid}
        </p>
      )}
    </main>
  );
}
