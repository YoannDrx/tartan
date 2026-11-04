import type { Metadata } from "next";
import { PrivacyContent } from "@/features/legal/privacy";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function Page() {
  return <PrivacyContent />;
}
