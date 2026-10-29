/**
 * Channel-agnostic checkout magic-link page — vitrina.bg/checkout?s=…
 *
 * Flow:
 *   1. Resolve slug → basket summary (GET /agent/v1/magic/checkout/lookup)
 *   2. Show basket review (shop names, items, total)
 *   3. "Continue to checkout" → inline AuthGate
 *   4. On auth resolved → POST /agent/v1/magic/checkout/session → client_secret
 *   5. Mount Stripe EmbeddedCheckout iframe
 *   6. On Stripe success → show confirmation
 *
 * Works for any channel — no IG-specific logic here.
 */
import { useEffect, useState } from 'react';

import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import type { Session } from '@supabase/supabase-js';
import { Button, Surface } from '@scope/ui';
import { AuthGate } from '../auth/AuthGate';

const stripePromise = Promise.resolve(null);

function agentBase(): string {
  return import.meta.env.VITE_VITRINA_AGENT_URL || '/agent';
}

/** Map agent API error codes to shopper-readable copy (never raw snake_case in UI). */
function formatMagicCheckoutError(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'not_found_or_expired':
      return (
        'This basket link has expired, was already used after a successful payment, ' +
        'or the code was incomplete. Open the newest link from chat, or ask for a fresh one.'
      );
    case 'shop_closed':
      return 'A shop in this basket is closed for pickup right now. Go back to chat to adjust the time or shops.';
    case 'server_misconfigured':
      return 'Checkout is temporarily unavailable. Try again in a few minutes.';
    case 'stripe_failed':
      return 'Payment setup failed. Go back to chat and ask for a new checkout link.';
    default:
      if (code && /^[a-z0-9_]+$/.test(code)) {
        return fallback;
      }
      return code || fallback;
  }
}

interface LookupResult {
  cart_ids: string[];
  cart_key: string;
  thread_id: string;
  slot: Record<string, unknown> | null;
  shops: Array<{ id: string; name: string; item_count: number }>;
  total_eur: number;
}

type Phase = 'loading' | 'review' | 'auth' | 'creating' | 'paying' | 'done' | 'error';

