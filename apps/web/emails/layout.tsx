import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { tokens } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import type { ReactNode } from "react";
import { EMAIL_ATHLETE_HEIGHT, emailAthletePath, type EmailAthlete } from "./athletes";

const font = "Barlow, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const SITE = "https://tartan.coach";

const FooterLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} style={{ color: tokens.color.white, textDecoration: "underline" }}>
    {children}
  </Link>
);

const footerText = { color: tokens.color.mutedOnInk, fontSize: 13, lineHeight: "19px" };

// Les deux lignes blanches de la piste, en tableaux : c'est la seule forme fiable dans Outlook.
const Lanes = () => (
  <>
    <Section style={{ backgroundColor: tokens.color.white, height: 2, lineHeight: "2px", fontSize: 1 }}>&nbsp;</Section>
    <Section style={{ backgroundColor: tokens.band.background, height: 6, lineHeight: "6px", fontSize: 1 }}>
      &nbsp;
    </Section>
    <Section style={{ backgroundColor: tokens.color.white, height: 2, lineHeight: "2px", fontSize: 1 }}>&nbsp;</Section>
    <Section style={{ backgroundColor: tokens.band.background, height: 10, lineHeight: "10px", fontSize: 1 }}>
      &nbsp;
    </Section>
  </>
);

// Identité Tartan : bandeau piste et logo complet, message sur blanc, pied de page encre. Clair dans tous les clients.
// Un athlète du groupe peut se tenir à droite du logo, les pieds sur les lignes de la piste (athletes.ts).
export const Layout = ({
  preview,
  footerNote,
  athlete,
  children,
}: {
  preview: string;
  footerNote?: ReactNode;
  athlete?: EmailAthlete;
  children: ReactNode;
}) => (
  <Html lang="fr">
    <Head>
      <meta name="color-scheme" content="light" />
      <meta name="supported-color-schemes" content="light" />
    </Head>
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: tokens.color.bg, fontFamily: font, margin: 0, padding: "24px 12px" }}>
      <Container style={{ borderRadius: 20, maxWidth: 560, overflow: "hidden" }}>
        <Section
          style={{ backgroundColor: tokens.band.background, padding: athlete ? "16px 32px 0" : "24px 32px 20px" }}
        >
          <Row>
            <Column style={{ verticalAlign: athlete ? "top" : "middle", paddingTop: athlete ? 8 : 0 }}>
              <Link href={SITE}>
                <Img
                  src={`${SITE}/brand/logo-email.png`}
                  alt="Tartan"
                  height={36}
                  style={{ display: "block", border: 0 }}
                />
              </Link>
            </Column>
            {athlete ? (
              <Column align="right" style={{ verticalAlign: "bottom", width: 72 }}>
                <Img
                  src={`${SITE}${emailAthletePath(athlete)}`}
                  alt=""
                  height={EMAIL_ATHLETE_HEIGHT}
                  style={{ display: "block", border: 0 }}
                />
              </Column>
            ) : null}
          </Row>
        </Section>
        <Lanes />
        <Section style={{ backgroundColor: tokens.color.surface, padding: "32px 32px 16px" }}>{children}</Section>
        <Section style={{ backgroundColor: tokens.color.ink, padding: "24px 32px 28px" }}>
          {footerNote ? <Text style={{ ...footerText, margin: "0 0 12px" }}>{footerNote}</Text> : null}
          <Text style={{ ...footerText, margin: "0 0 12px" }}>
            <FooterLink href={`${SITE}/mentions-legales`}>{m.email.legal}</FooterLink>
            {"  ·  "}
            <FooterLink href={`${SITE}/confidentialite`}>{m.email.privacy}</FooterLink>
            {"  ·  "}
            <FooterLink href={`${SITE}/contact`}>{m.email.contact}</FooterLink>
          </Text>
          <Text style={{ ...footerText, margin: 0 }}>{m.email.publisher}</Text>
        </Section>
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
      backgroundColor: tokens.band.background,
      borderRadius: 14,
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
