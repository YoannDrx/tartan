import { w } from "@tartan/i18n/web";
import { Layout, Paragraph, PlainLink, PrimaryLink, Title } from "./layout";

// Les e-mails du mot de passe : sécurité du compte, donc sans illustration (DESIGN.md).

// Un mot de passe vient d'être défini sur un compte qui n'en avait pas.
export const PasswordSetEmail = ({ url }: { url: string }) => {
  const t = w.auth.emails.passwordSet;
  return (
    <Layout preview={t.subject}>
      <Title>{t.subject}</Title>
      <Paragraph>{t.body}</Paragraph>
      <PrimaryLink href={url}>{t.cta}</PrimaryLink>
      <Paragraph muted>{t.notYou}</Paragraph>
    </Layout>
  );
};

// Demande de mot de passe depuis une session ancienne : le lien prouve que la boîte mail est bien à la personne.
export const ConfirmPasswordSetupEmail = ({ url }: { url: string }) => {
  const t = w.auth.emails.confirmSetup;
  return (
    <Layout preview={t.subject}>
      <Title>{t.subject}</Title>
      <Paragraph>{t.body}</Paragraph>
      <PrimaryLink href={url}>{t.cta}</PrimaryLink>
      <PlainLink href={url} />
      <Paragraph muted>{t.ignore}</Paragraph>
    </Layout>
  );
};

// Création de compte demandée sur une adresse déjà inscrite : l'écran répond comme pour un nouveau compte,
// c'est cet e-mail qui dit la vérité à la personne qui lit la boîte.
export const AccountExistsEmail = ({ url, invitation = false }: { url: string; invitation?: boolean }) => {
  const t = w.auth.emails.accountExists;
  return (
    <Layout preview={t.subject}>
      <Title>{t.subject}</Title>
      <Paragraph>{invitation ? t.bodyInvitation : t.body}</Paragraph>
      <Paragraph>{t.detail}</Paragraph>
      <PrimaryLink href={url}>{invitation ? t.ctaInvitation : t.cta}</PrimaryLink>
      <Paragraph muted>{t.ignore}</Paragraph>
    </Layout>
  );
};
