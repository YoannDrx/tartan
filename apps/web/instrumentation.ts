import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";

export const register = () => {
  // Le tracing est désactivé ; évite les hooks ESM non tracés par Next 16/Sentry 11.10.
  Sentry.init({ ...sentryOptions, enableRuntimeChannelInjection: false });
};

export const onRequestError = Sentry.captureRequestError;
