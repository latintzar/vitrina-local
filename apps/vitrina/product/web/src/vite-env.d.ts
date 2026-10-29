/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_VITRINA_API_URL?: string;
  readonly VITE_VITRINA_AGENT_URL?: string;
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_POSTHOG_KEY?: string;
  /**
   * Preview-only auto-auth. When all three are set (typically via Vercel's
   * "Preview" environment scope) the web app silently signs in as the
   * given Supabase user on cold load so Peter can beeline through the
   * flow without typing credentials. Production deploys leave these
   * unset and require explicit login at the payment / profile gate.
   */
  readonly VITE_PREVIEW_AUTO_AUTH?: string;
  readonly VITE_PREVIEW_AUTH_EMAIL?: string;
  readonly VITE_PREVIEW_AUTH_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
