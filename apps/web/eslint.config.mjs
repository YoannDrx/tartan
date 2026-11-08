import next from "eslint-config-next";

const config = [
  ...next,
  // Le français est plein d'apostrophes : les échapper nuirait à la relecture des textes.
  { rules: { "react/no-unescaped-entities": "off" } },
  { ignores: [".next/**", ".next-e2e/**", "src/generated/**", "playwright-report/**", "test-results/**"] },
];

export default config;
