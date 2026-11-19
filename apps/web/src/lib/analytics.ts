import type { BeforeSend } from "@vercel/analytics/next";
import { scrubUrl } from "@/lib/sentry";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// Le bandeau de l'espace de démonstration porte cet attribut : tant qu'il est affiché, rien n'est mesuré.
export const DEMO_SPACE_MARKER = "data-demo-space";

const inDemoSpace = (): boolean =>
  typeof document !== "undefined" && document.querySelector(`[${DEMO_SPACE_MARKER}]`) !== null;

// La mesure d'audience ne voit ni jeton d'URL, ni paramètre, ni identifiant de personne ou de séance, ni la
// visite d'un espace de démonstration.
export const scrubAnalyticsEvent: BeforeSend = (event) =>
  inDemoSpace()
    ? null
    : {
        ...event,
        url: scrubUrl(event.url).replace(UUID, "[id]"),
      };
