import { w } from "@tartan/i18n/web";
import { Layout, Paragraph, PrimaryLink } from "./layout";
export const BetaEmail = ({ url }: { url: string }) => (
  <Layout preview={w.admin.testers.subject}>
    <Paragraph>{w.admin.testers.intro}</Paragraph>
    <PrimaryLink href={url}>{w.admin.testers.install}</PrimaryLink>
  </Layout>
);
