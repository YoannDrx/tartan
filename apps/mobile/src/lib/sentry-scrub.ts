type ScrubbableEvent = {
  user?: unknown;
  request?: { url?: string; query_string?: unknown; data?: unknown; headers?: unknown; cookies?: unknown };
  breadcrumbs?: unknown;
  contexts?: Record<string, unknown>;
  message?: string;
};

// Jeton d'invitation, de parrainage ou de réinitialisation : jamais hors du téléphone.
export const scrubUrl = (url: string): string =>
  url.replace(/\?.*$/, "").replace(/\/(i|r|nouveau-mot-de-passe)\/[^/]+/, "/$1/[masqué]");

// Ni donnée de santé, ni utilisateur, ni fil d'Ariane : un plantage se comprend sans eux.
export const scrubSentryEvent = <T extends ScrubbableEvent>(event: T): T => {
  delete event.user;
  delete event.breadcrumbs;
  if (event.request) {
    delete event.request.query_string;
    delete event.request.data;
    delete event.request.headers;
    delete event.request.cookies;
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
  }
  return event;
};

export const sentryOptions = (dsn: string | undefined, environment: string) => ({
  dsn,
  enabled: Boolean(dsn),
  environment,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  enableAutoPerformanceTracing: false,
  attachScreenshot: false,
  attachViewHierarchy: false,
  // Les fils de navigation et HTTP portent des adresses avec jetons.
  maxBreadcrumbs: 0,
  beforeBreadcrumb: () => null,
  beforeSend: scrubSentryEvent,
});
