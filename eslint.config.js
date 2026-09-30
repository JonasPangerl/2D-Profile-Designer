// Flat ESLint config for the whole workspace.
// The geometry package carries extra restrictions that encode golden rule G4
// (it imports nothing) and G6 (one public API surface).
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", "**/*.d.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": "error",
      eqeqeq: ["error", "always"],
    },
  },
  {
    // G4: the geometry core is pure. No imports outside itself, no globals
    // that only exist in a browser or in Node.
    files: ["packages/geometry/src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "navigator",
        "localStorage",
        "sessionStorage",
        "fetch",
        "process",
        "require",
        "__dirname",
      ],
    },
  },
  {
    // G6: consumers import from the package root, never from a deep path.
    files: ["packages/ui/**/*.ts", "packages/ui/**/*.tsx", "apps/**/*.ts", "apps/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@foil/geometry/*"],
              message:
                "Import from @foil/geometry only. Deep imports break the single public API (golden rule G6).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/tests/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    // The check scripts are Node programs whose whole job is to print and
    // to set an exit code.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly" },
    },
    rules: {
      "no-console": "off",
      "no-undef": "off",
    },
  },
  {
    // A stub signature keeps the Phase 2 boundary visible; its parameter is
    // deliberately unused until the solver exists.
    files: ["packages/solver/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
