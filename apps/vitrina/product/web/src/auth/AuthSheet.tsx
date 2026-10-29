/**
 * AuthSheet — shared Vitrina sign-in dialog (shoppers, merchants, checkout).
 *
 * Three modes:
 *   1. choose       Google + email field + "Email me a magic link" button.
 *                   If a `?email=` query param is present we pre-fill it
 *                   (so browser password managers can tie the saved
 *                   credential to the right address). Email is readOnly
 *                   in that case so it can't drift.
 *   2. password     Email + password fields + "Sign in" button.
 *                   Reachable via the "I have a password" link below.
 *   3. sent         "Check your email" confirmation.
 *
 * Centred card, real Google logo, terracotta primary, proper Input.
 * Copy is supplied via `useMerchantLang` (BG/EN strings) with an
 * optional `intro` override.
 */
import { useState, useEffect } from 'react';
import { Input } from '@scope/ui';
import { useAuth } from './useAuth';
import { getSupabase } from './supabaseClient';
import { useMerchantLang } from '../merchants/merchantLang';

// ── Google icon (official 4-colour SVG) ──────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.705 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

// ── Envelope for step 2 ──────────────────────────────────────────────────────

function EnvelopeIllustration() {
  return (
    <svg width="120" height="90" viewBox="0 0 160 120" fill="none" aria-hidden="true">
      <ellipse cx="80" cy="116" rx="52" ry="4" fill="rgba(42,36,32,0.08)"/>
      <rect x="8" y="24" width="144" height="88" rx="12" fill="#FAF8F4" stroke="rgba(42,36,32,0.12)" strokeWidth="1.5"/>
      <path d="M8 40 L80 80 L152 40 L152 24 Q152 24 140 24 L80 66 L20 24 Q8 24 8 24 Z" fill="#f0dcc8"/>
      <circle cx="80" cy="78" r="24" fill="#f0c4ae"/>
      <circle cx="80" cy="78" r="17" fill="#DA654D"/>
      <text x="80" y="84" textAnchor="middle" fontSize="16" fontFamily="Georgia,serif" fontStyle="italic" fill="#FAF8F4">L</text>
    </svg>
  );
}

