import type { ReactNode } from "react";
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
  <Layout preview={`${inviter} t'invite à rejoindre ${target}`}>
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
