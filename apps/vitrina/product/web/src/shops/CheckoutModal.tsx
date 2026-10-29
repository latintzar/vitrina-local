/**
 * CheckoutModal — the Checkout sub-screen rendered inside the basket
 * sheet.
 *
 * Two render modes:
 *   - `embedded` (default for in-basket use): no top-bar, no fixed
 *     positioning. The shell (BasketSheet) supplies the X +
 *     back-chevron and "Checkout" title.
 *   - non-embedded (legacy): own full-screen container with own
 *     top-bar. Kept for future free-standing checkout call sites.
 *
 * Pay flow:
 *   review → (tap Pay) → creating → (Stripe session minted) → paying
 *   The `paying` phase renders Stripe's Embedded Checkout iframe via
 *   @stripe/react-stripe-js. No redirect; pay happens in-app. On
 *   completion `onPaid()` is called so the basket can clear + jump to
 *   the Orders surface. `/checkout/success` remains as a return_url
 *   fallback if the iframe navigates away.
 */

import { useMemo, useState } from 'react';

import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { ChevronLeft, MapPin, Zap, CalendarClock } from 'lucide-react';
import { AuthSheet } from '../auth/AuthSheet';
import { useAuth } from '../auth/useAuth';
import { useCart } from '../cart/useCart';
import {
  SERVICE_FEE_PRIORITY_EUR,
  SERVICE_FEE_STANDARD_EUR,
  useSlot,
} from '../cart/fulfillment';
import { CheckoutStickyFooter } from '../cart/CheckoutStickyFooter';
import { createCheckoutFromCarts, createCheckoutSession } from '../api/mcp';
import type { CheckoutSession, Shop } from '../api/types';

// Initialised once at module load. If the env var is missing, loadStripe
// returns null and the iframe won't mount — we surface a clear error so
// missing env config is immediately obvious on preview deploys.
const stripePromise = Promise.resolve(null);

type Phase = 'review' | 'creating' | 'paying' | 'error';
type CheckoutStartResponse = CheckoutSession & {
  sessions?: CheckoutSession[];
  client_secret?: string;
};

