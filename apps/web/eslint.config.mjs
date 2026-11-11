import next from "eslint-config-next";
import tartan from "./eslint-rules/index.mjs";

const config = [
  ...next,
  // Le français est plein d'apostrophes : les échapper nuirait à la relecture des textes.
  { rules: { "react/no-unescaped-entities": "off" } },
  // Garde-fous de DESIGN.md sur ce qui s'affiche : pages, composants, e-mails.
  {
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}", "emails/**/*.{ts,tsx}"],
    plugins: { tartan },
    rules: {
      "tartan/no-raw-color": "error",
      "tartan/no-default-palette": "error",
      "tartan/no-hardcoded-text": "error",
    },
  },
  // Le catalogue d'essai porte des données fictives, pas des textes du produit.
  { files: ["emails/catalog.tsx"], rules: { "tartan/no-hardcoded-text": "off" } },
  { ignores: [".next/**", ".next-e2e/**", "src/generated/**", "playwright-report/**", "test-results/**"] },
];

export default config;
