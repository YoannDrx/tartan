import type { Metadata } from "next";
import { LegalPage } from "@/features/shell/legal-page";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <LegalPage title="Contact" updated="1er novembre 2026">
      <p>Une question, une demande sur tes données, un contenu à signaler : [À DÉFINIR : adresse de contact].</p>
    </LegalPage>
  );
}
