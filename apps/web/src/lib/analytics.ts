import type { BeforeSend } from "@vercel/analytics/next";
import { scrubUrl } from "@/lib/sentry";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// La mesure d'audience ne voit ni jeton d'URL, ni paramètre, ni identifiant de personne ou de séance.
export const scrubAnalyticsEvent: BeforeSend = (event) => ({
  ...event,
  url: scrubUrl(event.url).replace(UUID, "[id]"),
});
