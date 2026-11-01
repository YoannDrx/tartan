import { ApiError } from "@tartan/api-client";
import { m } from "@tartan/i18n";

// Le message explique quoi faire ; les réponses du serveur sont déjà rédigées pour l'utilisateur.
export const errorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    // Pas d'achat dans l'app (règle Apple) : le message du serveur invite à changer d'offre, celui-ci reste neutre.
    if (error.code === "plan_limit") {
      return error.message === m.billing.limitJoinAthlete ? error.message : m.mobile.errors.planLimit;
    }
    if (error.status === 403 && !error.code) return m.common.forbidden;
    if (error.status === 404) return m.common.notFound;
    if (error.status === 429) return m.errors.rateLimited;
    if (error.status >= 500 && error.code !== "video_disabled") return m.common.genericError;
    return error.message;
  }
  return m.common.genericError;
};
