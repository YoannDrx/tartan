import { w } from "@tartan/i18n/web";
import { Layout, Paragraph, PrimaryLink } from "./layout";
export const BetaEmail = ({ url, update }: { url: string; update?: string }) => (
  <Layout preview={update ? w.admin.testers.update(update) : w.admin.testers.subject}>
    <Paragraph>{update ? w.admin.testers.updateBody : w.admin.testers.intro}</Paragraph>
    <PrimaryLink href={url}>{w.admin.testers.install}</PrimaryLink>
  </Layout>
);
