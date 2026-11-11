import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { HelpCenter } from "@/features/help/help-center";

export const metadata: Metadata = { title: m.help.title, robots: { index: false } };

export default function Page() {
  return <HelpCenter embedded />;
}
