// ESLint flat config.
//
// Next.js 16 removed the `next lint` command ("Use Biome or ESLint directly.
// `next build` no longer runs linting."), and this project had no ESLint
// config at all — so nothing was being linted. This restores it via the
// ESLint CLI; `npm run lint` calls `eslint .`.
//
// Note on secret exposure: there is no honest lint rule for "this
// NEXT_PUBLIC_* variable holds a secret" — ESLint cannot see the value.
// That control lives in `scripts/check-client-secrets.mjs`, which scans the
// actual built client bundle for real secret values. Run it via
// `npm run check:secrets` after a build.

import next from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "next-env.d.ts",
      "supabase/.temp/**",
      "scripts/**",
    ],
  },

  ...next,

  {
    rules: {
      // The header and footer use plain <img> for the logo. Under the current
      // static export that is deliberate — next/image optimisation is not
      // available with `output: 'export'` and the default loader. Revisited in
      // Phase 2 when the site moves to server rendering.
      "@next/next/no-img-element": "warn",
    },
  },
];

export default config;
