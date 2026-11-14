export * from "./jumper";
export * from "./motion";
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
      // Les sautoirs de hauteur et de perche, comme ceux des stades : corps bleu, dessus rouge, liseré blanc.
      matBlue: "#1E4FBF",
      matRed: "#E0242D",
    },
    // Le groupe des six athlètes : quatre teints et trois couleurs de cheveux (DESIGN.md, « Le groupe »).
    // Chaque teinte se distingue de la piste, de l'encre et de la craie : `tests/athlete-colors.test.ts`.
    athlete: {
      tone: { light: "#EDC29C", peach: "#E8A87C", tan: "#B5804E", deep: "#6E4330" },
      hair: { brown: "#5A3A26", chestnut: "#7A4E2E", blond: "#DDAE4C" },
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
  // Espaces de travail V1.1 : mêmes rôles sur le web et le natif.
  work: {
    page: "#F2F3F1",
    surface: "#FFFFFF",
    raised: "#E6E7E3",
    text: "#15161A",
    muted: "#5E6066",
    border: "#E2E3DF",
    controlLine: "#5E6066",
    action: "#C4442B",
    onAction: "#FFFFFF",
    actionHover: "#9E3320",
    selection: "#FBE7E2",
    onSelection: "#9E3320",
    link: "#9E3320",
    status: { done: "#1E5FA8", partial: "#8A4E08", missed: "#9E3320", upcoming: "#5E6066" },
    onStatus: "#FFFFFF",
  },
  // Même rôles que `work`, pour le thème sombre choisi par l'utilisateur.
  workDark: {
    page: "#15161A",
    surface: "#24262C",
    raised: "#3A3C43",
    text: "#FFFFFF",
    muted: "#B9BBC0",
    border: "#3A3C43",
    controlLine: "#8C8E94",
    action: "#C6F432",
    onAction: "#15161A",
    actionHover: "#AEDB1E",
    selection: "#3A3C43",
    onSelection: "#C6F432",
    link: "#C6F432",
    status: { done: "#C6F432", partial: "#FFC838", missed: "#FF6B57", upcoming: "#B9BBC0" },
    onStatus: "#15161A",
  },
  // Thème par défaut : la piste en fond, le contenu sur cartes encre, l'action citron.
  workTartan: {
    page: "#C4442B",
    surface: "#15161A",
    raised: "#24262C",
    text: "#FFFFFF",
    muted: "#B9BBC0",
    border: "#3A3C43",
    controlLine: "#8C8E94",
    action: "#C6F432",
    onAction: "#15161A",
    actionHover: "#AEDB1E",
    selection: "#3A3C43",
    onSelection: "#C6F432",
    link: "#C6F432",
    status: { done: "#C6F432", partial: "#FFC838", missed: "#FF6B57", upcoming: "#B9BBC0" },
    onStatus: "#15161A",
  },
  // Le bandeau piste : en tête de chaque écran de travail, dans tous les thèmes.
  band: {
    background: "#C4442B",
    deep: "#9E3320",
    text: "#FFFFFF",
    lane: "#FFFFFF",
    action: "#C6F432",
    onAction: "#15161A",
    actionHover: "#AEDB1E",
  },
  activityDark: {
    strength: { background: "#3A3C43", text: "#FFFFFF" },
    plyo: { background: "#3A2C55", text: "#D9C8F5" },
    running: { background: "#1C3552", text: "#B5D3F5" },
    stairs: { background: "#4A3312", text: "#F7D29A" },
    cones: { background: "#473B0E", text: "#F5DE85" },
    mobility: { background: "#1C3F2F", text: "#B0E3C6" },
    jump: { background: "#5A281D", text: "#F9C0B2" },
  },
  activity: {
    strength: { background: "#E6E7E3", text: "#15161A" },
    plyo: { background: "#F0EBF8", text: "#62419A" },
    running: { background: "#E8F0FA", text: "#1E5FA8" },
    stairs: { background: "#FCEFD9", text: "#8A4E08" },
    cones: { background: "#FFF3CC", text: "#6B5100" },
    mobility: { background: "#E8F3EC", text: "#246A4B" },
    jump: { background: "#FBE7E2", text: "#9E3320" },
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

// Rôles du constructeur : mêmes palettes sémantiques dans les trois thèmes.
export const sequenceRoles = {
  preparation: "mobility",
  force: "strength",
  speed: "plyo",
  recovery: "running",
  repeat: "cones",
} as const;
