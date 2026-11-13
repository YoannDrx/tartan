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
// Les titres en Barlow Condensed quand la messagerie l'a ; sinon une capitale étroite, jamais une police chargée chez
// un tiers (une police Google transmettrait l'adresse IP du lecteur).
const condensed = "'Barlow Condensed', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";
const SITE = "https://tartan.coach";
const { scene } = tokens;

// Liens du pied de page et des mentions de désinscription : blancs et soulignés sur la piste.
export const FooterLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} style={{ color: scene.onPage, textDecoration: "underline" }}>
    {children}
  </Link>
);

const footerText = { color: scene.onPage, fontSize: 13, lineHeight: "19px" };

// Une bande pleine largeur d'une seule couleur, en tableau : la seule forme fiable dans Outlook.
const Band = ({ color, height }: { color: string; height: number }) => (
  <Section style={{ backgroundColor: color, height, lineHeight: `${height}px`, fontSize: 1 }}>&nbsp;</Section>
);

// Les deux lignes blanches de la piste, sous le bandeau, comme en tête de chaque écran de l'application.
const Lanes = () => (
  <>
    <Band color={scene.lane} height={2} />
    <Band color={scene.page} height={6} />
    <Band color={scene.lane} height={2} />
  </>
);

// Le mélange Tartan, comme dans l'application : la piste en fond, le message sur une carte encre, l'action en citron,
// les lignes blanches du couloir. Une ligne d'arrivée blanche sépare le message du pied de page, posé sur la piste.
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
    <Body style={{ backgroundColor: scene.page, color: scene.onPage, fontFamily: font, margin: 0, padding: "24px 0" }}>
      <Container style={{ backgroundColor: scene.page, maxWidth: 560 }}>
        <Section style={{ padding: athlete ? "8px 24px 0" : "16px 24px 20px" }}>
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
        <Section style={{ padding: "24px 12px 0" }}>
          <Section
            style={{
              backgroundColor: scene.card,
              borderRadius: 20,
              color: scene.text,
              padding: "32px 28px 16px",
            }}
          >
            {children}
          </Section>
        </Section>
        <Section style={{ padding: "28px 0 0" }}>
          <Band color={scene.lane} height={2} />
        </Section>
        <Section style={{ padding: "20px 24px 8px" }}>
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
  <Text
    style={{
      color: scene.text,
      fontFamily: condensed,
      fontSize: 30,
      fontWeight: 700,
      letterSpacing: "-0.2px",
      lineHeight: "32px",
      margin: "0 0 14px",
    }}
  >
    {children}
  </Text>
);

export const Paragraph = ({ children, muted }: { children: ReactNode; muted?: boolean }) => (
  <Text
    style={{
      color: muted ? scene.textMuted : scene.text,
      fontSize: 15,
      lineHeight: "22px",
      margin: "0 0 16px",
    }}
  >
    {children}
  </Text>
);

// L'action principale, en citron sur l'encre, comme le bouton principal de l'application.
export const PrimaryLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Button
    href={href}
    style={{
      backgroundColor: scene.actionOnCard,
      borderRadius: 14,
      color: scene.onActionOnCard,
      display: "inline-block",
      fontSize: 16,
      fontWeight: 700,
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
    style={{ color: scene.textMuted, fontSize: 13, lineHeight: "18px", margin: "0 0 16px", wordBreak: "break-all" }}
  >
    <Link href={href} style={{ color: scene.link }}>
      {href}
    </Link>
  </Text>
);

// Un encadré sur la carte : une échéance, un montant. Bordure citron sur une encre relevée.
export const Highlight = ({ children }: { children: ReactNode }) => (
  <Section
    style={{
      backgroundColor: scene.cardRaised,
      border: `2px solid ${scene.actionOnCard}`,
      borderRadius: 12,
      margin: "0 0 20px",
    }}
  >
    <Text style={{ color: scene.text, fontSize: 16, fontWeight: 700, margin: 0, padding: "14px 16px" }}>
      {children}
    </Text>
  </Section>
);
