import { Link } from "@react-email/components";
import { m } from "@tartan/i18n";
import { Layout, Paragraph, PrimaryLink, Title } from "./layout";

// Un conseil : un titre, ce qu'il manque, un seul geste. Le pied rappelle pourquoi il arrive et comment l'arrêter.
export const TipEmail = ({
  title,
  body,
  help,
  cta,
  url,
  space,
  unsubscribe,
}: {
  title: string;
  body: string;
  help?: string;
  cta: string;
  url: string;
  space: string;
  unsubscribe: string;
}) => (
  <Layout
    preview={title}
    footerNote={
      <>
        {m.email.activation.footer(space)} <Link href={unsubscribe}>{m.email.unsubscribeLink}</Link>
      </>
    }
  >
    <Title>{title}</Title>
    <Paragraph>{body}</Paragraph>
    {help ? <Paragraph muted>{help}</Paragraph> : null}
    <PrimaryLink href={url}>{cta}</PrimaryLink>
  </Layout>
);
