import { m } from "@tartan/i18n";
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
    preview={`Ta semaine du ${weekLabel}`}
    footerNote={
      <>
        {m.email.digestFooter(organization)} <FooterLink href={unsubscribe}>{m.email.unsubscribeLink}</FooterLink>
      </>
    }
  >
    <Title>{`Semaine du ${weekLabel}`}</Title>
    <Paragraph>
      {`${organization} : ${sessions} séance${sessions > 1 ? "s" : ""} publiée${sessions > 1 ? "s" : ""}${
        completionPct === null ? "." : `, ${completionPct}\u00a0% de réalisation.`
      }`}
    </Paragraph>
    <PrimaryLink href={url}>Voir le suivi</PrimaryLink>
  </Layout>
);
