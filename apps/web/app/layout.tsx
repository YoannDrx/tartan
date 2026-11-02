import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { tokens } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import { ToastHost } from "@/components/ui/toast";
import { fontVariables } from "./fonts";
import "./globals.css";

// La CSP à nonce exige un rendu à la demande : une page statique verrait ses scripts bloqués.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://tartan.coach"),
  title: { default: m.brand.storeName, template: "%s · Tartan" },
  description: m.brand.tagline,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: tokens.scene.page,
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={fontVariables}>
      <body>
        <NuqsAdapter>
          {children}
          <ToastHost />
        </NuqsAdapter>
        <Analytics />
      </body>
    </html>
  );
}