export default function CheckoutPage() {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const slug = params.get('s') || '';

  const [phase, setPhase] = useState<Phase>('loading');
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [resolvedEmail, setResolvedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setPhase('error'); setLookupErr('No checkout link found.'); return; }
    (async () => {
      try {
        const res = await fetch(
          `${agentBase()}/v1/magic/checkout/lookup?s=${encodeURIComponent(slug)}`,
        );
        const j = (await res.json().catch(() => ({}))) as LookupResult & { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setLookupErr(
            formatMagicCheckoutError(
              j.error,
              res.status === 404
                ? 'We could not load this basket.'
                : `Could not load basket (${res.status}).`,
            ),
          );
          setPhase('error');
          return;
        }
        setLookup(j);
        setPhase('review');
      } catch {
        setLookupErr('Network error — check your connection.');
        setPhase('error');
      }
    })();
  }, [slug]);

  async function onAuthResolved(email: string, _session: Session | null) {
    setResolvedEmail(email);
    setErrMsg(null);
    setPhase('creating');
    try {
      const res = await fetch(`${agentBase()}/v1/magic/checkout/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, email }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; client_secret?: string; error?: string };
      if (!res.ok || !j.ok || !j.client_secret) {
        setErrMsg(
          formatMagicCheckoutError(
            j.error,
            `Could not start payment (${res.status}). Ask in chat for a new checkout link.`,
          ),
        );
        setPhase('error');
        return;
      }
      setClientSecret(j.client_secret);
      setPhase('paying');
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Network error');
      setPhase('error');
    }
  }

  if (!slug) {
    return (
      <main className="vitrina-magic-bare vitrina-magic-dark">
        <Surface className="vitrina-magic-card">
          <p className="vitrina-magic-kicker">Invalid link</p>
          <h1>Open the checkout link from your chat.</h1>
        </Surface>
        <style>{css}</style>
      </main>
    );
  }

  if (phase === 'loading') {
    return (
      <main className="vitrina-magic-bare vitrina-magic-dark">
        <p className="vitrina-magic-status">Loading your basket…</p>
        <p className="vitrina-magic-status vitrina-magic-status--sub">Checkout only — your saved shops and chat stay in the app.</p>
        <style>{css}</style>
      </main>
    );
  }

  if (phase === 'error') {
    return (
      <main className="vitrina-magic-bare vitrina-magic-dark">
        <Surface className="vitrina-magic-card">
          <p className="vitrina-magic-kicker">Basket link</p>
          <h1>{lookupErr || errMsg || 'This checkout link is no longer valid.'}</h1>
          <p className="vitrina-magic-hint">Go back to chat and ask for a new checkout link.</p>
        </Surface>
        <style>{css}</style>
      </main>
    );
  }

  if (phase === 'paying' && clientSecret) {
    return (
      <main className="vitrina-magic-dark vitrina-checkout-magic">
        <header className="vitrina-checkout-magic__header">
          <h1>Complete your order</h1>
          {resolvedEmail && (
            <p className="vitrina-checkout-magic__email">{resolvedEmail}</p>
          )}
        </header>
        <div className="vitrina-checkout-magic__stripe">
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{
              clientSecret,
              onComplete: () => setPhase('done'),
            }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
        <style>{css}</style>
      </main>
    );
  }

  if (phase === 'done') {
    return (
      <main className="vitrina-magic-bare vitrina-magic-dark">
        <Surface className="vitrina-magic-card vitrina-magic-card--done">
          <p className="vitrina-magic-kicker">Order placed</p>
          <h1>Payment received — see you at pickup!</h1>
          <p className="vitrina-magic-hint">
            You can ask about your order anytime in the chat where you received this link.
          </p>
          <div style={{ marginTop: 16 }}>
            <Button type="button" onClick={() => window.close()}>
              Close
            </Button>
          </div>
        </Surface>
        <style>{css}</style>
      </main>
    );
  }

  if (phase === 'auth') {
    return (
      <main className="vitrina-magic-dark vitrina-checkout-magic">
        <AuthGate
          onResolved={onAuthResolved}
          guestEmailUrl={`${agentBase()}/v1/magic/checkout/auth`}
        />
        <style>{css}</style>
      </main>
    );
  }

  if (phase === 'creating') {
    return (
      <main className="vitrina-magic-bare vitrina-magic-dark">
        <p className="vitrina-magic-status">Setting up payment…</p>
        <style>{css}</style>
      </main>
    );
  }

  // phase === 'review'
  const l = lookup!;
  const totalFormatted = l.total_eur.toFixed(2);

  return (
    <main className="vitrina-magic-dark vitrina-checkout-magic">
      <header className="vitrina-checkout-magic__header">
        <h1>Your basket</h1>
        <p className="vitrina-checkout-magic__sub">Confirm items, then pay — nothing else loads here.</p>
      </header>

      <div className="vitrina-checkout-magic__shops">
        {l.shops.map((shop) => (
          <Surface key={shop.id} className="vitrina-checkout-magic__shop-card">
            <p className="vitrina-checkout-magic__shop-name">{shop.name}</p>
            <p className="vitrina-checkout-magic__shop-items">
              {shop.item_count} item{shop.item_count !== 1 ? 's' : ''}
            </p>
          </Surface>
        ))}
      </div>

      {l.slot && (
        <div className="vitrina-checkout-magic__slot">
          <span className="vitrina-magic-kicker">Pickup slot</span>
          <p>{(l.slot as { label?: string }).label ?? JSON.stringify(l.slot)}</p>
        </div>
      )}

      <div className="vitrina-checkout-magic__total">
        <span>Total</span>
        <strong>€{totalFormatted}</strong>
      </div>

      <div className="vitrina-checkout-magic__cta">
        <Button type="button" onClick={() => setPhase('auth')}>
          Continue to checkout
        </Button>
      </div>

      <style>{css}</style>
    </main>
  );
}

const css = `
  .vitrina-magic-dark {
    --mg-bg: #0c0c0c;
    --mg-fg: #f5f5f4;
    --mg-muted: #a8a29e;
    background: var(--mg-bg);
    color: var(--mg-fg);
    min-height: 100dvh;
  }
  .vitrina-magic-bare {
    display: grid;
    place-items: center;
    padding: 20px;
  }
  .vitrina-magic-status {
    margin: 0;
    padding: 24px;
    text-align: center;
    color: var(--mg-muted);
  }
  .vitrina-magic-status--sub {
    padding-top: 0;
    font-size: 0.85rem;
    max-width: 320px;
    margin: 0 auto;
    line-height: 1.4;
  }
  .vitrina-magic-card {
    width: min(480px, 100%);
    padding: 24px;
    text-align: center;
    background: #171717 !important;
    border: 1px solid #292524 !important;
    color: var(--mg-fg) !important;
  }
  .vitrina-magic-card--done { margin-top: 40px; }
  .vitrina-magic-kicker {
    display: block;
    margin: 0 0 6px;
    color: var(--mg-muted);
    text-transform: uppercase;
    letter-spacing: .08em;
    font-size: .72rem;
  }
  .vitrina-magic-card h1 {
    margin: 0 0 12px;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--mg-fg);
  }
  .vitrina-magic-hint {
    margin: 0;
    color: var(--mg-muted);
    font-size: 0.95rem;
    line-height: 1.45;
  }
  .vitrina-checkout-magic {
    max-width: 540px;
    margin: 0 auto;
    padding: 24px 16px 40px;
  }
  .vitrina-checkout-magic__header {
    margin-bottom: 20px;
  }
  .vitrina-checkout-magic__header h1 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
  }
  .vitrina-checkout-magic__sub {
    margin: 6px 0 0;
    font-size: 0.88rem;
    color: var(--mg-muted);
    line-height: 1.35;
  }
  .vitrina-checkout-magic__email {
    margin: 4px 0 0;
    font-size: 0.85rem;
    color: var(--mg-muted);
  }
  .vitrina-checkout-magic__shops {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }
  .vitrina-checkout-magic__shop-card {
    padding: 14px 16px;
    background: #171717 !important;
    border: 1px solid #292524 !important;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .vitrina-checkout-magic__shop-name {
    margin: 0;
    font-weight: 600;
    color: var(--mg-fg);
  }
  .vitrina-checkout-magic__shop-items {
    margin: 0;
    font-size: 0.85rem;
    color: var(--mg-muted);
  }
  .vitrina-checkout-magic__slot {
    margin-bottom: 16px;
    padding: 12px 14px;
    background: #171717;
    border: 1px solid #292524;
    border-radius: 10px;
  }
  .vitrina-checkout-magic__slot p {
    margin: 4px 0 0;
    font-size: 0.9rem;
  }
  .vitrina-checkout-magic__total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 0;
    border-top: 1px solid #292524;
    margin-bottom: 20px;
    font-size: 1rem;
  }
  .vitrina-checkout-magic__total strong {
    font-size: 1.2rem;
    font-weight: 700;
  }
  .vitrina-checkout-magic__cta {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .vitrina-checkout-magic__stripe {
    min-height: 400px;
  }
`;
