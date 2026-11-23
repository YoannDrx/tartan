import type { PublicationRecipients } from "@tartan/contracts";
import { publicationNotice } from "@tartan/domain";
import { m } from "@tartan/i18n";

const t = m.nativePublication;

/**
 * Ce que dit la publication au coach (audit G10) : la même règle que le web, `publicationNotice`, sur le décompte que
 * renvoie le serveur. Sans décompte (serveur plus ancien), la phrase reste neutre.
 */
export const publishedMessage = (recipients: PublicationRecipients | null | undefined, personal = false): string => {
  // Dans son espace personnel, l'athlète planifie pour lui seul : personne à prévenir, la séance l'attend.
  if (personal) return m.mobile.solo.published;
  if (!recipients) return m.builder.published;
  const notice = publicationNotice(recipients);
  if (notice.kind === "empty") return t.empty;
  if (notice.kind === "unreachable") return t.unreachable(notice.athletes);
  return t.notified(notice.notified, notice.athletes);
};
