export const THEME_COOKIE = "tartan-theme";
export const themePreferences = ["tartan", "system", "light", "dark"] as const;
export type ThemePreference = (typeof themePreferences)[number];

// Sans choix enregistré, ou avec une valeur inconnue, l'application garde sa couleur : la piste et les cartes encre.
export const themePreference = (value: string | undefined): ThemePreference =>
  themePreferences.find((theme) => theme === value) ?? "tartan";

const YEAR = 60 * 60 * 24 * 365;

// Le cookie sert au prochain rendu serveur ; l'attribut applique le choix tout de suite.
export const applyThemePreference = (theme: ThemePreference) => {
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${YEAR}; SameSite=Lax`;
  document.querySelector("[data-theme]")?.setAttribute("data-theme", theme);
};
