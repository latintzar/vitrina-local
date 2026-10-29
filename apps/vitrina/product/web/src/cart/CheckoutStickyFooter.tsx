/**
 * CheckoutStickyFooter — single source of truth for the bottom CTA bar
 * during checkout (basket review, slot pick, address, pay).
 *
 * Plan reference: ``vitrina-async-chat-and-seed-pool``, phase F3.
 *
 * Why a shared component:
 *   - The user explicitly called out that the sticky CTA's subtotal /
 *     service fee / total presentation should be **identical** across
 *     every checkout step. Inlining it three places drifts.
 *   - Step-aware CTA label means the same row also drives navigation
 *     (Continue → choose slot → address → Pay).
 *
 * Visual contract (matches the legacy markup that lived inline in
 * CheckoutModal so we can drop it in without restyling):
 *   .vitrina-checkout-sticky
 *     .vitrina-checkout-sticky__breakdown
 *       .row Subtotal               €X.YY
 *       .row Service fee · Standard €X.YY
 *       .row.row--bold Order total  €X.YY
 *     button.vitrina-checkout-pay   <Label>
 *     <Legal copy slot>
 */

import type { ReactNode } from 'react';
import { Receipt } from 'lucide-react';

export type CheckoutStickyFooterProps = {
  subtotalEur: number;
  serviceFeeEur: number;
  /** "priority" highlights "Priority" next to the fee label. */
  slotKind?: 'priority' | 'standard' | null;
  /** CTA copy. Caller controls the label, e.g. "Continue", "Pay €12.34". */
  ctaLabel: string;
  onCta: () => void;
  ctaDisabled?: boolean;
  /** Optional small print under the CTA (e.g. Stripe legal copy). */
  legal?: ReactNode;
  /** Optional class hook so a host can override padding/positioning. */
  className?: string;
};

export function CheckoutStickyFooter({
  subtotalEur,
  serviceFeeEur,
  slotKind,
  ctaLabel,
  onCta,
  ctaDisabled,
  legal,
  className,
}: CheckoutStickyFooterProps) {
  const total = subtotalEur + serviceFeeEur;
  const cls = ['vitrina-checkout-sticky'];
  if (className) cls.push(className);
  // Visual structure mirrors ``Cart.tsx``'s ``vitrina-bsk-paybar`` →
  // ``vitrina-bsk-totals`` (card) → ``vitrina-bsk-checkout`` (CTA) so
  // the two sticky bars feel like the same UI element across screens.
  return (
    <footer className={cls.join(' ')}>
      <div className="vitrina-bsk-totals">
        <div className="vitrina-bsk-totals__row">
          <span>Subtotal</span>
          <span>€{subtotalEur.toFixed(2)}</span>
        </div>
        <div className="vitrina-bsk-totals__row">
          <span className="vitrina-bsk-totals__fee">
            <Receipt size={14} strokeWidth={2} />
            Service fee
            {slotKind === 'priority' ? <em> Priority</em> : <em> Standard</em>}
          </span>
          <span>€{serviceFeeEur.toFixed(2)}</span>
        </div>
        <div className="vitrina-bsk-totals__row vitrina-bsk-totals__row--bold">
          <span>Order total</span>
          <strong>€{total.toFixed(2)}</strong>
        </div>
      </div>
      <button
        type="button"
        className="vitrina-bsk-checkout"
        onClick={onCta}
        disabled={ctaDisabled}
      >
        {ctaLabel}
      </button>
      {legal ? <p className="vitrina-checkout-page__legal">{legal}</p> : null}
    </footer>
  );
}
