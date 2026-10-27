// Workspace lint config. Run with `pnpm lint`.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/generated/**",
      "artifacts/mockup-sandbox/**",
      "artifacts/mindful-companion/src/components/ui/**",
      "generated-artifacts/**",
      "api/**",
      "**/vite.local.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mjs}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["artifacts/mindful-companion/src/**/*.tsx"],
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
  {
    // Vendored provider integration.
    files: ["lib/integrations-openai-ai-server/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    files: ["artifacts/mindful-companion/src/lib/uf30-copy.ts"],
    rules: { "@typescript-eslint/ban-ts-comment": "off" },
  },
);
