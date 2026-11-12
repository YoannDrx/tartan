import type { ReactNode } from "react";
import { m } from "@tartan/i18n";
import { Layout, PlainLink, PrimaryLink, Paragraph, Title } from "./layout";

export const MagicLinkEmail = ({ url }: { url: string }) => (
  <Layout preview="Ton lien de connexion à Tartan">
    <Title>Connecte-toi à Tartan</Title>
    <Paragraph>Ce lien fonctionne une fois et expire dans 15 minutes.</Paragraph>
    <PrimaryLink href={url}>Me connecter</PrimaryLink>
    <PlainLink href={url} />
    <Paragraph muted>Tu n'as rien demandé&nbsp;? Ignore ce message, rien ne changera.</Paragraph>
  </Layout>
);

export const VerifyEmail = ({ url }: { url: string }) => (
  <Layout preview="Confirme ton adresse pour Tartan">
    <Title>Confirme ton adresse</Title>
    <Paragraph>Un clic suffit pour activer ton compte Tartan. Ce lien reste valable 1 heure.</Paragraph>
    <PrimaryLink href={url}>Confirmer mon adresse</PrimaryLink>
    <PlainLink href={url} />
    <Paragraph muted>Tu n'as rien demandé&nbsp;? Ignore ce message, le compte restera inactif.</Paragraph>
  </Layout>
);

// Repli pour qui n'a aucun appareil abonné aux notifications : même texte neutre, jamais de donnée de santé.
export const NotificationEmail = ({
  body,
  detail,
  url,
  cta = "Ouvrir Tartan",
  footerNote,
}: {
  body: string;
  detail?: string;
  url: string;
  cta?: string;
  footerNote?: ReactNode;
}) => (
  <Layout preview={body} footerNote={footerNote}>
    <Title>{body}</Title>
    {detail ? <Paragraph>{detail}</Paragraph> : null}
    <PrimaryLink href={url}>{cta}</PrimaryLink>
  </Layout>
);

export const ResetPasswordEmail = ({ url }: { url: string }) => (
  <Layout preview="Réinitialise ton mot de passe Tartan">
    <Title>Nouveau mot de passe</Title>
    <Paragraph>Ce lien te permet de choisir un nouveau mot de passe. Il reste valable 1 heure.</Paragraph>
    <PrimaryLink href={url}>Choisir un mot de passe</PrimaryLink>
    <PlainLink href={url} />
    <Paragraph muted>Tu n'as rien demandé&nbsp;? Ignore ce message, ton mot de passe reste le même.</Paragraph>
  </Layout>
);

export const InvitationEmail = ({ url, inviter, target }: { url: string; inviter: string; target: string }) => (
  <Layout preview={`${inviter} t'invite à rejoindre ${target}`} athlete="invitation">
    <Title>{`${inviter} t'invite à rejoindre ${target}`}</Title>
    <Paragraph>
      Tes séances arriveront directement dans Tartan. Ce lien est personnel, sert une seule fois et reste valable 7
      jours.
    </Paragraph>
    <PrimaryLink href={url}>Rejoindre le groupe</PrimaryLink>
  </Layout>
);

export const StaffInvitationEmail = ({
  url,
  inviter,
  organization,
  role,
}: {
  url: string;
  inviter: string;
  organization: string;
  role: "coach" | "assistant";
}) => (
  <Layout preview={`${inviter} t'invite dans l'espace ${organization}`}>
    <Title>{`${inviter} t'invite dans l'espace ${organization}`}</Title>
    <Paragraph>
      {role === "coach"
        ? "Tu pourras préparer les séances, suivre les retours des athlètes et analyser leurs sauts."
        : "Tu pourras gérer tes séances et voir les retours des athlètes de tes groupes."}{" "}
      Ce lien est personnel, sert une seule fois et reste valable 7 jours.
    </Paragraph>
    <PrimaryLink href={url}>Rejoindre l'espace</PrimaryLink>
    <Paragraph muted>{`Tu ne connais pas ${inviter}\u00a0? Ignore ce message, rien ne sera créé.`}</Paragraph>
  </Layout>
);

export const ParentalConsentEmail = ({ url, athlete, coach }: { url: string; athlete: string; coach: string }) => (
  <Layout preview={`Ton accord est demandé pour ${athlete}`}>
    <Title>{`${athlete} a besoin de ton accord`}</Title>
    <Paragraph>
      {`${athlete} rejoint le groupe d'entraînement de ${coach} sur Tartan. Comme il ou elle a moins de 15 ans, ton accord est nécessaire pour traiter ses informations de santé et conserver ses vidéos de saut.`}
    </Paragraph>
    <PrimaryLink href={url}>Lire et répondre</PrimaryLink>
    <Paragraph muted>Sans réponse de ta part, ces deux usages restent désactivés.</Paragraph>
  </Layout>
);

export const WelcomeEmail = ({ space, url }: { space: string; url: string }) => {
  const t = m.email.welcome;
  return (
    <Layout preview={t.subject(space)} athlete="welcome">
      <Title>{t.subject(space)}</Title>
      <Paragraph>{t.body}</Paragraph>
      <PrimaryLink href={url}>{t.cta}</PrimaryLink>
      <Paragraph muted>{t.question}</Paragraph>
    </Layout>
  );
};

export const AccountDeletedEmail = ({ hadSubscription }: { hadSubscription: boolean }) => {
  const t = m.email.accountDeleted;
  return (
    <Layout preview={t.subject}>
      <Title>{t.subject}</Title>
      <Paragraph>{t.body}</Paragraph>
      {hadSubscription ? <Paragraph>{t.subscription}</Paragraph> : null}
      <Paragraph muted>{t.notYou}</Paragraph>
    </Layout>
  );
};

export const SpaceTransferredEmail = ({
  previous,
  space,
  subscriptionEnds,
  url,
}: {
  previous: string;
  space: string;
  subscriptionEnds: string | null;
  url: string;
}) => {
  const t = m.email.spaceTransferred;
  return (
    <Layout preview={t.subject(space)}>
      <Title>{t.subject(space)}</Title>
      <Paragraph>{t.body(previous, space)}</Paragraph>
      {subscriptionEnds ? <Paragraph>{t.subscriptionEnds(subscriptionEnds)}</Paragraph> : null}
      <PrimaryLink href={url}>{t.cta}</PrimaryLink>
    </Layout>
  );
};

export const PasswordChangedEmail = ({ url }: { url: string }) => {
  const t = m.email.passwordChanged;
  return (
    <Layout preview={t.subject}>
      <Title>{t.subject}</Title>
      <Paragraph>{t.body}</Paragraph>
      <PrimaryLink href={url}>{t.cta}</PrimaryLink>
    </Layout>
  );
};

export const InactivityNoticeEmail = ({ days, url }: { days: number; url: string }) => {
  const t = m.email.inactivity;
  return (
    <Layout preview={t.subject}>
      <Title>{t.subject}</Title>
      <Paragraph>{t.body(days)}</Paragraph>
      <PrimaryLink href={url}>{t.cta}</PrimaryLink>
    </Layout>
  );
};

export const WorkspaceInactivityEmail = ({ space, days, url }: { space: string; days: number; url: string }) => (
  <Layout preview={m.email.workspaceInactivity.subject(space)}>
    <Title>{m.email.workspaceInactivity.subject(space)}</Title>
    <Paragraph>{m.email.workspaceInactivity.body(days)}</Paragraph>
    <PrimaryLink href={url}>{m.email.workspaceInactivity.cta}</PrimaryLink>
  </Layout>
);
