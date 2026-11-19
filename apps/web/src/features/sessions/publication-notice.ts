import { publicationNotice } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";

// Le message de la publication dit qui la reçoit vraiment (audit G10). Sans décompte, la phrase reste neutre.
export const publishedToast = (recipients: { athletes: number; notified: number } | null | undefined): string =>
  recipients ? w.sessions.publishedMessage(publicationNotice(recipients)) : m.builder.published;
