export type AppVariant = "development" | "preview" | "production";

const PRODUCTION_HOSTS = new Set(["app.tartan.coach", "tartan.coach", "www.tartan.coach"]);

export const parseVariant = (value: string | undefined): AppVariant =>
  value === "preview" || value === "production" ? value : "development";

const hostOf = (url: string): string | undefined => {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
};

// Un essai destructif sur une préversion ne doit jamais atteindre la production.
export const resolveApiUrl = (variant: AppVariant, configured: string | undefined): string => {
  const value = configured?.trim() || undefined;
  if (variant !== "development") {
    if (!value) throw new Error(`EXPO_PUBLIC_API_URL est obligatoire pour la variante ${variant}.`);
    if (!value.startsWith("https://")) {
      throw new Error(`EXPO_PUBLIC_API_URL doit être en HTTPS pour la variante ${variant}.`);
    }
  }
  const apiUrl = value ?? "http://localhost:3000";
  if (variant !== "production" && PRODUCTION_HOSTS.has(hostOf(apiUrl) ?? "")) {
    throw new Error(`La variante ${variant} ne peut pas viser l'API de production.`);
  }
  return apiUrl;
};

// Les liens universels ne concernent que l'app publiée : une préversion ne doit pas capter les vrais liens.
export const universalHostsFor = (variant: AppVariant, hosts: readonly string[]): string[] =>
  variant === "production" ? [...hosts] : [];
