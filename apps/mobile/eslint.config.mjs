import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import tartan from "../web/eslint-rules/index.mjs";

// Les mêmes garde-fous que le web (DESIGN.md) : aucun texte ni couleur en dur dans ce qui s'affiche, plus les règles
// des hooks React. Les écarts d'avant la règle sont gelés dans eslint-suppressions.json : on n'y ajoute rien.
export default [
  { ignores: ["ios/**", "android/**", "node_modules/**", ".expo/**", "dist/**", "**/*.test.ts", "**/*.test.tsx"] },
  {
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { tartan, "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "tartan/no-raw-color": "error",
      "tartan/no-hardcoded-text": "error",
      // Les textes propres au web ne sont pas embarqués dans l'app : la CI ne rejoue pas Maestro quand ils changent.
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "@tartan/i18n/web", message: "Textes réservés au web : utilise @tartan/i18n." }] },
      ],
    },
  },
];
