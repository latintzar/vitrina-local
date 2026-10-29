import { useEffect, useState } from 'react';
import { migrateToSupabase } from '../cart/useCart';
import { getSupabase } from './supabaseClient';

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  initials: string;
}

function toUser(supaUser: { id: string; email?: string; user_metadata?: { name?: string; full_name?: string } } | null): AuthUser | null {
  if (!supaUser) return null;
  const name =
    supaUser.user_metadata?.full_name ||
    supaUser.user_metadata?.name ||
    supaUser.email?.split('@')[0] ||
    'you';
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '•';
  return { id: supaUser.id, email: supaUser.email, name, initials };
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supa = getSupabase();
    if (!supa) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    supa.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUser(toUser(data.user as any));
      setLoading(false);
    });
    const { data: sub } = supa.auth.onAuthStateChange((_event, session) => {
      const next = toUser((session?.user as any) ?? null);
      setUser(next);
      if (next) void migrateToSupabase(next.id);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signInWithEmail(email: string) {
    const supa = getSupabase();
    if (!supa) return { error: new Error('auth not configured') };
    const redirectTo = window.location.origin;

    // Prefer the branded magic-link path: backend mints the link via
    // Supabase admin API, then sends a Vitrina-styled email through
    // Resend (see `apps/vitrina/product/backend/api/routes/auth_emails.py`).
    // We fall back to Supabase's built-in `signInWithOtp` whenever the
    // backend returns `{fallback: true}` or fails outright, so a misconfig
    // (missing service-role key, Resend down) never blocks sign-in.
    const apiBase = ((import.meta as any).env?.VITE_VITRINA_API_URL || '/api').replace(/\/$/, '');
    const lang = (typeof document !== 'undefined' && document.documentElement.lang) || 'bg';
    try {
      const res = await fetch(`${apiBase}/auth/send-magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirect_to: redirectTo, lang }),
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body?.ok) return { data: { user: null, session: null }, error: null };
      }
    } catch {
      /* fall through to Supabase OTP */
    }
    return supa.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  }

  async function signInWithPhone(phone: string) {
    const supa = getSupabase();
    if (!supa) return { error: new Error('auth not configured') };
    return supa.auth.signInWithOtp({ phone });
  }

  async function verifyPhoneOtp(phone: string, token: string) {
    const supa = getSupabase();
    if (!supa) return { error: new Error('auth not configured') };
    return supa.auth.verifyOtp({ phone, token, type: 'sms' });
  }

  async function signInWithGoogle() {
    const supa = getSupabase();
    if (!supa) return { error: new Error('auth not configured') };
    return supa.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  }

  async function signInWithApple() {
    const supa = getSupabase();
    if (!supa) return { error: new Error('auth not configured') };
    return supa.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: window.location.origin } });
  }

  async function signOut() {
    const supa = getSupabase();
    if (!supa) return;
    await supa.auth.signOut();
  }

  return {
    user,
    loading,
    signInWithEmail,
    signInWithPhone,
    verifyPhoneOtp,
    signInWithGoogle,
    signInWithApple,
    signOut,
    configured: !!getSupabase(),
  };
}