export function CheckoutModal({
  shops,
  onClose,
  embedded = false,
  onPaid,
}: {
  shops: Shop[];
  onClose: () => void;
  embedded?: boolean;
  /** Called when Stripe confirms payment in-iframe so the caller can
   *  clear the basket and open the Orders surface. */
  onPaid?: () => void;
}) {
  const cart = useCart();
  const { user } = useAuth();
  const { slot } = useSlot();
  const [phase, setPhase] = useState<Phase>('review');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const shopById = useMemo(() => {
    const map = new Map<string, Shop>();
    for (const s of shops) map.set(s.id, s);
    return map;
  }, [shops]);

  const subtotal = cart.totalEur;
  const serviceFee =
    slot?.kind === 'priority' ? SERVICE_FEE_PRIORITY_EUR : SERVICE_FEE_STANDARD_EUR;
  const total = subtotal + serviceFee;

  async function startPay() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setPhase('creating');
    setErrMsg(null);
    try {
      const buyer = { email: user.email, name: user.name };
      const slotPayload = slot
        ? { kind: slot.kind, start: slot.startIso, end: slot.endIso, label: slot.label }
        : null;
      // Filter out optimistic cart IDs (not yet persisted to DB) to
      // avoid sending "__opt-cart__:shop-id" UUIDs to Stripe which
      // causes a Postgres 400 / API 500.
      const realCartIds = cart.cartIds.filter((id) => !id.startsWith('__opt-cart__:'));
      const response: CheckoutStartResponse = realCartIds.length > 0
        ? await createCheckoutFromCarts(realCartIds, buyer, slotPayload)
        : await createCheckoutSession(
            cart.shop_id || shops[0]?.id || '',
            cart.lines.map((l) => ({ id: l.product.id, quantity: l.quantity })),
            buyer,
          );
      const secret =
        response.client_secret ??
        response.payment_link?.client_secret ??
        null;
      if (!secret) {
        throw new Error('Checkout session did not return a client_secret. Check VITE_STRIPE_PUBLISHABLE_KEY and backend config.');
      }
      setClientSecret(secret);
      setPhase('paying');
    } catch (e) {
      setErrMsg(String(e));
      setPhase('error');
    }
  }

  function handleStripeComplete() {
    // Stripe fires this when the iframe transitions to its "Payment
    // received" terminal state — before the return_url redirect. We
    // stay in-app: clear the basket and hand off to the Orders surface.
    onPaid?.();
  }

  const containerClass = embedded
    ? 'vitrina-checkout-page vitrina-checkout-page--embedded'
    : 'vitrina-checkout-page';

  // Paying phase: show Stripe's embedded iframe full-height inside the
  // basket sheet. The review screen stays unmounted so we don't leak
  // any event listeners or stale subtotals.
  if (phase === 'paying' && clientSecret) {
    return (
      <div className={`${containerClass} vitrina-checkout-page--paying`}>
        {embedded ? null : (
          <header className="vitrina-checkout-page__topbar">
            <button
              type="button"
              className="vitrina-checkout-page__back"
              onClick={() => setPhase('review')}
              aria-label="Back to review"
            >
              <ChevronLeft size={22} strokeWidth={2.2} />
            </button>
            <h2>Pay</h2>
            <span className="vitrina-checkout-page__spacer" aria-hidden />
          </header>
        )}
        <div className="vitrina-checkout-stripe-wrap">
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{
              clientSecret,
              onComplete: handleStripeComplete,
            }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
        <style>{CHECKOUT_PAGE_CSS}</style>
      </div>
    );
  }

  return (
    <div
      className={containerClass}
      role={embedded ? undefined : 'dialog'}
      aria-modal={embedded ? undefined : 'true'}
    >
      {embedded ? null : (
        <header className="vitrina-checkout-page__topbar">
          <button
            type="button"
            className="vitrina-checkout-page__back"
            onClick={onClose}
            aria-label="Back to basket"
          >
            <ChevronLeft size={22} strokeWidth={2.2} />
          </button>
          <h2>Checkout</h2>
          <span className="vitrina-checkout-page__spacer" aria-hidden />
        </header>
      )}

      <main className="vitrina-checkout-page__body">
        <section className="vitrina-checkout-card">
          <header className="vitrina-checkout-card__head">
            {slot?.kind === 'priority' ? (
              <Zap size={16} strokeWidth={2.4} />
            ) : (
              <CalendarClock size={16} strokeWidth={2} />
            )}
            <strong>{slot ? slot.label : 'No pickup time selected'}</strong>
          </header>
          <p className="vitrina-checkout-card__meta">
            {slot
              ? slot.kind === 'priority'
                ? 'Priority pickup window — items are ready within an hour.'
                : 'All shops are ready inside this window.'
              : 'Go back and pick a slot before paying.'}
          </p>
        </section>

        <section className="vitrina-checkout-card">
          <header className="vitrina-checkout-card__head vitrina-checkout-card__head--plain">
            <strong>{cart.carts.length === 1 ? 'Pickup stop' : `${cart.carts.length} pickup stops`}</strong>
          </header>
          <ul className="vitrina-checkout-stops">
              {cart.carts.map((ucpCart) => {
              const shop = shopById.get(ucpCart.shop_id);
                const lines = cart.lines.filter((line) => line.cart_id === ucpCart.id);
              const shopTotal = lines.reduce((n, l) => n + l.quantity * l.product.price_eur, 0);
                return (
                <li key={ucpCart.id} className="vitrina-checkout-stop">
                  <div className="vitrina-checkout-stop__head">
                    <div className="vitrina-checkout-stop__title">
                      <strong>{shop?.name ?? ucpCart.shop_id}</strong>
                      {shop?.address || shop?.city ? (
                        <span>
                          <MapPin size={11} strokeWidth={2} />
                          {shop?.address ?? shop?.city}
                      </span>
                      ) : null}
                    </div>
                    <span className="vitrina-checkout-stop__total">€{shopTotal.toFixed(2)}</span>
                  </div>
                  <ul className="vitrina-checkout-lines">
                      {lines.map((l) => (
                        <li key={l.id}>
                          <span>{l.quantity}× {l.product.name}</span>
                        <span>€{(l.quantity * l.product.price_eur).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                </li>
                );
              })}
          </ul>
        </section>

        {phase === 'error' ? (
          <p className="vitrina-checkout-error" role="alert">{errMsg}</p>
        ) : null}
      </main>

      <CheckoutStickyFooter
        subtotalEur={subtotal}
        serviceFeeEur={serviceFee}
        slotKind={slot?.kind ?? null}
        ctaLabel={phase === 'creating' ? 'Preparing…' : `Pay €${total.toFixed(2)}`}
        onCta={() => void startPay()}
        ctaDisabled={phase === 'creating' || cart.lines.length === 0}
        className="vitrina-checkout-page__footer"
      />

      <AuthSheet
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        intro="Sign in to complete your order. Your basket and chat transfer automatically."
        onAuthenticated={() => {
          void startPay();
        }}
      />

      <style>{CHECKOUT_PAGE_CSS}</style>
    </div>
  );
}

const CHECKOUT_PAGE_CSS = `
.vitrina-checkout-page {
  position: fixed;
  inset: 0;
  z-index: 95;
  background: var(--color-cream);
  display: flex;
  flex-direction: column;
}
/* Embedded mode: rendered inside BasketSheet's body; no own
   positioning, no own top-bar (the basket header handles nav).
   The container fills the basket body, then splits into a scrollable
   middle (review cards) and a non-scrolling sticky footer (totals +
   Pay CTA) so the user always sees what they're about to pay. */
.vitrina-checkout-page--embedded {
  position: static;
  inset: auto;
  z-index: auto;
  background: transparent;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.vitrina-checkout-page--embedded .vitrina-checkout-page__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 14px 14px 12px;
  display: grid;
  gap: 12px;
  align-content: start;
}
.vitrina-checkout-page--embedded .vitrina-checkout-page__footer {
  position: static;
  flex-shrink: 0;
  margin-top: 0;
  padding: 12px 14px calc(env(safe-area-inset-bottom, 0px) + 14px);
  background: var(--color-cream);
  border-top: 1px solid color-mix(in srgb, var(--color-ink) 8%, transparent);
}
.vitrina-checkout-page__topbar {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  gap: 12px;
  padding: calc(env(safe-area-inset-top, 0px) + 14px) 14px 12px;
  background: color-mix(in srgb, var(--color-card) 92%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--color-ink) 6%, transparent);
}
.vitrina-checkout-page__back {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-ink);
  cursor: pointer;
}
.vitrina-checkout-page__back:hover {
  background: color-mix(in srgb, var(--color-ink) 6%, transparent);
}
.vitrina-checkout-page__topbar h2 {
  margin: 0;
  text-align: center;
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-ink);
}
.vitrina-checkout-page__spacer { display: block; width: 40px; }

.vitrina-checkout-page__body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 14px 24px;
  display: grid;
  gap: 12px;
}
.vitrina-checkout-card {
  background: var(--color-card);
  border-radius: 6px;
  padding: 14px 16px;
  display: grid;
  gap: 8px;
}
.vitrina-checkout-card__head {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 0.98rem;
}
.vitrina-checkout-card__head--plain { gap: 0; }
.vitrina-checkout-card__meta {
  margin: 0;
  color: var(--color-ink-light);
  font-size: 0.84rem;
  line-height: 1.4;
}

.vitrina-checkout-stops {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 14px;
}
.vitrina-checkout-stop {
  display: grid;
  gap: 8px;
}
.vitrina-checkout-stop__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.vitrina-checkout-stop__title {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.vitrina-checkout-stop__title strong {
  font-family: var(--font-display);
  color: var(--color-ink);
  font-size: 0.95rem;
}
.vitrina-checkout-stop__title span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--color-ink-light);
  font-size: 0.78rem;
}
.vitrina-checkout-stop__total {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--color-ink);
}
.vitrina-checkout-lines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
}
.vitrina-checkout-lines li {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  color: var(--color-ink-light);
  font-size: 0.86rem;
  font-variant-numeric: tabular-nums;
}
.vitrina-checkout-lines li span:first-child {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vitrina-checkout-lines li span:last-child {
  flex-shrink: 0;
}
.vitrina-checkout-stop__head {
  flex-wrap: wrap;
}
.vitrina-checkout-stop__title {
  flex: 1;
  min-width: 0;
}
.vitrina-checkout-stop__title strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.vitrina-checkout-totals { gap: 6px; }
.vitrina-checkout-totals__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--color-ink);
  font-variant-numeric: tabular-nums;
  font-size: 0.92rem;
}
.vitrina-checkout-totals__fee {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-ink-light);
}
.vitrina-checkout-totals__fee em {
  font-style: normal;
  color: var(--color-ink);
  font-weight: 500;
}
.vitrina-checkout-totals__row--bold {
  padding-top: 6px;
  margin-top: 4px;
  border-top: 1px solid color-mix(in srgb, var(--color-ink) 8%, transparent);
  font-size: 1.02rem;
  font-weight: 600;
}

.vitrina-checkout-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 6px;
  background: #fdecec;
  color: #8a2120;
  font-size: 0.86rem;
}

.vitrina-checkout-page__footer {
  padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px));
  background: var(--color-card);
  border-top: 1px solid color-mix(in srgb, var(--color-ink) 8%, transparent);
  display: grid;
  gap: 8px;
}
.vitrina-checkout-pay {
  display: block;
  width: 100%;
  min-height: 52px;
  padding: 14px 18px;
  border: 0;
  border-radius: 6px;
  background: #111;
  color: var(--color-cream);
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 140ms ease, transform 140ms ease;
}
.vitrina-checkout-pay:hover { background: #000; }
.vitrina-checkout-pay:active { transform: scale(0.99); }
.vitrina-checkout-pay:disabled {
  background: color-mix(in srgb, var(--color-ink) 30%, transparent);
  color: color-mix(in srgb, var(--color-cream) 80%, transparent);
  cursor: not-allowed;
}
.vitrina-checkout-page__legal {
  margin: 0;
  text-align: center;
  color: var(--color-ink-light);
  font-size: 0.74rem;
}

/* CheckoutStickyFooter uses the basket's pay-bar classes (.vitrina-bsk-*)
   so the bar that says "Order total · Pay €X.YY" looks identical between
   the basket and checkout review steps. Cart.tsx defines these inside
   its own inline <style>, but Cart and CheckoutModal are mutually
   exclusive in BasketSheet — when checkout opens, Cart unmounts and
   takes its styles with it. We re-declare the relevant rules here so
   the footer keeps its look mid-checkout. Keep these in sync with the
   matching block in Cart.tsx. */
.vitrina-bsk-totals {
  display: grid;
  gap: 6px;
  padding: 14px 16px 12px;
  border-radius: 6px;
  background: var(--color-card);
}
.vitrina-bsk-totals__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--color-ink-light);
  font-size: 0.92rem;
  font-variant-numeric: tabular-nums;
}
.vitrina-bsk-totals__row--bold {
  color: var(--color-ink);
  font-size: 1.05rem;
  padding-top: 6px;
  border-top: 1px solid color-mix(in srgb, var(--color-ink) 8%, transparent);
}
.vitrina-bsk-totals__row--bold strong { font-weight: 700; }
.vitrina-bsk-totals__fee {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.vitrina-bsk-totals__fee em {
  font-style: normal;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 2px 6px;
  margin-left: 2px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--color-dijon, #d4a017) 18%, transparent);
  color: var(--color-dijon-dark, #8a5a00);
}
.vitrina-bsk-checkout {
  display: block;
  width: 100%;
  margin-top: 10px;
  min-height: 54px;
  padding: 14px 18px;
  border: 0;
  border-radius: 6px;
  background: #000;
  color: var(--color-cream);
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.005em;
  cursor: pointer;
  transition: background 140ms ease, transform 140ms ease;
}
.vitrina-bsk-checkout:hover { background: #111; }
.vitrina-bsk-checkout:active { transform: scale(0.99); }
.vitrina-bsk-checkout:disabled {
  background: color-mix(in srgb, var(--color-ink) 30%, transparent);
  color: color-mix(in srgb, var(--color-cream) 80%, transparent);
  cursor: not-allowed;
}

/* Embedded Stripe iframe wrapper — fills all available height in
   the basket sheet so Stripe renders its own scrollable surface. */
.vitrina-checkout-page--paying {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.vitrina-checkout-stripe-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
#stripe-embedded-checkout {
  height: 100%;
}
`;
