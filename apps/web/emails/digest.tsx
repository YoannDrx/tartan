import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { FooterLink, Layout, Paragraph, PrimaryLink, Title } from "./layout";

export const WeeklyDigestEmail = ({
  organization,
  weekLabel,
  sessions,
  completionPct,
  url,
  unsubscribe,
}: {
  organization: string;
  weekLabel: string;
  sessions: number;
  completionPct: number | null;
  url: string;
  unsubscribe: string;
}) => (
  <Layout
    preview={w.comm.digest.preview(weekLabel)}
    footerNote={
      <>
        {m.email.digestFooter(organization)} <FooterLink href={unsubscribe}>{m.email.unsubscribeLink}</FooterLink>
      </>
    }
  >
    <Title>{w.comm.digest.title(weekLabel)}</Title>
    <Paragraph>{w.comm.digest.summary(organization, sessions, completionPct)}</Paragraph>
    <PrimaryLink href={url}>{w.comm.digest.cta}</PrimaryLink>
  </Layout>
);
