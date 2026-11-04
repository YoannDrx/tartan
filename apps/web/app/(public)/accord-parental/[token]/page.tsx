import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { PublicPage } from "@/features/shell/public-page";
import { ParentalForm } from "@/features/invitations/parental-form";
import { parentalFlowEnabled } from "@/server/age.service";
import { previewParentalConsent } from "@/server/consent.service";

export const metadata: Metadata = { title: "Accord parental", robots: { index: false } };

export default async function AccordParentalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!parentalFlowEnabled()) {
    return (
      <PublicPage title={m.age.restrictedTitle}>
        <div className="on-card rounded-card bg-card p-5">
          <p role="alert">{m.age.parentalClosed}</p>
        </div>
      </PublicPage>
    );
  }
  const preview = await previewParentalConsent(token);
  return (
    <PublicPage
      title={preview ? m.parental.title(preview.athleteFirstName) : undefined}
      lead={preview ? m.parental.lead(preview.athleteFirstName, preview.coachName) : undefined}
    >
      <div className="on-card rounded-card bg-card p-5">
        {preview ? <ParentalForm token={token} /> : <p role="alert">{m.parental.invalid}</p>}
      </div>
    </PublicPage>
  );
}
