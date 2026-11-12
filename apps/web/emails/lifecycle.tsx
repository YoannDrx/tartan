import { Link } from "@react-email/components";
import { m } from "@tartan/i18n";
import { Layout, Paragraph, PrimaryLink, Title } from "./layout";

// Un conseil : un titre, ce qu'il manque, un seul geste. Le pied rappelle pourquoi il arrive et comment l'arrêter.
export const TipEmail = ({
  title,
  body,
  help,
  cta,
  url,
  space,
  unsubscribe,
}: {
  title: string;
  body: string;
  help?: string;
  cta: string;
  url: string;
  space: string;
  unsubscribe: string;
}) => (
  <Layout
    preview={title}
    athlete="tip"
    footerNote={
      <>
        {m.email.activation.footer(space)} <Link href={unsubscribe}>{m.email.unsubscribeLink}</Link>
      </>
    }
  >
    <Title>{title}</Title>
    <Paragraph>{body}</Paragraph>
    {help ? <Paragraph muted>{help}</Paragraph> : null}
    <PrimaryLink href={url}>{cta}</PrimaryLink>
  </Layout>
);

// Après l'invitation acceptée : où arrivent les séances, et les deux gestes qui évitent d'en manquer une.
export const AthleteWelcomeEmail = ({
  title,
  body,
  tip,
  cta,
  url,
}: {
  title: string;
  body: string;
  tip: string;
  cta: string;
  url: string;
}) => (
  <Layout preview={title} athlete="athleteWelcome">
    <Title>{title}</Title>
    <Paragraph>{body}</Paragraph>
    <Paragraph muted>{tip}</Paragraph>
    <PrimaryLink href={url}>{cta}</PrimaryLink>
  </Layout>
);

// Un seul rappel, signé du coach. Le pied permet à qui ne veut pas venir de ne plus rien recevoir.
export const InvitationReminderEmail = ({
  title,
  body,
  cta,
  url,
  optOut,
}: {
  title: string;
  body: string;
  cta: string;
  url: string;
  optOut: string;
}) => (
  <Layout
    preview={title}
    footerNote={
      <>
        {m.email.invitationReminder.footer} <Link href={optOut}>{m.email.invitationReminder.optOut}</Link>
      </>
    }
  >
    <Title>{title}</Title>
    <Paragraph>{body}</Paragraph>
    <PrimaryLink href={url}>{cta}</PrimaryLink>
  </Layout>
);
