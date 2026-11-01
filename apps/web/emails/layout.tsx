import { Body, Container, Head, Html, Link, Preview, Text } from "@react-email/components";
import { tokens } from "@tartan/design-tokens";
import type { ReactNode } from "react";

const font = "Barlow, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export const Layout = ({ preview, children }: { preview: string; children: ReactNode }) => (
  <Html lang="fr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: tokens.color.bg, fontFamily: font, margin: 0, padding: "32px 16px" }}>
      <Container
        style={{
          backgroundColor: tokens.color.surface,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: 14,
          padding: 32,
          maxWidth: 480,
        }}
      >
        <Text style={{ color: tokens.color.brandStrong, fontSize: 20, fontWeight: 700, margin: "0 0 24px" }}>
          Tartan
        </Text>
        {children}
      </Container>
    </Body>
  </Html>
);

export const Title = ({ children }: { children: ReactNode }) => (
  <Text style={{ color: tokens.color.ink, fontSize: 24, fontWeight: 700, lineHeight: "28px", margin: "0 0 12px" }}>
    {children}
  </Text>
);

export const Paragraph = ({ children, muted }: { children: ReactNode; muted?: boolean }) => (
  <Text
    style={{
      color: muted ? tokens.color.muted : tokens.color.ink,
      fontSize: 15,
      lineHeight: "22px",
      margin: "0 0 16px",
    }}
  >
    {children}
  </Text>
);

export const PrimaryLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link
    href={href}
    style={{
      backgroundColor: tokens.color.brand,
      borderRadius: 999,
      color: tokens.color.white,
      display: "inline-block",
      fontSize: 16,
      fontWeight: 600,
      margin: "4px 0 20px",
      padding: "14px 24px",
      textDecoration: "none",
    }}
  >
    {children}
  </Link>
);
