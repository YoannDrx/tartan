import { Layout, Paragraph, PrimaryLink, Title } from "./layout";

export const WeeklyDigestEmail = ({
  organization,
  weekLabel,
  sessions,
  completionPct,
  url,
}: {
  organization: string;
  weekLabel: string;
  sessions: number;
  completionPct: number | null;
  url: string;
}) => (
  <Layout preview={`Ta semaine du ${weekLabel}`}>
    <Title>{`Semaine du ${weekLabel}`}</Title>
    <Paragraph>
      {`${organization} : ${sessions} séance${sessions > 1 ? "s" : ""} publiée${sessions > 1 ? "s" : ""}${
        completionPct === null ? "." : `, ${completionPct} % de réalisation.`
      }`}
    </Paragraph>
    <PrimaryLink href={url}>Voir le suivi</PrimaryLink>
  </Layout>
);
