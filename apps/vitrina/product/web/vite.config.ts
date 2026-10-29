import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Dev-time proxy:
 *   /api    → Vitrina MCP FastAPI (apps/vitrina/product/backend/api)
 *   /agent  → Vitrina agent FastAPI (apps/vitrina/product/backend/agent)
 *
 * Override via env for staging/prod preview runs:
 *   VITRINA_API_URL=https://vitrina.vercel.app/api ...
 *   VITRINA_AGENT_URL=https://vitrina.vercel.app/agent ...
 *
 * Production build assumes `/api/*` and `/agent/*` are served at the
 * same origin (e.g. Vercel rewrites in `vercel.json`).
 *
 * i18n (Lingo.dev Compiler):
 *   Enabled when `LINGO_ENABLED=1` is set at build time (with
 *   `LINGO_DEV_API_KEY` to authorise the managed translation engine).
 *
 *   We opt in per-file via `useDirective: true`: a module is only
 *   transformed if it starts with `"use i18n";`. This scopes
 *   translation cleanly to files we've reviewed and keeps workspace
 *   packages like `@scope/ui` out of Lingo's rewrite path (otherwise
 *   Lingo injects `lingo.dev/react/client` imports into UI components
 *   that don't declare `lingo.dev` as a dependency, breaking the
 *   build).
 *
 *   To localise a page: add `"use i18n";` at the top, run `pnpm dev`,
 *   and Lingo will extract strings into `apps/vitrina/lingo/` and
 *   produce locale variants at build time.
 */
const baseConfig: UserConfig = {
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../public/app',
    emptyOutDir: true,
  },

};

export default defineConfig(baseConfig);
