/**
 * AuthGate — inline auth widget for magic-link pages.
 *
 * Three paths:
 *  1. Continue with Google — Supabase OAuth, redirects back to the current URL.
 *  2. Sign in / sign up with email + password — standard Supabase auth.
 *  3. Continue as guest — collects email only; POSTs to the provided
 *     ``onGuestEmail`` callback so the caller can stamp the thread metadata.
 *
 * On success ``onResolved(email, session?)`` is called so the parent page can
 * proceed to the next step (e.g. create Stripe session).
 *
 * No magic-link / OTP login — we want the shopper to stay in-app without
 * bouncing between tabs.
 *
 * Existing in-app auth uses ``AuthSheet``; this component is intentionally
 * separate and styled for the full-page magic-link flow.
 */
import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Button, Input } from '@scope/ui';
import { getSupabase } from './supabaseClient';

export interface AuthGateProps {
  /** Called when auth resolves (signed-in or guest). */
  onResolved: (email: string, session: Session | null) => void;
  /** Optional: slug used to stamp guest email on the backend. */
  guestEmailUrl?: string;
}

type View = 'options' | 'email_password' | 'guest';

export function AuthGate({ onResolved, guestEmailUrl }: AuthGateProps) {
  const [view, setView] = useState<View>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setErr(null);
    const sb = getSupabase();
    if (!sb) { setErr('Auth not configured'); return; }
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
    if (error) setErr(error.message);
  }

  async function handleEmailPassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const sb = getSupabase();
    if (!sb) { setErr('Auth not configured'); setLoading(false); return; }
    // Try sign-in first; if not found, sign up.
    const signInResult = await sb.auth.signInWithPassword({ email, password });
    let session = signInResult.data?.session ?? null;
    let authError = signInResult.error;
    if (authError?.message?.toLowerCase().includes('invalid login')) {
      const signUpResult = await sb.auth.signUp({ email, password });
      session = signUpResult.data?.session ?? null;
      authError = signUpResult.error ?? null;
    }
    setLoading(false);
    if (authError) { setErr(authError.message); return; }
    onResolved(email, session);
  }

  async function handleGuest(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!guestEmail || !guestEmail.includes('@')) {
      setErr('Enter a valid email');
      return;
    }
    if (guestEmailUrl) {
      setLoading(true);
      try {
        const res = await fetch(guestEmailUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: guestEmail }),
        });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setErr(j.error || `Error (${res.status})`);
          setLoading(false);
          return;
        }
      } catch (ex) {
        setErr(ex instanceof Error ? ex.message : 'Network error');
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    onResolved(guestEmail, null);
  }

  return (
    <div className="vitrina-auth-gate">
      {err ? <p className="vitrina-auth-gate__err" role="alert">{err}</p> : null}

      {view === 'options' && (
        <>
          <h2 className="vitrina-auth-gate__title">Almost there</h2>
          <p className="vitrina-auth-gate__sub">Sign in to save your order, or continue as guest.</p>
          <div className="vitrina-auth-gate__actions">
            <Button type="button" onClick={handleGoogle}>
              Continue with Google
            </Button>
            <Button type="button" onClick={() => { setErr(null); setView('email_password'); }}>
              Sign in with email
            </Button>
            <button
              type="button"
              className="vitrina-auth-gate__ghost"
              onClick={() => { setErr(null); setView('guest'); }}
            >
              Continue as guest
            </button>
          </div>
        </>
      )}

      {view === 'email_password' && (
        <form onSubmit={handleEmailPassword} className="vitrina-auth-gate__form">
          <h2 className="vitrina-auth-gate__title">Sign in or create account</h2>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Please wait…' : 'Continue'}
          </Button>
          <button
            type="button"
            className="vitrina-auth-gate__ghost"
            onClick={() => { setErr(null); setView('options'); }}
          >
            ← Back
          </button>
        </form>
      )}

      {view === 'guest' && (
        <form onSubmit={handleGuest} className="vitrina-auth-gate__form">
          <h2 className="vitrina-auth-gate__title">Continue as guest</h2>
          <p className="vitrina-auth-gate__sub">We'll use this to send your receipt.</p>
          <Input
            type="email"
            placeholder="Email address"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            required
            autoFocus
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Please wait…' : 'Continue to checkout'}
          </Button>
          <button
            type="button"
            className="vitrina-auth-gate__ghost"
            onClick={() => { setErr(null); setView('options'); }}
          >
            ← Back
          </button>
        </form>
      )}

      <style>{`
        .vitrina-auth-gate {
          width: min(420px, 100%);
          margin: 0 auto;
          padding: 28px 20px;
          text-align: center;
        }
        .vitrina-auth-gate__title {
          margin: 0 0 8px;
          font-size: 1.2rem;
          font-weight: 600;
        }
        .vitrina-auth-gate__sub {
          margin: 0 0 20px;
          font-size: 0.9rem;
          color: var(--mg-muted, #a8a29e);
        }
        .vitrina-auth-gate__actions,
        .vitrina-auth-gate__form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .vitrina-auth-gate__err {
          margin: 0 0 12px;
          padding: 10px 14px;
          background: rgba(127,29,29,0.2);
          border: 1px solid rgba(127,29,29,0.5);
          border-radius: 8px;
          font-size: 0.875rem;
          color: #fca5a5;
          text-align: left;
        }
        .vitrina-auth-gate__ghost {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--mg-muted, #a8a29e);
          font-size: 0.85rem;
          padding: 4px;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
      `}</style>
    </div>
  );
}
