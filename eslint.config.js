import js from "@eslint/js"
import prettier from "eslint-config-prettier/flat"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    // Build output and caches. Flat config ignores are global when the object
    // carries nothing but `ignores`.
    ignores: ["**/dist/**", "**/build/**", "**/coverage/**", "**/.turbo/**", "**/.tsbuildinfo/**", "**/node_modules/**"]
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module"
    },
    rules: {
      // `_`-prefixed bindings are the documented way to say "deliberately
      // unused" — a discarded destructure, an interface-mandated parameter.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],

      // Library code returns typed errors; it does not print. The client and
      // the interstitial are where a user-facing message belongs, and those
      // go through the spec error codes, not the console.
      "no-console": "error",

      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" }
      ],
      "object-shorthand": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "error"
    }
  },

  // Must stay last: switches off every rule Prettier already decides.
  // Formatting is Prettier's job; ESLint only judges correctness here.
  prettier
)
