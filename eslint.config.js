import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      ".gstack/**",
      "doc/**",
      "server/data/**",
      "prelude_dataset_kit/**",
      "public/**"
    ]
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}", "tests/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node }
    },
    plugins: {
      "react-hooks": reactHooks
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
      "no-unused-vars": "off",
      "no-empty": ["error", { "allowEmptyCatch": true }]
    }
  },
  {
    files: ["*.config.js", "vite.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node }
    }
  },
  {
    files: ["api/**/*.js", "server/**/*.js", "scripts/**/*.{js,mjs}", "shared/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node }
    },
    rules: { "no-unused-vars": "off", "no-empty": ["error", { "allowEmptyCatch": true }] }
  },
  {
    files: ["functions/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.serviceworker }
    },
    rules: { "no-unused-vars": "off", "no-empty": ["error", { "allowEmptyCatch": true }] }
  }
];
