import { Layout, PrimaryLink, Paragraph, Title } from "./layout";

export const MagicLinkEmail = ({ url }: { url: string }) => (
  <Layout preview="Ton lien de connexion à Tartan">
    <Title>Connecte-toi à Tartan</Title>
    <Paragraph>Ce lien fonctionne une fois et expire dans 15 minutes.</Paragraph>
    <PrimaryLink href={url}>Me connecter</PrimaryLink>
    <Paragraph muted>Tu n'as rien demandé ? Ignore ce message, rien ne changera.</Paragraph>
  </Layout>
);

export const VerifyEmail = ({ url }: { url: string }) => (
  <Layout preview="Confirme ton adresse pour Tartan">
    <Title>Confirme ton adresse</Title>
    <Paragraph>Un clic suffit pour activer ton compte Tartan.</Paragraph>
    <PrimaryLink href={url}>Confirmer mon adresse</PrimaryLink>
    <Paragraph muted>Tu n'as rien demandé ? Ignore ce message, le compte restera inactif.</Paragraph>
  </Layout>
);

export const ResetPasswordEmail = ({ url }: { url: string }) => (
  <Layout preview="Réinitialise ton mot de passe Tartan">
    <Title>Nouveau mot de passe</Title>
    <Paragraph>Ce lien te permet de choisir un nouveau mot de passe.</Paragraph>
    <PrimaryLink href={url}>Choisir un mot de passe</PrimaryLink>
    <Paragraph muted>Tu n'as rien demandé ? Ignore ce message, ton mot de passe reste le même.</Paragraph>
  </Layout>
);

export const InvitationEmail = ({ url, inviter, target }: { url: string; inviter: string; target: string }) => (
  <Layout preview={`${inviter} t'invite à rejoindre ${target}`}>
    <Title>{`${inviter} t'invite à rejoindre ${target}`}</Title>
    <Paragraph>
      Tes séances arriveront directement dans Tartan, plus besoin de SMS. Ce lien est personnel et valable 7 jours.
    </Paragraph>
    <PrimaryLink href={url}>Rejoindre le groupe</PrimaryLink>
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
