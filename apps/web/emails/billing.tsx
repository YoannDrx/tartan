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
