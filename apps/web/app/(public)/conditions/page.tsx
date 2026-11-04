import type { Metadata } from "next";
import { TermsContent } from "@/features/legal/terms";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

export default function Page() {
  return <TermsContent />;
}
