import { Body, Button, Container, Head, Html, Link, Preview, Text } from "@react-email/components";
import { tokens } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import type { ReactNode } from "react";

const font = "Barlow, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const SITE = "https://tartan.coach";

const FooterLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} style={{ color: tokens.color.muted, textDecoration: "underline" }}>
    {children}
  </Link>
);

// Identité Tartan : ligne encre, carte blanche, action encre et citron. Les mêmes couleurs dans tous les clients.
export const Layout = ({
  preview,
  footerNote,
  children,
}: {
  preview: string;
  footerNote?: ReactNode;
  children: ReactNode;
}) => (
  <Html lang="fr">
    <Head>
      <meta name="color-scheme" content="light" />
      <meta name="supported-color-schemes" content="light" />
    </Head>
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: tokens.color.bg, fontFamily: font, margin: 0, padding: "32px 16px" }}>
      <Container
        style={{
          backgroundColor: tokens.color.surface,
          borderRadius: 20,
          borderTop: `3px solid ${tokens.color.ink}`,
          maxWidth: 480,
          padding: 32,
        }}
      >
        <Text style={{ color: tokens.color.ink, fontSize: 20, fontWeight: 700, margin: "0 0 24px" }}>Tartan</Text>
        {children}
      </Container>
      <Container style={{ maxWidth: 480, padding: "16px 32px 0" }}>
        {footerNote ? (
          <Text style={{ color: tokens.color.muted, fontSize: 13, lineHeight: "18px", margin: "0 0 8px" }}>
            {footerNote}
          </Text>
        ) : null}
        <Text style={{ color: tokens.color.muted, fontSize: 13, lineHeight: "18px", margin: 0 }}>
          {m.email.publisher} <FooterLink href={`${SITE}/mentions-legales`}>{m.email.legal}</FooterLink>
          {" · "}
          <FooterLink href={`${SITE}/confidentialite`}>{m.email.privacy}</FooterLink>
          {" · "}
          <FooterLink href={`${SITE}/contact`}>{m.email.contact}</FooterLink>
        </Text>
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
  <Button
    href={href}
    style={{
      backgroundColor: tokens.color.ink,
      borderRadius: 999,
      color: tokens.color.film.lime,
      display: "inline-block",
      fontSize: 16,
      fontWeight: 600,
      margin: "4px 0 20px",
      padding: "14px 24px",
      textDecoration: "none",
    }}
  >
    {children}
  </Button>
);

// Lien en clair : certains clients ou antivirus cassent les boutons.
export const PlainLink = ({ href }: { href: string }) => (
  <Text
    style={{ color: tokens.color.muted, fontSize: 13, lineHeight: "18px", margin: "0 0 16px", wordBreak: "break-all" }}
  >
    <Link href={href} style={{ color: tokens.color.muted }}>
      {href}
    </Link>
  </Text>
);
