export const THEME_COOKIE = "tartan-theme";
export const themePreferences = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof themePreferences)[number];

// Une valeur inconnue dans le cookie revient au réglage de l'appareil.
export const themePreference = (value: string | undefined): ThemePreference =>
  themePreferences.find((theme) => theme === value) ?? "system";

const YEAR = 60 * 60 * 24 * 365;

// Le cookie sert au prochain rendu serveur ; l'attribut applique le choix tout de suite.
export const applyThemePreference = (theme: ThemePreference) => {
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${YEAR}; SameSite=Lax`;
  document.querySelector("[data-theme]")?.setAttribute("data-theme", theme);
};
