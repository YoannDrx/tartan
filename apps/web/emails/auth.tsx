import type { ReactNode } from "react";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Layout, PlainLink, PrimaryLink, Paragraph, Title } from "./layout";

const e = w.auth.emails;

export const MagicLinkEmail = ({ url }: { url: string }) => (
  <Layout preview={e.magicLink.preview}>
    <Title>{e.magicLink.title}</Title>
    <Paragraph>{e.magicLink.body}</Paragraph>
    <PrimaryLink href={url}>{e.magicLink.cta}</PrimaryLink>
    <PlainLink href={url} />
    <Paragraph muted>{e.magicLink.ignore}</Paragraph>
  </Layout>
);

export const VerifyEmail = ({ url }: { url: string }) => (
  <Layout preview={e.verify.preview}>
    <Title>{e.verify.title}</Title>
    <Paragraph>{e.verify.body}</Paragraph>
    <PrimaryLink href={url}>{e.verify.cta}</PrimaryLink>
    <PlainLink href={url} />
    <Paragraph muted>{e.verify.ignore}</Paragraph>
  </Layout>
);

// Repli pour qui n'a aucun appareil abonné aux notifications : même texte neutre, jamais de donnée de santé.
export const NotificationEmail = ({
  body,
  detail,
  url,
  cta = e.notification.cta,
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
  <Layout preview={e.reset.preview}>
    <Title>{e.reset.title}</Title>
    <Paragraph>{e.reset.body}</Paragraph>
    <PrimaryLink href={url}>{e.reset.cta}</PrimaryLink>
    <PlainLink href={url} />
    <Paragraph muted>{e.reset.ignore}</Paragraph>
  </Layout>
);

export const InvitationEmail = ({ url, inviter, target }: { url: string; inviter: string; target: string }) => (
  <Layout preview={e.invitation.title(inviter, target)} athlete="invitation">
    <Title>{e.invitation.title(inviter, target)}</Title>
    <Paragraph>{`${e.invitation.body} ${e.personalLink}`}</Paragraph>
    <PrimaryLink href={url}>{e.invitation.cta}</PrimaryLink>
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
  <Layout preview={e.staffInvitation.title(inviter, organization)}>
    <Title>{e.staffInvitation.title(inviter, organization)}</Title>
    <Paragraph>{`${e.staffInvitation.role[role]} ${e.personalLink}`}</Paragraph>
    <PrimaryLink href={url}>{e.staffInvitation.cta}</PrimaryLink>
    <Paragraph muted>{e.staffInvitation.unknown(inviter)}</Paragraph>
  </Layout>
);

export const ParentalConsentEmail = ({ url, athlete, coach }: { url: string; athlete: string; coach: string }) => (
  <Layout preview={e.parentalConsent.preview(athlete)}>
    <Title>{e.parentalConsent.title(athlete)}</Title>
    <Paragraph>{e.parentalConsent.body(athlete, coach)}</Paragraph>
    <PrimaryLink href={url}>{e.parentalConsent.cta}</PrimaryLink>
    <Paragraph muted>{e.parentalConsent.noAnswer}</Paragraph>
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
