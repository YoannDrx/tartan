import { m } from "@tartan/i18n";
import { Layout, Paragraph, PrimaryLink, Title } from "./layout";

export const PurgeNoticeEmail = ({
  subject,
  body,
  url,
  cta,
}: {
  subject: string;
  body: string;
  url: string;
  cta: string;
}) => (
  <Layout preview={subject}>
    <Title>{subject}</Title>
    <Paragraph>{body}</Paragraph>
    <PrimaryLink href={url}>{cta}</PrimaryLink>
  </Layout>
);

export const SubscriptionConfirmedEmail = ({
  space,
  plan,
  price,
  interval,
  trialEnd,
  url,
}: {
  space: string;
  plan: string;
  price: number | null;
  interval: "month" | "year";
  trialEnd: string | null;
  url: string;
}) => {
  const t = m.email.confirmed;
  return (
    <Layout preview={t.subject(plan)}>
      <Title>{t.subject(plan)}</Title>
      {price !== null ? <Paragraph>{t.price(space, plan, price, interval)}</Paragraph> : null}
      {trialEnd ? <Paragraph>{t.trial(trialEnd)}</Paragraph> : null}
      <Paragraph>{t.cancelAnytime}</Paragraph>
      <PrimaryLink href={url}>{t.cta}</PrimaryLink>
      <Paragraph muted>{t.withdrawal}</Paragraph>
    </Layout>
  );
};

export const SubscriptionCancelledEmail = ({
  space,
  plan,
  date,
  url,
}: {
  space: string;
  plan: string;
  date: string;
  url: string;
}) => {
  const t = m.email.cancelled;
  return (
    <Layout preview={t.subject}>
      <Title>{t.subject}</Title>
      <Paragraph>{t.body(plan, space, date)}</Paragraph>
      <PrimaryLink href={url}>{t.cta}</PrimaryLink>
    </Layout>
  );
};

export const SubscriptionEndedEmail = ({ space, unpaid, url }: { space: string; unpaid: boolean; url: string }) => {
  const t = m.email.ended;
  return (
    <Layout preview={t.subject}>
      <Title>{t.subject}</Title>
      {unpaid ? <Paragraph>{t.unpaid}</Paragraph> : null}
      <Paragraph>{t.body(space)}</Paragraph>
      <PrimaryLink href={url}>{t.cta}</PrimaryLink>
    </Layout>
  );
};

export const BillingNoticeEmail = ({
  title,
  body,
  cta,
  url,
}: {
  title: string;
  body: string;
  cta: string;
  url: string;
}) => (
  <Layout preview={title}>
    <Title>{title}</Title>
    <Paragraph>{body}</Paragraph>
    <PrimaryLink href={url}>{cta}</PrimaryLink>
  </Layout>
);
