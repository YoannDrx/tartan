export * from "./jumper";
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
    // La palette vive : les mondes de couleur, l'accent citron et la mascotte (DESIGN.md).
    film: {
      electric: "#2B4DFF",
      electricDeep: "#1E37C2",
      lime: "#C6F432",
      limeDeep: "#AEDB1E",
      sun: "#FFC838",
      sunDeep: "#EFB21C",
      sunLight: "#FFE08A",
      skin: "#E8A87C",
    },
    status: {
      done: "#1E5FA8",
      partial: "#E08A1E",
      missed: "#C4442B",
      upcoming: "#8C8E94",
    },
  },
  // Direction artistique : rouge piste en fond, contenu sur cartes encre (DESIGN.md).
  scene: {
    page: "#C4442B",
    onPage: "#FFFFFF",
    lane: "#FFFFFF",
    card: "#15161A",
    cardRaised: "#24262C",
    cardLine: "#3A3C43",
    controlLine: "#6B6E76",
    text: "#FFFFFF",
    textMuted: "#B9BBC0",
    link: "#C6F432",
    hero: "#F2F3F1",
    onHero: "#15161A",
    onHeroAccent: "#9E3320",
    actionOnPage: "#C6F432",
    onActionOnPage: "#15161A",
    actionOnCard: "#C6F432",
    onActionOnCard: "#15161A",
    status: { done: "#C6F432", partial: "#FFC838", missed: "#FF6B57", upcoming: "#8C8E94" },
    onStatus: "#15161A",
  },
  font: {
    display: "BarlowCondensed-Bold",
    title: "BarlowCondensed-SemiBold",
    body: "Barlow-Regular",
    bodyMedium: "Barlow-Medium",
    bodyStrong: "Barlow-SemiBold",
  },
  space: [0, 4, 8, 12, 16, 20, 24, 32, 48, 64],
  radius: { thumb: 12, button: 14, card: 20, block: 24, hero: 28, pill: 999 },
  touch: 44,
  breakpoint: { tablet: 600, desktop: 1024, contentMax: 1440 },
} as const;

export type Tokens = typeof tokens;

export type SessionStatusKey = keyof typeof tokens.color.status;
