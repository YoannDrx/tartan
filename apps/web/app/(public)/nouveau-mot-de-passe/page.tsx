import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { NewPasswordForm } from "@/features/auth/password-forms";
import { PublicPage } from "@/features/shell/public-page";

export const metadata: Metadata = { title: m.auth.newPassword, robots: { index: false } };

export default async function NouveauMotDePassePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <PublicPage title={m.auth.newPassword}>
      <div className="on-card rounded-card bg-card p-5">
        <NewPasswordForm token={token ?? null} />
      </div>
    </PublicPage>
  );
}
