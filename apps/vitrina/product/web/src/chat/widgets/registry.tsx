/**
 * Chat widget registry — the agent emits a structured `{type, payload}`
 * envelope and the renderer maps it to a card.
 *
 * ─────────────────────────────────────────────────────────────────
 * CANONICAL WIDGETS (only six — keep this list short on purpose)
 * ─────────────────────────────────────────────────────────────────
 *
 * Live (re-renders from the live store as the user scrolls back —
 * whatever they see ALWAYS matches the current state, not the moment
 * the widget was emitted):
 *
 *   1. `basket`   — basket summary card with subtotal / fee / total +
 *                   Checkout CTA. Reads `useCart()` so older copies
 *                   in the transcript stay in sync.
 *   2. `product`  — single product card with inline qty stepper.
 *                   Reads `useCart()` so the stepper reflects whatever
 *                   the user has now, not what was in the basket when
 *                   the agent first showed the card.
 *
 * Static (snapshot of data the agent fetched at that turn — these don't
 * change retroactively because the underlying entity doesn't either):
 *
 *   3. `recipe`   — recipe card (poster, ingredients preview, total).
 *   4. `shops`    — list/grid of shops near the user.
 *   5. `pay`      — Stripe Checkout CTA.
 *   6. `stretch`  — upsell ("add €X more for free pickup", etc.)
 *
 * ─────────────────────────────────────────────────────────────────
 * BACKWARD COMPATIBILITY
 * ─────────────────────────────────────────────────────────────────
 * The agent has been emitting a wider set of names (basket_summary,
 * basket_snapshot, added_receipt, recipe_video_card, shop_results, …).
 * Every old name maps to one of the six canonical widgets via ALIASES,
 * so the agent prompt does NOT need a flag-day rename.
 *
 * Things that USED to be widgets but should now be plain markdown from
 * the agent (no widget — too noisy, not card-shaped content):
 *   - clarify_question, error_apology, substitution_proposal,
 *     replan_proposal, pay_confirmation, order_confirmation,
 *     collection_reminder, basket_pulse
 * For now they fall through to a minimal text card to avoid breaking
 * old transcripts; the agent prompt should drop them.
 */

import type { ReactNode } from 'react';
import { BasketSummaryWidget } from './BasketSummaryWidget';
import { ChatWidgetShell } from './ChatWidgetShell';
import { PayButton } from './PayButton';
import { RecipeWidget, type RecipeWidgetProps } from './RecipeWidget';
import type { RecipeVideoDetail } from '../../discover/recipeVideosApi';
import { ShopProductWidget } from './ShopProductWidget';
import { ShopResultGrid, type ShopResultGridProps } from './ShopResultGrid';
import { StretchCard, type StretchCardProps } from './StretchCard';

export interface WidgetEnvelope {
  type: string;
  payload: Record<string, unknown>;
}

type CanonicalType = 'basket' | 'product' | 'recipe' | 'shops' | 'pay' | 'stretch';

/** Map every emitted widget name (canonical or legacy alias) to one of
 *  the six canonical widgets. Lowercase comparison so the agent can use
 *  any casing. */
const ALIASES: Record<string, CanonicalType> = {
  // basket — live
  basket: 'basket',
  basket_summary: 'basket',
  basket_snapshot: 'basket',
  added_receipt: 'basket',
  // product — live (inline stepper)
  product: 'product',
  product_card: 'product',
  shop_product_card: 'product',
  // recipe — static
  recipe: 'recipe',
  recipe_summary: 'recipe',
  recipe_video_card: 'recipe',
  recipewidget: 'recipe',
  // shops — static (browse / discovery)
  shops: 'shops',
  shop_results: 'shops',
  shop_comparison: 'shops',
  shop_card: 'shops',
  shopresultgrid: 'shops',
  // pay — one-shot
  pay: 'pay',
  pay_cta: 'pay',
  paybutton: 'pay',
  // stretch — upsell
  stretch: 'stretch',
  stretch_card: 'stretch',
  stretchcard: 'stretch',
};

/** Legacy widget types that should now be plain markdown. We render a
 *  minimal text card rather than dropping them silently — avoids holes
 *  in older transcripts while signalling to the agent prompt that these
 *  shouldn't be emitted any more. */
const LEGACY_TEXT_TYPES: Record<string, string> = {
  clarify_question: 'Quick question',
  error_apology: 'We hit a snag',
  substitution_proposal: 'Substitution proposal',
  replan_proposal: 'Re-plan options',
  pay_confirmation: 'Order confirmed',
  order_confirmation: 'Order confirmed',
  collection_reminder: 'Collection reminder',
};

function asProps<T>(payload: Record<string, unknown>): T {
  return payload as T;
}

function SimpleWidget({ title, children }: { title: string; children: ReactNode }) {
  return <ChatWidgetShell title={title}>{children}</ChatWidgetShell>;
}

export function ChatWidgetRenderer({ widget }: { widget: WidgetEnvelope }) {
  const key = widget.type?.toLowerCase?.() ?? '';
  const canonical = ALIASES[key];

  // basket_pulse is a no-op signal — the basket icon already animates.
  if (key === 'basket_pulse') return null;

  if (canonical === 'basket') {
    return <BasketSummaryWidget />;
  }
  if (canonical === 'product') {
    return <ShopProductWidget {...asProps<Record<string, unknown>>(widget.payload)} />;
  }
  if (canonical === 'recipe') {
    const detail = (widget.payload as { detail?: RecipeVideoDetail }).detail
      ?? asProps<RecipeVideoDetail>(widget.payload);
    if (!detail || !('id' in detail)) {
      return <SimpleWidget title="Recipe">Recipe is being prepared…</SimpleWidget>;
    }
    const props: RecipeWidgetProps = { detail };
    return <RecipeWidget {...props} />;
  }
  if (canonical === 'shops') {
    return <ShopResultGrid {...asProps<ShopResultGridProps>(widget.payload)} />;
  }
  if (canonical === 'pay') {
    return (
      <PayButton
        url={String(widget.payload.url || widget.payload.checkout_url || '')}
        amountLabel={typeof widget.payload.amountLabel === 'string' ? widget.payload.amountLabel : undefined}
        disabled={!widget.payload.url && !widget.payload.checkout_url}
      />
    );
  }
  if (canonical === 'stretch') {
    return <StretchCard {...asProps<StretchCardProps>(widget.payload)} />;
  }

  const legacyTitle = LEGACY_TEXT_TYPES[key];
  if (legacyTitle) {
    return (
      <SimpleWidget title={legacyTitle}>
        {String(
          widget.payload.summary
            || widget.payload.message
            || widget.payload.text
            || widget.payload.question
            || '',
        )}
      </SimpleWidget>
    );
  }

  // Unknown type — render the raw payload so the issue is visible
  // rather than silent. The agent prompt should not be emitting this.
  return <SimpleWidget title={widget.type}>{JSON.stringify(widget.payload)}</SimpleWidget>;
}
