import type { ErrorEvent } from "@sentry/nextjs";

// Jamais de donnée de santé ni de jeton : ni corps de requête, ni cookies, ni utilisateur, ni jeton d'URL (§ 14).
export const scrubUrl = (url: string): string =>
  url
    .replace(/\?.*$/, "")
    .replace(/\/(i|r|accord-parental|nouveau-mot-de-passe)\/[^/]+/, "/$1/[masqué]")
    .replace(/\/api\/ical\/[^/]+\/[^/]+/, "/api/ical/[masqué]")
    .replace(/\/(e-mails|api\/email\/desinscription)\/([^/]+)\/[^/]+/, "/$1/$2/[masqué]");

export const scrubEvent = (event: ErrorEvent): ErrorEvent => {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.headers;
    delete event.request.query_string;
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
  }
  // Les fils d'Ariane reprennent des URL et des textes d'écran.
  delete event.breadcrumbs;
  return event;
};

export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend: scrubEvent,
};
