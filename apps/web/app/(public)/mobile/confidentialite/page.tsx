import type { Metadata } from "next";
import { PrivacyContent } from "@/features/legal/privacy";

export const metadata: Metadata = { title: "Politique de confidentialité", robots: { index: false } };

export default function Page() {
  return <PrivacyContent embedded />;
}
