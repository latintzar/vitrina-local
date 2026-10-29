/**
 * Supabase singleton for Vitrina.
 *
 * Env vars (set in Vercel):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *
 * If either is missing the client runs in "stub" mode — `useAuth()`
 * always reports signed-out and `signInWithOtp` / `signOut` resolve
 * to no-ops. Useful for frontend dev + screenshot previews without
 * a Supabase project.
 */

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;
// Cached session, kept fresh via onAuthStateChange. We cache because
// every parallel call to `supabase.auth.getSession()` serialises on the
// auth-token lock — fanning out N item adds becomes N×~5s of waiting
// when the lock is contended. With this cache, headers can be built
// synchronously and only one listener ever talks to the lock.
let _cachedSession: Session | null = null;
let _sessionPrimed = false;
let _sessionPrimer: Promise<void> | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  const env = (import.meta as any).env ?? {};
  const url = env.VITE_SUPABASE_URL as string | undefined;
  const key = env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  // One-shot session prime + a single subscription that feeds the
  // cache. Subsequent reads are O(1) and never touch the lock.
  _sessionPrimer = _client.auth.getSession().then(({ data }) => {
    _cachedSession = data.session ?? null;
    _sessionPrimed = true;
  }).catch(() => {
    _sessionPrimed = true;
  });
  _client.auth.onAuthStateChange((_event, session) => {
    _cachedSession = session ?? null;
    _sessionPrimed = true;
  });
  return _client;
}

/** Synchronous read of the most recently observed access token, or null. */
export function getCachedAccessToken(): string | null {
  return _cachedSession?.access_token ?? null;
}

/** Synchronous read of the cached session (may be null when signed out). */
export function getCachedSession(): Session | null {
  return _cachedSession;
}

/**
 * Wait until the auth client has reported its initial session at least
 * once. After this resolves, callers can use `getCachedAccessToken()`
 * synchronously without contending on the auth-token lock.
 */
export async function waitForSessionPrime(): Promise<void> {
  if (_sessionPrimed) return;
  if (!_client) getSupabase();
  await _sessionPrimer;
}

export function isAuthConfigured(): boolean {
  return getSupabase() !== null;
}

/**
 * Preview-only auto-auth.
 *
 * Vercel Preview deployments run with `VITE_PREVIEW_AUTO_AUTH=1` plus a
 * canned email/password (Peter's test account) so we can dogfood the
 * authenticated flow without typing creds on every cold load. Production
 * deploys leave these unset; the app then stays anonymous until the user
 * explicitly logs in at the payment or profile gate.
 *
 * Idempotent: if a session is already cached in localStorage we just
 * return it; otherwise we issue one signInWithPassword.
 */
let _autoAuthPromise: Promise<void> | null = null;
export function ensurePreviewAutoAuth(): Promise<void> {
  if (_autoAuthPromise) return _autoAuthPromise;
  _autoAuthPromise = (async () => {
    const env = (import.meta as any).env ?? {};
    if (!env.VITE_PREVIEW_AUTO_AUTH) return;
    const email = env.VITE_PREVIEW_AUTH_EMAIL as string | undefined;
    const password = env.VITE_PREVIEW_AUTH_PASSWORD as string | undefined;
    if (!email || !password) return;
    const sb = getSupabase();
    if (!sb) return;
    try {
      const { data } = await sb.auth.getSession();
      if (data.session?.user?.email === email) return;
      await sb.auth.signInWithPassword({ email, password });
    } catch {
      // Auto-auth is best-effort; keep going as anonymous.
    }
  })();
  return _autoAuthPromise;
}
