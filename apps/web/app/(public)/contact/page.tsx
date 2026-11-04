import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { ContactContent } from "@/features/legal/contact";

export const metadata: Metadata = { title: m.contact.title };

export default function ContactPage() {
  return <ContactContent />;
}
