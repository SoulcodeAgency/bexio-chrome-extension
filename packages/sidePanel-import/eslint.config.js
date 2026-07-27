import js from "@eslint/js";
import globals from "globals";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

// Flat-config equivalent of the previous .eslintrc.cjs:
// eslint:recommended + plugin:@typescript-eslint/recommended + plugin:react-hooks/recommended
// + the react-refresh/only-export-components warning, browser globals.
export default [
  js.configs.recommended,
  ...tsPlugin.configs["flat/recommended"],
  reactHooks.configs.flat.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
    },
    plugins: {
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-refresh/only-export-components": "warn",
      // The codebase deliberately uses the `condition && action()` short-circuit idiom;
      // keep the rule but allow that pattern instead of rewriting working code.
      "@typescript-eslint/no-unused-expressions": ["error", { allowShortCircuit: true }],
    },
  },
];
