import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// BUILD MODE — the safe path off static export.
//
// The live site at gogulf.co is a static export: `npm run build` writes plain
// HTML/CSS/JS to `out/`, which is uploaded to the host. The platform (auth,
// portal, admin, webhooks) cannot run that way — `output: 'export'` supports no
// Route Handlers that read the request, no cookies(), no redirects/headers, no
// proxy.js and no ISR.
//
// Rather than flipping the whole project at once and breaking the live deploy,
// the mode is chosen by an environment variable:
//
//   PLATFORM_MODE unset  -> static export.  IDENTICAL to today's production
//                           build. The existing deploy process is untouched.
//   PLATFORM_MODE=server -> server-capable. Used for local platform work and
//                           for staging.gogulf.co.
//
// Production keeps building static until the Phase 2 cutover is approved, at
// which point the default flips and this block is deleted.
// See docs/MIGRATION-PLAN.md §2–3.
// ---------------------------------------------------------------------------
const isServerMode = process.env.PLATFORM_MODE === "server";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isServerMode ? {} : { output: "export" }),

  // A stray package-lock.json sits in the parent directory, outside this git
  // repository. Turbopack was inferring that as the workspace root and warning
  // on every build. Pinning the root removes the ambiguity.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
