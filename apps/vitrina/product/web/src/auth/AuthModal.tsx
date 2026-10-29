import { useState } from 'react';
import { Button, Input, Surface } from '@scope/ui';
import { useAuth } from './useAuth';

function normalizeBgPhone(value: string) {
  const compact = value.replace(/\s+/g, '');
  if (compact.startsWith('+')) return compact;
  if (compact.startsWith('0')) return `+359${compact.slice(1)}`;
  return compact;
}

export function AuthModal({
  open,
  onClose,
  onAuthenticated,
}: {
  open: boolean;
  onClose: () => void;
  onAuthenticated?: () => void;
}) {
  const auth = useAuth();
  const [step, setStep] = useState<'phone' | 'otp' | 'email'>('phone');
  const [phone, setPhone] = useState('+359 ');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function sendPhoneOtp() {
    setBusy(true);
    setError('');
    const res = await auth.signInWithPhone(normalizeBgPhone(phone));
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setStep('otp');
  }

  async function verifyOtp() {
    setBusy(true);
    setError('');
    const res = await auth.verifyPhoneOtp(normalizeBgPhone(phone), otp.trim());
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    onAuthenticated?.();
    onClose();
  }

  async function sendEmailLink() {
    setBusy(true);
    setError('');
    const res = await auth.signInWithEmail(email.trim());
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setError('Check your email for the magic link, then return to finish payment.');
  }

  return (
    <div className="vitrina-auth-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <Surface className="vitrina-auth-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="vitrina-auth-close" onClick={onClose} aria-label="Close auth">
          ×
        </button>
        <p className="vitrina-auth-kicker">Pay securely</p>
        <h2>Sign in only to pay</h2>
        <p className="vitrina-auth-copy">Your anonymous basket and chat transfer automatically after login.</p>

        {step === 'phone' ? (
          <>
            <Input label="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
            <Button onClick={sendPhoneOtp} loading={busy} disabled={!phone.trim()} fullWidth>Send code</Button>
            <button type="button" className="vitrina-auth-link" onClick={() => setStep('email')}>Use email instead</button>
          </>
        ) : step === 'otp' ? (
          <>
            <Input label="SMS code" value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" />
            <Button onClick={verifyOtp} loading={busy} disabled={otp.trim().length < 4} fullWidth>Verify and pay</Button>
            <button type="button" className="vitrina-auth-link" onClick={() => setStep('phone')}>Change phone</button>
          </>
        ) : (
          <>
            <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoFocus />
            <Button onClick={sendEmailLink} loading={busy} disabled={!email.includes('@')} fullWidth>Email magic link</Button>
            <button type="button" className="vitrina-auth-link" onClick={() => setStep('phone')}>Use phone instead</button>
          </>
        )}

        <div className="vitrina-auth-social">
          <Button variant="secondary" onClick={() => void auth.signInWithGoogle()} fullWidth>Continue with Google</Button>
          <Button variant="secondary" onClick={() => void auth.signInWithApple()} fullWidth>Continue with Apple</Button>
        </div>
        {error ? <p className="vitrina-auth-error">{error}</p> : null}
      </Surface>

      <style>{`
        .vitrina-auth-backdrop {
          position: fixed; inset: 0; z-index: 120; display: flex; align-items: flex-end; justify-content: center;
          padding: 14px; background: color-mix(in srgb, var(--color-ink-black) 34%, transparent);
          backdrop-filter: blur(10px);
        }
        .vitrina-auth-modal { position: relative; width: min(440px, 100%); padding: 22px; display: grid; gap: 12px; }
        .vitrina-auth-close {
          position: absolute; top: 10px; right: 10px; width: 34px; height: 34px; border-radius: 999px;
          border: 1px solid var(--color-border); background: var(--color-card); color: var(--color-ink); font: inherit;
        }
        .vitrina-auth-kicker { margin: 0; color: var(--color-ink-light); text-transform: uppercase; letter-spacing: .05em; font-size: .78rem; }
        .vitrina-auth-modal h2 { margin: 0; font-family: var(--font-display); color: var(--color-ink); letter-spacing: -.04em; }
        .vitrina-auth-copy, .vitrina-auth-error { margin: 0; color: var(--color-ink-light); font-size: .92rem; line-height: 1.45; }
        .vitrina-auth-error { color: var(--color-red); }
        .vitrina-auth-link { border: 0; background: transparent; color: var(--color-ink); text-decoration: underline; font: inherit; justify-self: center; }
        .vitrina-auth-social { display: grid; gap: 8px; border-top: 1px solid var(--color-border); padding-top: 12px; }
      `}</style>
    </div>
  );
}
