// Jetons du design system Tartan (cahier des charges, § 9.3 à 9.6 et § 9.14).
// Source unique pour le web et le mobile. Ne pas ajouter de couleur ailleurs.
export const tokens = {
  color: {
    brand: "#C4442B",
    brandStrong: "#9E3320",
    brandTint: "#FBE7E2",
    ink: "#15161A",
    ink2: "#24262C",
    ink3: "#3A3C43",
    muted: "#5E6066",
    mutedOnInk: "#B9BBC0",
    brandOnInk: "#F2A08F",
    bg: "#F2F3F1",
    surface: "#FFFFFF",
    surfaceSunk: "#E6E7E3",
    border: "#E2E3DF",
    white: "#FFFFFF",
    warningTint: "#FCEFD9",
    warningStrong: "#8A4E08",
    status: {
      done: "#1E5FA8",
      partial: "#E08A1E",
      missed: "#C4442B",
      upcoming: "#8C8E94",
    },
  },
  font: {
    display: "BarlowCondensed-Bold",
    title: "BarlowCondensed-SemiBold",
    body: "Barlow-Regular",
    bodyMedium: "Barlow-Medium",
    bodyStrong: "Barlow-SemiBold",
  },
  space: [0, 4, 8, 12, 16, 20, 24, 32, 48, 64],
  radius: { thumb: 10, button: 12, card: 14, block: 16, hero: 20, pill: 999 },
  touch: 44,
  breakpoint: { tablet: 600, desktop: 1024, contentMax: 1440 },
} as const;

export type Tokens = typeof tokens;

export type SessionStatusKey = keyof typeof tokens.color.status;
