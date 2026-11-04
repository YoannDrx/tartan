import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { ContactContent } from "@/features/legal/contact";

export const metadata: Metadata = { title: m.contact.title, robots: { index: false } };

export default function Page() {
  return <ContactContent embedded />;
}
