import { w } from "@tartan/i18n/web";
import { FooterLink, Layout, Paragraph, PrimaryLink, Title } from "./layout";

// Les e-mails de l'athlète qui s'entraîne seul, et celui du coach à qui il partage son historique.

const t = w.personal.emails;

// À l'ouverture de son espace personnel : ce qu'il y fait, et une première séance à planifier.
export const PersonalWelcomeEmail = ({ url }: { url: string }) => (
  <Layout preview={t.welcome.subject} athlete="athleteWelcome">
    <Title>{t.welcome.subject}</Title>
    <Paragraph>{t.welcome.body}</Paragraph>
    <Paragraph muted>{t.welcome.tip}</Paragraph>
    <PrimaryLink href={url}>{t.welcome.cta}</PrimaryLink>
  </Layout>
);

// Un conseil sur la prochaine étape de ses premiers pas. Le pied dit pourquoi il arrive et comment l'arrêter.
export const PersonalTipEmail = ({
  title,
  body,
  help,
  cta,
  url,
  unsubscribe,
  unsubscribeLabel,
}: {
  title: string;
  body: string;
  help?: string;
  cta: string;
  url: string;
  unsubscribe: string;
  unsubscribeLabel: string;
}) => (
  <Layout
    preview={title}
    athlete="tip"
    footerNote={
      <>
        {t.activation.footer} <FooterLink href={unsubscribe}>{unsubscribeLabel}</FooterLink>
      </>
    }
  >
    <Title>{title}</Title>
    <Paragraph>{body}</Paragraph>
    {help ? <Paragraph muted>{help}</Paragraph> : null}
    <PrimaryLink href={url}>{cta}</PrimaryLink>
  </Layout>
);

// Un compte créé sans espace ni invitation, le lendemain : une fois, puis rien.
export const FinishSignupEmail = ({ url }: { url: string }) => (
  <Layout preview={t.finishSignup.subject}>
    <Title>{t.finishSignup.subject}</Title>
    <Paragraph>{t.finishSignup.body}</Paragraph>
    <PrimaryLink href={url}>{t.finishSignup.cta}</PrimaryLink>
    <Paragraph muted>{t.finishSignup.ignore}</Paragraph>
  </Layout>
);

// Au coach : un athlète de son groupe lui partage son historique personnel. Ni santé, ni chiffre dans le message.
export const HistorySharedEmail = ({ athlete, scopes, url }: { athlete: string; scopes: string; url: string }) => (
  <Layout preview={t.historyShared.subject(athlete)}>
    <Title>{t.historyShared.subject(athlete)}</Title>
    <Paragraph>{t.historyShared.body(athlete, scopes)}</Paragraph>
    <PrimaryLink href={url}>{t.historyShared.cta}</PrimaryLink>
  </Layout>
);
