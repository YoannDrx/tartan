// Les limites de débit de la connexion, à part du serveur d'authentification : un test peut allumer le limiteur
// (tests/auth-rate-limit.test.ts) et vérifier ces règles-ci, sans les recopier.

// Le limiteur de connexion : désactivable pour les tests de navigateur, jamais sur la vraie production.
export const rateLimitEnabled = (vars: NodeJS.ProcessEnv = process.env): boolean =>
  vars.VERCEL_ENV === "production" || (vars.NODE_ENV === "production" && vars.E2E_DISABLE_RATE_LIMIT !== "true");

// Par adresse IP et par route, sur une minute, comptées en base pour valoir entre instances.
export const authRateLimit = () => ({
  enabled: rateLimitEnabled(),
  storage: "database" as const,
  modelName: "rateLimit",
  window: 60,
  max: 60,
  customRules: {
    "/sign-in/*": { window: 60, max: 10 },
    "/sign-up/*": { window: 60, max: 5 },
    "/magic-link/*": { window: 60, max: 5 },
  },
  // Le renvoi du lien de confirmation (`/send-verification-email`) et la demande de réinitialisation gardent la
  // règle d'origine de la bibliothèque : trois par minute.
});