export function AuthSheet({
  open,
  onClose,
  intro,
  onAuthenticated,
}: {
  open: boolean;
  onClose: () => void;
  intro?: string;
  /** Called immediately after a successful in-modal sign-in (password).
   *  Google / magic-link flows do a full OAuth redirect so this won't
   *  fire — the caller should re-check auth state on mount. */
  onAuthenticated?: () => void;
  /** @deprecated kept for call-site compatibility */
  titleBg?: string;
  /** @deprecated kept for call-site compatibility */
  titleEn?: string;
}) {
  const auth = useAuth();
  const { t } = useMerchantLang();

  // Read ?email= once on open. If present, pre-fill (and lock) the
  // email field so password managers tie credentials to the right address.
  const [prefilledEmail, setPrefilledEmail] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'choose' | 'password'>('choose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const e = params.get('email');
    if (e && e.includes('@')) {
      setPrefilledEmail(e);
      setEmail(e);
    }
  }, [open]);

  if (!open) return null;

  async function handleContinue() {
    if (!email.includes('@')) { setError(t.authEmailInvalid); return; }
    setBusy(true);
    setError('');
    const res = await auth.signInWithEmail(email.trim());
    setBusy(false);
    if ((res as { error?: { message: string } | null }).error) {
      setError(((res as { error: { message: string } }).error.message) || 'Could not send link.');
      return;
    }
    setSent(true);
  }

  async function handlePasswordSignIn() {
    if (!email.includes('@') || !password) { setError(t.authEmailInvalid); return; }
    setBusy(true);
    setError('');
    try {
      const supa = getSupabase();
      if (!supa) throw new Error('auth not configured');
      const { error: err } = await supa.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) throw new Error(err.message);
      onClose();
      if (onAuthenticated) {
        onAuthenticated();
      } else if (typeof window !== 'undefined') {
        window.location.assign('/merchants/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError('');
    await auth.signInWithGoogle();
    setBusy(false);
  }

  function reset() { setSent(false); setError(''); if (!prefilledEmail) setEmail(''); }

  // ── Step 2: link sent ────────────────────────────────────────────────────
  if (sent) {
    return (
      <div className="mauth-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="mauth-card mauth-card--sent" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="mauth-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
          <div className="mauth-envelope">
            <EnvelopeIllustration />
          </div>
          <h2 className="mauth-title mauth-title--center">{t.authCheckEmail}</h2>
          <p className="mauth-copy mauth-copy--center">{t.authLinkSent}</p>
          <p className="mauth-email-badge">{email}</p>
          <button type="button" className="mauth-ghost" onClick={reset}>{t.authResend}</button>
        </div>
        <MAuthStyles />
      </div>
    );
  }

  // ── Method picker ────────────────────────────────────────────────────────
  return (
    <div className="mauth-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="mauth-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="mauth-close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>

        <p className="mauth-kicker">{t.authKicker}</p>
        <h2 className="mauth-title">{t.authTitle}</h2>
        <p className="mauth-copy">{intro || t.authCopy}</p>

        <div className="mauth-body">
          <button
            type="button"
            className="mauth-google"
            onClick={handleGoogle}
            disabled={busy}
          >
            <GoogleIcon />
            <span>{t.authGoogle}</span>
          </button>

          <div className="mauth-divider">
            <span>{t.authOr}</span>
          </div>

          <Input
            label={t.authEmailLabel}
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && void (mode === 'password' ? handlePasswordSignIn() : handleContinue())}
            type="email"
            autoComplete="email"
            inputMode="email"
            className="!rounded-[6px]"
            readOnly={!!prefilledEmail}
          />

          {mode === 'password' && (
            <Input
              label={t.setupAccessPasswordLabel}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && void handlePasswordSignIn()}
              type="password"
              autoComplete="current-password"
              className="!rounded-[6px]"
              autoFocus
            />
          )}

          {error ? <p className="mauth-err">{error}</p> : null}

          {mode === 'password' ? (
            <button
              type="button"
              className="mauth-primary"
              onClick={() => void handlePasswordSignIn()}
              disabled={busy || !email.includes('@') || !password}
            >
              {busy ? t.authSending : t.authContinue}
            </button>
          ) : (
            <button
              type="button"
              className="mauth-primary"
              onClick={() => void handleContinue()}
              disabled={busy || !email.includes('@')}
            >
              {busy ? t.authSending : t.authSendLink}
            </button>
          )}

          <button
            type="button"
            className="mauth-ghost"
            onClick={() => { setMode((m) => (m === 'password' ? 'choose' : 'password')); setError(''); }}
          >
            {mode === 'password' ? '← Use a magic link instead' : 'I have a password'}
          </button>
        </div>
      </div>
      <MAuthStyles />
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function MAuthStyles() {
  return (
    <style>{`
      .mauth-backdrop {
        position: fixed;
        inset: 0;
        z-index: 200;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(28, 17, 16, 0.56);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }
      .mauth-card {
        position: relative;
        width: min(400px, 100%);
        padding: 28px 24px 24px;
        background: #FAF8F4;
        border: 1px solid rgba(42, 36, 32, 0.1);
        border-radius: 6px;
        box-shadow:
          0 24px 64px rgba(0, 0, 0, 0.22),
          0 4px 16px rgba(0, 0, 0, 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.7);
        display: grid;
        gap: 10px;
      }
      .mauth-card--sent {
        text-align: center;
        padding: 36px 28px 28px;
      }
      .mauth-close {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 32px;
        height: 32px;
        border-radius: 999px;
        border: 1px solid rgba(42, 36, 32, 0.14);
        background: rgba(42, 36, 32, 0.05);
        color: rgba(42, 36, 32, 0.7);
        font: inherit;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 120ms;
      }
      .mauth-close:hover { background: rgba(42, 36, 32, 0.1); color: #2a2420; }
      .mauth-kicker {
        margin: 0;
        color: rgba(42, 36, 32, 0.45);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.72rem;
        font-weight: 500;
      }
      .mauth-title {
        margin: 0;
        font-family: var(--font-display, Georgia, serif);
        font-size: 1.55rem;
        font-weight: 700;
        letter-spacing: -0.03em;
        line-height: 1.1;
        color: #2a2420;
      }
      .mauth-title--center { text-align: center; font-size: 1.35rem; }
      .mauth-copy {
        margin: 0;
        color: rgba(42, 36, 32, 0.6);
        font-size: 0.91rem;
        line-height: 1.5;
      }
      .mauth-copy--center { text-align: center; }
      .mauth-body { display: grid; gap: 10px; margin-top: 6px; }
      .mauth-google {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        padding: 13px 20px;
        background: #fff;
        border: 1px solid rgba(42, 36, 32, 0.18);
        border-radius: 6px;
        font: inherit;
        font-size: 0.97rem;
        font-weight: 600;
        color: #2a2420;
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.6) inset;
        transition: background 120ms, box-shadow 120ms, transform 120ms;
      }
      .mauth-google:hover { background: #f9f9f9; box-shadow: 0 2px 6px rgba(0,0,0,0.12); }
      .mauth-google:active { transform: scale(0.98); }
      .mauth-google:disabled { opacity: 0.6; cursor: default; }
      .mauth-divider {
        display: flex;
        align-items: center;
        gap: 12px;
        color: rgba(42, 36, 32, 0.35);
        font-size: 0.8rem;
      }
      .mauth-divider::before,
      .mauth-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: rgba(42, 36, 32, 0.12);
      }
      .mauth-primary {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 14px 20px;
        background: #DA654D;
        border: 0;
        border-radius: 6px;
        font: inherit;
        font-size: 0.97rem;
        font-weight: 700;
        color: #FAF8F4;
        cursor: pointer;
        box-shadow: 0 6px 20px -8px rgba(218, 101, 77, 0.6);
        transition: background 120ms, box-shadow 120ms, transform 120ms;
        letter-spacing: 0.01em;
      }
      .mauth-primary:hover { background: #c95940; box-shadow: 0 8px 24px -8px rgba(218, 101, 77, 0.7); }
      .mauth-primary:active { transform: scale(0.98); }
      .mauth-primary:disabled { opacity: 0.42; cursor: default; transform: none; box-shadow: none; }
      .mauth-err {
        margin: 0;
        color: #b3261e;
        font-size: 0.86rem;
        line-height: 1.4;
      }
      .mauth-envelope {
        display: flex;
        justify-content: center;
        margin-bottom: 4px;
      }
      .mauth-email-badge {
        margin: 0;
        font-weight: 600;
        color: #2a2420;
        font-size: 0.95rem;
        text-align: center;
      }
      .mauth-ghost {
        border: 0;
        background: transparent;
        color: rgba(42, 36, 32, 0.5);
        font: inherit;
        font-size: 0.86rem;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
        margin-top: 4px;
        padding: 4px 0;
      }
      .mauth-ghost:hover { color: #2a2420; }

      .mauth-card label {
        font-size: 0.78rem;
        font-weight: 500;
        letter-spacing: 0.01em;
        color: rgba(42, 36, 32, 0.55);
        margin-bottom: 4px;
      }
      .mauth-card input[type='email'],
      .mauth-card input[type='password'],
      .mauth-card input[type='text'] {
        width: 100%;
        padding: 13px 14px;
        background: #FFFCF6;
        border: 1px solid rgba(42, 36, 32, 0.14);
        border-radius: 6px;
        font: inherit;
        font-size: 0.97rem;
        color: #2a2420;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), inset 0 0 0 1px rgba(255,255,255,0.4);
        transition: border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
        outline: 0;
      }
      .mauth-card input::placeholder { color: rgba(42, 36, 32, 0.32); }
      .mauth-card input:hover {
        background: #FFFEFA;
        border-color: rgba(42, 36, 32, 0.22);
      }
      .mauth-card input:focus,
      .mauth-card input:focus-visible {
        border-color: #DA654D;
        background: #fff;
        box-shadow: 0 0 0 3px rgba(218, 101, 77, 0.18), inset 0 1px 0 rgba(255,255,255,0.8);
      }
      .mauth-card input[readonly] {
        background: rgba(42, 36, 32, 0.04);
        color: rgba(42, 36, 32, 0.7);
      }
    `}</style>
  );
}
