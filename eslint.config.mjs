import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".next/**", "node_modules/**", "server/dist/**", "next-env.d.ts"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@next/next": nextPlugin,
      // Without this, the `// eslint-disable-next-line
      // react-hooks/exhaustive-deps` comments scattered around the
      // code (used to suppress the rule on intentional empty-deps
      // effects like initial-load fetches) fail with
      // "Definition for rule 'react-hooks/exhaustive-deps' was
      // not found" — which aborts `next build` during Docker
      // image compilation. We only enable the `exhaustive-deps`
      // rule explicitly and skip the newer strict rules
      // (`set-state-in-effect`, `purity`) because the existing
      // code uses legitimate patterns those rules would flag
      // (e.g. imperative load() in a mount-only useEffect, and
      // Date.now() in render to drive the "X seconds ago" label).
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react-hooks/exhaustive-deps": "error",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
