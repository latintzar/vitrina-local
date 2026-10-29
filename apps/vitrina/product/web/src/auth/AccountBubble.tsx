/**
 * AccountBubble — bottom-left 6px rounded square showing initials
 * (signed in) or a generic auth prompt (signed out). Matches the
 * pattern in ChatGPT's sidebar but themed for Vitrina (Dijon accent
 * ring when signed in).
 */

import { useState } from 'react';
import { Button, Input, Surface } from '@scope/ui';
import { useAuth } from './useAuth';

export function AccountBubble() {
  const { user, signInWithEmail, signInWithGoogle, signOut, configured } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  function togglePanel() {
    setOpen((v) => !v);
    setSent(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={togglePanel}
        aria-label={user ? `account menu (${user.name})` : 'sign in'}
        className={[
          'h-10 w-10 rounded-[6px] flex items-center justify-center',
          'text-sm font-semibold select-none transition-colors',
          user
            ? 'bg-[var(--color-dijon)] text-[var(--color-ink-black)] shadow-sm hover:bg-[var(--color-dijon-dark)]'
            : 'bg-[var(--color-card)] text-[var(--color-ink-light)] border border-[var(--color-border)] hover:border-[var(--color-sky)]',
        ].join(' ')}
      >
        {user ? user.initials : '↗'}
      </button>

      {open && (
        <div className="absolute bottom-12 left-0 z-50 w-72">
          <Surface className="p-4 flex flex-col gap-3">
            {user ? (
              <>
                <div className="text-sm text-[var(--color-ink)]">
                  Signed in as <strong>{user.name}</strong>
                </div>
                {user.email && (
                  <div className="text-xs text-[var(--color-ink-light)] truncate">{user.email}</div>
                )}
                <Button
                  onClick={async () => {
                    await signOut();
                    setOpen(false);
                  }}
                >
                  Sign out
                </Button>
              </>
            ) : !configured ? (
              <div className="text-sm text-[var(--color-ink-light)]">
                Auth is not configured yet. Set <code>VITE_SUPABASE_URL</code> and
                <code>VITE_SUPABASE_ANON_KEY</code> to enable sign-in.
              </div>
            ) : sent ? (
              <div className="text-sm text-[var(--color-ink)]">
                Magic link sent — check your email.
              </div>
            ) : (
              <>
                <div className="text-sm font-semibold text-[var(--color-ink)]">
                  Sign in to add to your basket
                </div>
                <Button onClick={() => signInWithGoogle()}>Continue with Google</Button>
                <div className="text-xs text-[var(--color-stone)] text-center">or</div>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button
                  onClick={async () => {
                    const { error } = await signInWithEmail(email);
                    if (!error) setSent(true);
                  }}
                  disabled={!email.includes('@')}
                >
                  Email me a magic link
                </Button>
              </>
            )}
          </Surface>
        </div>
      )}
    </div>
  );
}
