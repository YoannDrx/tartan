// Filtre minimal exigé pour un contenu d'utilisateurs (App Store 1.2) : il complète le signalement, sans le remplacer.
const BLOCKED_WORDS = [
  "connard",
  "connasse",
  "encule",
  "enculee",
  "salope",
  "pute",
  "nazi",
  "negre",
  "bougnoule",
  "youpin",
  "pede",
  "tapette",
  "fuck",
  "nigger",
];

const normalize = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export const containsBlockedWord = (text: string): boolean => {
  const words = normalize(text).split(/[^a-z0-9]+/);
  return words.some((word) => BLOCKED_WORDS.includes(word));
};
