import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { HelpCenter } from "@/features/help/help-center";

export const metadata: Metadata = { title: m.help.title, description: m.help.description };

export default function HelpPage() {
  return <HelpCenter />;
}
