import { PLANS } from "@tartan/domain";
import { m } from "@tartan/i18n";
import type { ReactElement } from "react";
import {
  AccountDeletedEmail,
  InactivityNoticeEmail,
  InvitationEmail,
  MagicLinkEmail,
  NotificationEmail,
  ParentalConsentEmail,
  PasswordChangedEmail,
  ResetPasswordEmail,
  SpaceTransferredEmail,
  StaffInvitationEmail,
  VerifyEmail,
  WelcomeEmail,
  WorkspaceInactivityEmail,
} from "./auth";
import {
  BillingNoticeEmail,
  PurgeNoticeEmail,
  RenewalNoticeEmail,
  SubscriptionCancelledEmail,
  SubscriptionConfirmedEmail,
  SubscriptionEndedEmail,
} from "./billing";
import { WeeklyDigestEmail } from "./digest";

export type EmailSample = { key: string; subject: string; react: ReactElement };

const SPACE = "Club fictif";
const INVITER = "Camille Martin";
const ATHLETE = "Léa Moreau";
const PLAN = m.billing.plans.coach;

// Chaque e-mail du produit avec des données fictives : les liens mènent à une page sans effet, jamais à un jeton réel.
export const emailCatalog = (appUrl: string): EmailSample[] => {
  const url = `${appUrl}/connexion`;
  const notices = [
    ["payment_failed", m.email.paymentFailed],
    ["payment_action_required", m.email.paymentActionRequired],
    ["payment_recovered", m.email.paymentRecovered],
    ["trial_ending", m.email.trialEnding],
  ] as const;
  return [
    { key: "verify", subject: "Confirme ton adresse pour Tartan", react: <VerifyEmail url={url} /> },
    { key: "magic_link", subject: "Ton lien de connexion Tartan", react: <MagicLinkEmail url={url} /> },
    { key: "reset_password", subject: "Réinitialise ton mot de passe Tartan", react: <ResetPasswordEmail url={url} /> },
    { key: "password_changed", subject: m.email.passwordChanged.subject, react: <PasswordChangedEmail url={url} /> },
    {
      key: "invitation_athlete",
      subject: `${INVITER} t'invite à rejoindre ${SPACE}`,
      react: <InvitationEmail url={url} inviter={INVITER} target={SPACE} />,
    },
    {
      key: "invitation_staff",
      subject: `${INVITER} t'invite dans l'espace ${SPACE} sur Tartan`,
      react: <StaffInvitationEmail url={url} inviter={INVITER} organization={SPACE} role="coach" />,
    },
    {
      key: "parental_consent",
      subject: `Ton accord est demandé pour ${ATHLETE}`,
      react: <ParentalConsentEmail url={url} athlete={ATHLETE} coach={INVITER} />,
    },
    { key: "welcome", subject: m.email.welcome.subject(SPACE), react: <WelcomeEmail space={SPACE} url={url} /> },
    {
      key: "weekly_digest",
      subject: `Ta semaine sur Tartan : ${SPACE}`,
      react: (
        <WeeklyDigestEmail
          organization={SPACE}
          weekLabel="2 novembre"
          sessions={4}
          completionPct={75}
          url={url}
          unsubscribe={url}
        />
      ),
    },
    {
      key: "notification_fallback",
      subject: "Nouvelle séance publiée",
      react: <NotificationEmail body="Nouvelle séance publiée" detail="Mardi 10 novembre, à 18 h 30." url={url} />,
    },
    {
      key: "content_report",
      subject: "Un contenu a été signalé",
      react: <NotificationEmail body="Un contenu a été signalé" url={url} cta={m.email.reportCta} />,
    },
    {
      key: "founder_alert",
      subject: `Paiement échoué pour ${SPACE}`,
      react: <NotificationEmail body={`Paiement échoué pour ${SPACE}`} url={url} />,
    },
    { key: "inactivity", subject: m.email.inactivity.subject, react: <InactivityNoticeEmail days={30} url={url} /> },
    {
      key: "workspace_inactivity",
      subject: m.email.workspaceInactivity.subject(SPACE),
      react: <WorkspaceInactivityEmail space={SPACE} days={30} url={url} />,
    },
    {
      key: "video_purge",
      subject: m.billing.purge.subject(3, SPACE),
      react: (
        <PurgeNoticeEmail
          subject={m.billing.purge.subject(3, SPACE)}
          body={m.billing.purge.body(3, SPACE, "24 novembre 2026", 30, "23 novembre 2026")}
          cta={m.billing.purge.cta}
          url={url}
        />
      ),
    },
    {
      key: "subscription_started",
      subject: m.email.confirmed.subject(PLAN),
      react: (
        <SubscriptionConfirmedEmail
          space={SPACE}
          plan={PLAN}
          price={PLANS.coach.prices?.month ?? null}
          interval="month"
          trialEnd="23 novembre 2026"
          url={url}
        />
      ),
    },
    {
      key: "subscription_cancelled",
      subject: m.email.cancelled.subject,
      react: <SubscriptionCancelledEmail space={SPACE} plan={PLAN} date="23 novembre 2026" url={url} />,
    },
    {
      key: "subscription_ended",
      subject: m.email.ended.subject,
      react: <SubscriptionEndedEmail space={SPACE} unpaid={false} url={url} />,
    },
    ...notices.map(([key, copy]) => ({
      key,
      subject: copy.subject,
      react: (
        <BillingNoticeEmail title={copy.subject} body={copy.body(SPACE, "23 novembre 2026")} cta={copy.cta} url={url} />
      ),
    })),
    {
      key: "renewal_notice",
      subject: m.email.renewalNotice.subject,
      react: (
        <RenewalNoticeEmail
          title={m.email.renewalNotice.subject}
          body={m.email.renewalNotice.body(SPACE)}
          deadline={m.email.renewalNotice.deadline("23 décembre 2026")}
          cta={m.email.renewalNotice.cta}
          url={url}
        />
      ),
    },
    {
      key: "account_deleted",
      subject: m.email.accountDeleted.subject,
      react: <AccountDeletedEmail hadSubscription />,
    },
    {
      key: "space_transferred",
      subject: m.email.spaceTransferred.subject(SPACE),
      react: <SpaceTransferredEmail previous={INVITER} space={SPACE} subscriptionEnds="23 novembre 2026" url={url} />,
    },
  ];
};
