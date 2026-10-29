import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { listShops } from '../api/mcp';
import type { Shop } from '../api/types';
import { Cart } from '../shops/Cart';
import { CheckoutModal } from '../shops/CheckoutModal';
import { useCart, usePulse } from './useCart';
import { InComponentLoadingOverlay } from '../components/InComponentLoadingOverlay';

/**
 * BasketSheet — full-screen basket shell with a tiny in-sheet
 * navigation stack (Cart ↔ Checkout).
 *
 * Header anatomy:
 *   - Top-RIGHT: an X button that ALWAYS closes the whole basket,
 *     regardless of which sub-screen the user is on. This is the
 *     standard "dismiss" affordance and never moves.
 *   - Top-LEFT: a chevron-back button that ONLY appears when the
 *     user is on a sub-screen (e.g. Checkout). On the basket root
 *     it's an empty 40x40 spacer so the title stays centred.
 *
 * That way "back" pops the navigation stack (Checkout → Cart)
 * without dismissing the whole basket, and the X is always there
 * to bail out at any depth.
 */
export function BasketSheet({
  open,
  onClose,
  onPaid,
  onDiscover,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after Stripe confirms payment so the parent can open Orders. */
  onPaid?: () => void;
  /** Called when the user taps "Browse recipes" from an empty basket. */
  onDiscover?: () => void;
}) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const cart = useCart();
  const pulseAt = usePulse();
  const panelRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!pulseAt) return;
    const el = panelRef.current;
    if (!el) return;
    el.classList.remove('is-pulsing');
    void el.offsetWidth;
    el.classList.add('is-pulsing');
    const t = setTimeout(() => el.classList.remove('is-pulsing'), 520);
    return () => clearTimeout(t);
  }, [pulseAt]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    listShops()
      .then((data) => alive && setShops(data.shops))
      .catch(() => alive && setShops([]));
    return () => {
      alive = false;
    };
  }, [open]);

  // Reset to basket-root every time the sheet is reopened so users
  // don't land back on the checkout sub-screen after closing.
  useEffect(() => {
    if (!open) {
      setCheckoutOpen(false);
      setClearConfirmOpen(false);
      setClearing(false);
    }
  }, [open]);

  if (!open) return null;

  const itemCount = cart.totalItems;
  const titleText = checkoutOpen ? 'Checkout' : 'Your basket';
  const subtitleText = checkoutOpen
    ? 'Review · pickup · pay'
    : itemCount === 1
    ? '1 item'
    : `${itemCount} items`;

  const confirmClear = async () => {
    setClearConfirmOpen(false);
    setClearing(true);
    try {
      await cart.clear();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="vitrina-basket-sheet" role="dialog" aria-modal="true">
      <div className="vitrina-basket-scrim" onClick={onClose} />
      <section ref={panelRef} className="vitrina-basket-panel">
        <header className="vitrina-basket-header">
          {checkoutOpen ? (
            <button
              type="button"
              className="vitrina-basket-close"
              onClick={() => setCheckoutOpen(false)}
              aria-label="Back to basket"
            >
              <ChevronLeft size={22} strokeWidth={2.2} />
            </button>
          ) : (
            <span aria-hidden className="vitrina-basket-spacer" />
          )}
          <div className="vitrina-basket-title">
            <strong>{titleText}</strong>
            <span>{subtitleText}</span>
          </div>
          <button
            type="button"
            className="vitrina-basket-close"
            onClick={onClose}
            aria-label="Close basket"
          >
            <X size={20} strokeWidth={2.2} />
          </button>
        </header>
        <div className="vitrina-basket-body">
          {checkoutOpen ? (
            <CheckoutModal
              shops={shops}
              onClose={() => setCheckoutOpen(false)}
              embedded
              onPaid={() => {
                // Clear the basket, collapse checkout, close the sheet,
                // and let the parent know so it can open the Orders surface.
                void cart.clear?.();
                setCheckoutOpen(false);
                onClose();
                onPaid?.();
              }}
            />
          ) : (
            <Cart
              shops={shops}
              onCheckout={() => window.alert("Checkout is unavailable in this demonstration.")}
              onClearRequest={() => setClearConfirmOpen(true)}
              onDiscover={onDiscover ? () => { onClose(); onDiscover(); } : undefined}
            />
          )}
        </div>
        {clearConfirmOpen ? (
          <div className="vitrina-clear-confirm" role="dialog" aria-modal="true">
            <button
              type="button"
              className="vitrina-clear-confirm__scrim"
              aria-label="Go back"
              onClick={() => setClearConfirmOpen(false)}
            />
            <section className="vitrina-clear-confirm__card" aria-label="Confirm clear basket">
              <div className="vitrina-clear-confirm__copy">
                <strong>Clear this basket?</strong>
                <span>This removes the visible basket and any old open test baskets tied to this shopper.</span>
              </div>
              <button
                type="button"
                className="vitrina-clear-confirm__danger"
                onClick={() => void confirmClear()}
              >
                Clear basket
              </button>
              <button
                type="button"
                className="vitrina-clear-confirm__back"
                onClick={() => setClearConfirmOpen(false)}
              >
                Go back
              </button>
            </section>
          </div>
        ) : null}
        {clearing ? <InComponentLoadingOverlay label="Clearing basket…" size={76} /> : null}
      </section>

      <style>{`
        .vitrina-basket-sheet { position: fixed; inset: 0; z-index: 92; pointer-events: none; }
        .vitrina-basket-scrim {
          position: absolute; inset: 0;
          background: color-mix(in srgb, var(--color-ink) 18%, transparent);
          pointer-events: auto;
        }
        .vitrina-basket-panel {
          position: absolute; inset: 0;
          background: var(--color-cream);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          pointer-events: auto;
          transform-origin: center top;
        }
        .vitrina-basket-panel.is-pulsing {
          animation: vitrina-basket-pulse 480ms ease-out;
        }
        @keyframes vitrina-basket-pulse {
          0%   { transform: scale(1); box-shadow: none; }
          40%  { transform: scale(1.012); box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-accent, #d97706) 18%, transparent) inset; }
          100% { transform: scale(1); box-shadow: none; }
        }
        .vitrina-basket-header {
          display: grid;
          grid-template-columns: 40px 1fr 40px;
          align-items: center;
          gap: 12px;
          padding: calc(env(safe-area-inset-top, 0px) + 14px) 14px 12px;
          background: color-mix(in srgb, var(--color-card) 92%, transparent);
          border-bottom: 1px solid color-mix(in srgb, var(--color-ink) 6%, transparent);
        }
        .vitrina-basket-close {
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
          transition: background 140ms ease;
        }
        .vitrina-basket-close:hover {
          background: color-mix(in srgb, var(--color-ink) 6%, transparent);
        }
        .vitrina-basket-title {
          display: grid;
          place-items: center;
          gap: 1px;
          line-height: 1.15;
        }
        .vitrina-basket-title strong {
          font-family: var(--font-display);
          color: var(--color-ink);
          font-size: 1.05rem;
          font-weight: 600;
          letter-spacing: -0.015em;
        }
        .vitrina-basket-title span {
          color: var(--color-ink-light);
          font-size: 0.78rem;
        }
        .vitrina-basket-spacer { width: 40px; height: 40px; }
        .vitrina-basket-body {
          flex: 1;
          min-height: 0;
          /* The basket body itself does NOT scroll. The Cart child owns
             a scrollable viewport for line-items and pins its own
             paybar (totals + Checkout CTA) at the bottom of the panel
             so the user can always see what they're about to pay. */
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .vitrina-basket-body > * {
          flex: 1;
          min-height: 0;
        }
        .vitrina-clear-confirm {
          position: absolute;
          inset: 0;
          z-index: 10;
          display: flex;
          align-items: flex-end;
          pointer-events: auto;
        }
        .vitrina-clear-confirm__scrim {
          position: absolute;
          inset: 0;
          border: 0;
          padding: 0;
          background: color-mix(in srgb, var(--color-ink) 22%, transparent);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          cursor: pointer;
        }
        .vitrina-clear-confirm__card {
          position: relative;
          z-index: 1;
          width: 100%;
          display: grid;
          gap: 10px;
          padding: 18px 16px calc(18px + env(safe-area-inset-bottom, 0px));
          border-radius: 6px 6px 0 0;
          background: var(--color-card);
          box-shadow: 0 -24px 60px -34px color-mix(in srgb, var(--color-ink) 70%, transparent);
          animation: vitrina-clear-card-up 180ms ease-out;
        }
        @keyframes vitrina-clear-card-up {
          from { transform: translateY(18px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .vitrina-clear-confirm__copy {
          display: grid;
          gap: 4px;
          margin-bottom: 4px;
          text-align: center;
        }
        .vitrina-clear-confirm__copy strong {
          font-family: var(--font-display);
          font-size: 1.02rem;
          color: var(--color-ink);
        }
        .vitrina-clear-confirm__copy span {
          color: var(--color-ink-light);
          font-size: 0.84rem;
          line-height: 1.35;
        }
        .vitrina-clear-confirm__danger,
        .vitrina-clear-confirm__back {
          width: 100%;
          min-height: 50px;
          border-radius: 6px;
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 0.96rem;
          cursor: pointer;
        }
        .vitrina-clear-confirm__danger {
          border: 0;
          background: #ba1a1a;
          color: #fff;
        }
        .vitrina-clear-confirm__back {
          border: 0;
          background: transparent;
          color: var(--color-ink);
        }
      `}</style>
    </div>
  );
}
