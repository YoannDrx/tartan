import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { ForgotPasswordForm } from "@/features/auth/password-forms";
import { PublicPage } from "@/features/shell/public-page";

export const metadata: Metadata = { title: m.auth.forgotPassword };

export default function MotDePasseOubliePage() {
  return (
    <PublicPage title={m.auth.forgotPassword} lead={m.auth.forgotLead}>
      <div className="on-card rounded-card bg-card p-5">
        <ForgotPasswordForm />
      </div>
    </PublicPage>
  );
}
