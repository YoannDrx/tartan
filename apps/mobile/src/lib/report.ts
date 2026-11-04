import * as Sentry from "@sentry/react-native";

// Un code technique seulement : ni jeton, ni contenu d'écran, ni donnée de santé.
export const reportTechnical = (code: string, error?: unknown): void => {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? String((error as { status: unknown }).status)
      : null;
  Sentry.captureMessage(code, { level: "warning", tags: status ? { status } : undefined });
};
