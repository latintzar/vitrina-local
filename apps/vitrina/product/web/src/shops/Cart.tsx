/**
 * Cart — Deliveroo-style basket panel.
 *
 * Layout (top → bottom):
 *   1. Pickup card — segmented [Now] / [Schedule] control inline in
 *      the basket. "Schedule" reveals the currently chosen day +
 *      slot and opens a small popup calendar (NOT a separate
 *      screen) for changing it. Default is the earliest standard
 *      slot allowed by the lead-time rule.
 *   2. Recipe groups — for every line whose `group_metadata.source`
 *      is `recipe-video`, items get nested under the recipe title,
 *      then under the shop name as a typographic sub-header (no card,
 *      just bold + hairline rule).
 *   3. Standalone shops — any remaining lines grouped by shop.
 *   4. Totals stack — Subtotal, Service fee (€0.99 standard / €2.99
 *      priority — two standalone prices, not “+€” on top of standard),
 *      Order total in bold.
 *   5. Solid "Checkout" CTA at the bottom.
 *
 * Items inside both recipe and standalone groups use the shared
 * `IngredientRow` component, so the row in the basket looks identical
 * to the row in the recipe modal. Quantity is editable via QtyStepper.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  ChevronDown,
  Receipt,
  Route,
  Zap,
} from 'lucide-react';
import { useCart, type CartLine } from '../cart/useCart';
import { openRecipeById } from '../discover/recipeViewer';
import { ShopGroup } from '../components/ShopGroup';
import { IngredientRow, QtyStepper } from '../components/IngredientRow';
import { SchedulePickerModal } from '../cart/SchedulePickerModal';
import { ingredientQuantityBreakdown } from '../components/ingredientQuantity';
import { useUserLocation } from '../location/useUserLocation';
import { walkingMinutes } from '../location/walkingTime';
import {
  earliestStandardSlot,
  priorityNow,
  SERVICE_FEE_PRIORITY_EUR,
  SERVICE_FEE_STANDARD_EUR,
  type Slot,
  useCartShopsOpenStatus,
  useSlot,
} from '../cart/fulfillment';
import type { Shop } from '../api/types';
import { formatMinor, listOrders, orderTotalMinor, type Order } from '../orders/ordersApi';

interface RecipeMeta {
  title: string;
  source_url?: string;
  /** Backend recipe-video id — used for the "See recipe" button so the
   *  in-app modal opens (same surface as Discover) rather than the
   *  external TikTok/Instagram link. */
  video_id?: string;
  /** Local cover endpoint — see backend routes/recipe_videos.py:cover.jpg. */
  cover_url?: string;
}

function recipeMeta(line: CartLine): RecipeMeta | null {
  const m = line.group_metadata;
  if (!m || m.source !== 'recipe-video') return null;
  const title = typeof m.title === 'string' ? m.title : 'Recipe';
  const source_url = typeof m.source_url === 'string' ? m.source_url : undefined;
  const video_id = typeof m.video_id === 'string' ? m.video_id : undefined;
  const cover_url = video_id ? `/api/recipe-videos/${video_id}/cover.jpg` : undefined;
  return { title, source_url, video_id, cover_url };
}

function ingredientName(line: CartLine): string {
  const m = line.group_metadata;
  if (m && typeof m.ingredient === 'string' && m.ingredient.length > 0) {
    return m.ingredient;
  }
  return line.product.name;
}

function directionsHref(shop: Shop | null): string | undefined {
  if (!shop) return undefined;
  // Generic Maps URL — works on iOS, Android, and desktop.
  const q = encodeURIComponent(
    `${shop.name}, ${shop.address || shop.city || ''}`.trim(),
  );
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function shopLatLng(shop: Shop | null): { lat: number; lng: number } | null {
  if (!shop) return null;
  const lng = typeof (shop as Shop & { lng?: number }).lng === 'number'
    ? (shop as Shop & { lng: number }).lng
    : shop.lon;
  if (typeof shop.lat !== 'number' || typeof lng !== 'number') return null;
  return { lat: shop.lat, lng };
}

function fullJourneyHref(
  shops: Shop[],
  userLocation: { lat: number; lng: number } | null,
): string | null {
  if (!shops.length) return null;
  const stops = shops
    .map((shop) => {
      const ll = shopLatLng(shop);
      return ll ? `${ll.lat},${ll.lng}` : encodeURIComponent(`${shop.name} ${shop.address || ''}`.trim());
    })
    .join('/');
  const origin = userLocation ? `${userLocation.lat},${userLocation.lng}` : 'My+Location';
  const destination = userLocation ? `${userLocation.lat},${userLocation.lng}` : 'Home';
  return `https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${stops}/${encodeURIComponent(destination)}/data=!4m2!4m1!3e2`;
}

function quantitySource(line: CartLine) {
  const meta = line.group_metadata || {};
  const metaLine = Array.isArray(meta.lines)
    ? (meta.lines as Record<string, unknown>[]).find((item) => item.product_id === line.product.id)
    : null;
  return {
    quantity_recipe: (meta.quantity_recipe ?? metaLine?.quantity_recipe) as string | number | null | undefined,
    quantity_purchase: (meta.quantity_purchase ?? metaLine?.quantity_purchase) as string | null | undefined,
    quantity_g: (meta.quantity_g ?? metaLine?.quantity_g) as string | number | null | undefined,
    pack_grams: (meta.pack_grams ?? metaLine?.pack_grams) as string | number | null | undefined,
    product: {
      unit: ((meta.unit ?? metaLine?.unit) as string | null | undefined) ?? line.product.unit,
      unit_size: ((meta.unit_size ?? metaLine?.unit_size) as string | null | undefined) ?? line.product.unit_size,
    },
  };
}

export function Cart({
  shops = [],
  onCheckout,
  onClearRequest,
  onDiscover,
}: {
  shops?: Shop[];
  onCheckout?: () => void;
  onClearRequest?: () => void;
  onDiscover?: () => void;
}) {
  const cart = useCart();
  const { slot, picked, setSlot } = useSlot();
  const { location } = useUserLocation();
  const [pickerOpen, setPickerOpen] = useState(false);
  // Closed-shop check drives whether "Now (priority)" is offered.
  // Standard slots stay available regardless — `create_multishop_group`
  // validates them against the booked window, not "open right now".
  const { closedShops } = useCartShopsOpenStatus(cart.cartIds);
  const nowDisabled = closedShops.length > 0;

  // The "Schedule" leg of the segmented control should always show a
  // standard slot in its label, even if the user is currently on Now.
  // We remember the last standard pick so toggling Now ↔ Schedule
  // doesn't lose their day/window choice.
  const [lastScheduled, setLastScheduled] = useState<Slot>(() =>
    picked && picked.kind === 'standard' ? picked : earliestStandardSlot(),
  );

  const shopById = useMemo(() => {
    const map = new Map<string, Shop>();
    for (const s of shops) map.set(s.id, s);
    return map;
  }, [shops]);

  const closedShopsForPicker = useMemo(
    () =>
      closedShops.map((s) => ({
        shop_id: s.shop_id ?? '',
        shop_name: s.shop_id ? shopById.get(s.shop_id)?.name : undefined,
        next_open_at: s.next_open_at,
      })),
    [closedShops, shopById],
  );

  // If the user previously picked "Now (priority)" but the basket now
  // contains a closed shop, slide them onto the earliest standard slot
  // so they aren't fighting a guaranteed-failure pre-flight at pay time.
  useEffect(() => {
    if (nowDisabled && slot.kind === 'priority') {
      setSlot(earliestStandardSlot());
    }
  }, [nowDisabled, slot.kind, setSlot]);

  // Bucket lines: recipe groups (by group_id) and standalone shop groups.
  const buckets = useMemo(() => {
    const recipeMap = new Map<
      string,
      { meta: RecipeMeta; linesByShop: Map<string, CartLine[]> }
    >();
    const standaloneByShop = new Map<string, CartLine[]>();
    for (const line of cart.lines) {
      const rec = recipeMeta(line);
      if (rec && line.group_id) {
        let bucket = recipeMap.get(line.group_id);
        if (!bucket) {
          bucket = { meta: rec, linesByShop: new Map() };
          recipeMap.set(line.group_id, bucket);
        }
        const shopId = line.product.shop_id;
        const existing = bucket.linesByShop.get(shopId) ?? [];
        existing.push(line);
        bucket.linesByShop.set(shopId, existing);
        continue;
      }
      const shopId = line.product.shop_id;
      const existing = standaloneByShop.get(shopId) ?? [];
      existing.push(line);
      standaloneByShop.set(shopId, existing);
    }
    return { recipeMap, standaloneByShop };
  }, [cart.lines]);

  const itemSubtotal = cart.totalEur;
  // Fees are defined by slot *kind* so persisted slots always match
  // current pricing (localStorage may carry an old `feeEur`).
  const serviceFee =
    slot?.kind === 'priority' ? SERVICE_FEE_PRIORITY_EUR : SERVICE_FEE_STANDARD_EUR;
  const orderTotal = itemSubtotal + serviceFee;

  if (cart.lines.length === 0) {
    return <EmptyBasketSkeleton onDiscover={onDiscover} />;
  }

  const isNow = slot.kind === 'priority';
  const scheduledLabel = lastScheduled.label;
  const orderedShops = Array.from(
    new Map(
      cart.lines
        .map((line) => shopById.get(line.product.shop_id) ?? null)
        .filter((shop): shop is Shop => Boolean(shop))
        .map((shop) => [shop.id, shop]),
    ).values(),
  );
  const journeyHref = fullJourneyHref(orderedShops, location);
  const shopWalkingMinutes = (shop: Shop | null): number | null => {
    const ll = shopLatLng(shop);
    if (!ll || !location) return null;
    return walkingMinutes(location, ll);
  };

  return (
    <div className="vitrina-bsk">
      <div className="vitrina-bsk-scroll">
      {/*
        Pickup card — "Now" and "Schedule" share the same two-row
        layout so the eye reads:
          row 1: title (+ price for Schedule, since Schedule's "value
                 prop" is that it's the cheaper standard fee)
          row 2: detail subtitle ("Ready in 30 min" / the chosen
                 day+window)
        We deliberately drop the old "Pickup … ready in ~30 min" hint
        in the header — the same information now lives under the Now
        pill, and the totals row at the bottom carries the fee.
      */}
      <section className="vitrina-bsk-pickup" aria-label="Pickup time">
        <header className="vitrina-bsk-pickup__head">
          <span className="vitrina-bsk-pickup__title">Pickup</span>
        </header>

        <div className="vitrina-bsk-pickup__seg" role="tablist" aria-label="Pickup type">
          <button
            type="button"
            role="tab"
            aria-selected={isNow && !nowDisabled}
            className={`vitrina-bsk-pickup__opt ${isNow && !nowDisabled ? 'is-active' : ''} ${nowDisabled ? 'is-disabled' : ''}`}
            onClick={() => {
              if (nowDisabled) {
                setPickerOpen(true);
                return;
              }
              setSlot(priorityNow());
            }}
            disabled={nowDisabled}
            aria-disabled={nowDisabled}
            title={
              nowDisabled
                ? `Now unavailable — ${closedShops.length === 1 ? 'a shop is' : 'some shops are'} closed right now`
                : undefined
            }
          >
            <span className="vitrina-bsk-pickup__opt-row">
              <Zap size={15} strokeWidth={2.4} />
              <strong>Now</strong>
            </span>
            <span className="vitrina-bsk-pickup__opt-detail">
              {nowDisabled ? 'Closed right now' : 'Ready in 30 min'}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={!isNow}
            className={`vitrina-bsk-pickup__opt vitrina-bsk-pickup__opt--schedule ${
              !isNow ? 'is-active' : ''
            }`}
            onClick={() => {
              if (isNow) {
                setSlot(lastScheduled);
              } else {
                setPickerOpen(true);
              }
            }}
          >
            <span className="vitrina-bsk-pickup__opt-row">
              <CalendarClock size={15} strokeWidth={2.2} />
              <strong>Schedule</strong>
              <span className="vitrina-bsk-pickup__opt-fee">
                €{SERVICE_FEE_STANDARD_EUR.toFixed(2)}
              </span>
              {!isNow ? <ChevronDown size={14} strokeWidth={2.2} /> : null}
            </span>
            <span className="vitrina-bsk-pickup__opt-detail">{scheduledLabel}</span>
          </button>
        </div>
        {journeyHref ? (
          <a
            className="vitrina-bsk-journey"
            href={journeyHref}
            target="_blank"
            rel="noreferrer"
          >
            <Route size={15} strokeWidth={2.2} aria-hidden />
            Preview full journey
          </a>
        ) : null}
      </section>

      {Array.from(buckets.recipeMap.entries()).map(([groupId, bucket]) => (
        <section key={groupId} className="vitrina-bsk-recipe">
          <header className="vitrina-bsk-recipe__head">
            <div className="vitrina-bsk-recipe__poster" aria-hidden>
              {bucket.meta.cover_url ? (
                <img src={bucket.meta.cover_url} alt="" loading="lazy" />
              ) : (
                <span>{(bucket.meta.title || '·').slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="vitrina-bsk-recipe__title">
              <strong>{bucket.meta.title}</strong>
              <span>Recipe · {Array.from(bucket.linesByShop.values()).reduce((n, l) => n + l.length, 0)} items</span>
            </div>
            {bucket.meta.video_id ? (
              <button
                type="button"
                className="vitrina-bsk-recipe__see"
                onClick={() => {
                  if (bucket.meta.video_id) {
                    void openRecipeById(bucket.meta.video_id).catch(() => {
                      if (bucket.meta.source_url) {
                        window.open(bucket.meta.source_url, '_blank', 'noopener,noreferrer');
                      }
                    });
                  }
                }}
              >
                See recipe
              </button>
            ) : null}
          </header>
          {Array.from(bucket.linesByShop.entries()).map(([shopId, lines]) => {
            const shop = shopById.get(shopId) ?? null;
            return (
              <ShopGroup
                key={shopId}
                name={shop?.name ?? shopId}
                address={shop?.address ?? shop?.city ?? null}
                walkingMinutes={shopWalkingMinutes(shop)}
                directionsHref={directionsHref(shop)}
              >
                {lines.map((line) => (
                  <IngredientRow
                    key={line.id}
                    name={ingredientName(line)}
                    quantity={line.product.unit ?? null}
                    quantityBreakdown={ingredientQuantityBreakdown(quantitySource(line), {
                      cartQuantity: line.quantity,
                    })}
                    imageUrl={line.product.image_url ?? null}
                    right={
                      <BasketRight
                        line={line}
                        onIncrement={() => cart.setQuantity(line.product.id, line.quantity + 1)}
                        onDecrement={() => cart.setQuantity(line.product.id, line.quantity - 1)}
                      />
                    }
                  />
                ))}
              </ShopGroup>
            );
          })}
        </section>
      ))}

      {buckets.standaloneByShop.size > 0 ? (
        <section className="vitrina-bsk-standalone">
          {Array.from(buckets.standaloneByShop.entries()).map(([shopId, lines]) => {
            const shop = shopById.get(shopId) ?? null;
            return (
              <ShopGroup
                key={shopId}
                name={shop?.name ?? shopId}
                address={shop?.address ?? shop?.city ?? null}
                walkingMinutes={shopWalkingMinutes(shop)}
                directionsHref={directionsHref(shop)}
              >
                {lines.map((line) => (
                  <IngredientRow
                    key={line.id}
                    name={line.product.name}
                    quantity={line.product.unit ?? null}
                    imageUrl={line.product.image_url ?? null}
                    right={
                      <BasketRight
                        line={line}
                        onIncrement={() => cart.setQuantity(line.product.id, line.quantity + 1)}
                        onDecrement={() => cart.setQuantity(line.product.id, line.quantity - 1)}
                      />
                    }
                  />
                ))}
              </ShopGroup>
            );
          })}
        </section>
      ) : null}

      <button type="button" onClick={onClearRequest ?? cart.clear} className="vitrina-bsk-clear">
        Clear basket
      </button>
      </div>

      {/* Pinned pay-bar: totals + Checkout CTA stay glued to the bottom
          of the basket sheet's scroll viewport (Deliveroo-style), so
          the user always knows what they're about to pay regardless of
          how far they've scrolled into long recipe groups. */}
      <footer className="vitrina-bsk-paybar">
        <div className="vitrina-bsk-totals">
          <div className="vitrina-bsk-totals__row">
            <span>Subtotal</span>
            <span>€{itemSubtotal.toFixed(2)}</span>
          </div>
          <div className="vitrina-bsk-totals__row">
            <span className="vitrina-bsk-totals__fee">
              <Receipt size={14} strokeWidth={2} />
              Service fee
              {slot?.kind === 'priority' ? <em> Priority</em> : slot ? <em> Standard</em> : null}
            </span>
            <span>€{serviceFee.toFixed(2)}</span>
          </div>
          <div className="vitrina-bsk-totals__row vitrina-bsk-totals__row--bold">
            <span>Order total</span>
            <strong>€{orderTotal.toFixed(2)}</strong>
          </div>
        </div>
        <button
          type="button"
          className="vitrina-bsk-checkout"
          onClick={onCheckout}
          disabled
        >
          Checkout unavailable in demo
        </button>
      </footer>

      {pickerOpen ? (
        <SchedulePickerModal
          current={slot}
          closedShopsNow={closedShopsForPicker}
          onClose={() => setPickerOpen(false)}
          onChoose={(s: Slot) => {
            setSlot(s);
            if (s.kind === 'standard') setLastScheduled(s);
            setPickerOpen(false);
          }}
        />
      ) : null}

      <style>{`
        .vitrina-bsk {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
        }
        /* The scrollable viewport: pickup card, recipe groups, standalone
           groups, and the Clear-basket button all live here. The paybar
           below is a non-scrolling sibling so totals + Checkout CTA stay
           visible at all times, regardless of how far the user scrolls. */
        .vitrina-bsk-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 14px 14px 12px;
        }
        /* Pinned paybar at the foot of the basket panel. Stays put while
           the items list scrolls. The thin top divider and cream
           background visually separate it from the scrolling content
           without needing a hard shadow. */
        .vitrina-bsk-paybar {
          flex-shrink: 0;
          padding: 10px 14px calc(env(safe-area-inset-bottom, 0px) + 14px);
          background: var(--color-cream);
          border-top: 1px solid color-mix(in srgb, var(--color-ink) 8%, transparent);
        }
        .vitrina-bsk-pickup {
          display: grid;
          gap: 8px;
          padding: 12px 14px 14px;
          border-radius: 6px;
          background: var(--color-card);
          box-shadow: 0 1px 0 color-mix(in srgb, var(--color-ink) 6%, transparent);
        }
        .vitrina-bsk-pickup__head {
          display: flex;
          align-items: baseline;
          gap: 10px;
        }
        .vitrina-bsk-pickup__title {
          font-family: var(--font-display);
          font-size: 0.95rem;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: var(--color-ink);
        }
        .vitrina-bsk-pickup__seg {
          display: grid;
          grid-template-columns: 1fr 1.6fr;
          gap: 6px;
          padding: 4px;
          border-radius: 6px;
          background: color-mix(in srgb, var(--color-ink) 5%, transparent);
        }
        .vitrina-bsk-pickup__opt {
          display: grid;
          gap: 2px;
          padding: 8px 10px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: var(--color-ink-light);
          font: inherit;
          text-align: left;
          cursor: pointer;
          transition: background 140ms ease, color 140ms ease, box-shadow 140ms ease;
        }
        .vitrina-bsk-pickup__opt:hover {
          color: var(--color-ink);
        }
        .vitrina-bsk-pickup__opt.is-active {
          background: var(--color-card);
          color: var(--color-ink);
          box-shadow: 0 1px 2px color-mix(in srgb, var(--color-ink) 14%, transparent);
        }
        .vitrina-bsk-pickup__opt.is-disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .vitrina-bsk-pickup__opt.is-disabled:hover {
          color: var(--color-ink-light);
        }
        .vitrina-bsk-pickup__opt-row {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-display);
          font-size: 0.92rem;
          font-weight: 600;
        }
        /* Schedule's price sits inline next to the title; tabular nums
           keep the digits stable when the slot updates. */
        .vitrina-bsk-pickup__opt-fee {
          margin-left: 2px;
          font-size: 0.78rem;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: var(--color-ink);
          opacity: 0.85;
        }
        .vitrina-bsk-pickup__opt-detail {
          font-size: 0.78rem;
          color: var(--color-ink-light);
          font-variant-numeric: tabular-nums;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .vitrina-bsk-pickup__opt.is-active .vitrina-bsk-pickup__opt-detail {
          color: color-mix(in srgb, var(--color-ink) 80%, transparent);
        }
        .vitrina-bsk-journey {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 12px;
          border-radius: 6px;
          background: color-mix(in srgb, var(--color-ink) 5%, transparent);
          color: var(--color-ink);
          font-family: var(--font-display);
          font-size: 0.9rem;
          font-weight: 600;
          text-align: center;
          text-decoration: none;
          transition: background 140ms ease;
        }
        /* Lucide's Route icon already conveys "multi-stop trip"; we
           dim it slightly so the lockup reads as one calm affordance. */
        .vitrina-bsk-journey svg { opacity: 0.85; }
        .vitrina-bsk-journey:hover,
        .vitrina-bsk-journey:focus-visible {
          background: color-mix(in srgb, var(--color-ink) 9%, transparent);
          outline: none;
        }
        .vitrina-bsk-clear {
          justify-self: center;
          margin-top: 8px;
          padding: 8px 14px;
          background: transparent;
          border: 0;
          color: var(--color-ink-light);
          font-size: 0.82rem;
          font-family: inherit;
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
          border-radius: 6px;
        }
        .vitrina-bsk-clear:hover { color: var(--color-ink); }

        /* Recipe-bucket card has a left accent + circular poster so the
           viewer can instantly tell "this lump of items belongs to a
           recipe" vs a standalone shop. */
        .vitrina-bsk-recipe {
          position: relative;
          display: grid;
          gap: 0;
          padding: 12px 14px 4px;
          border-radius: 6px;
          background: var(--color-card);
          box-shadow: inset 3px 0 0 var(--color-dijon, #d4a017);
        }
        .vitrina-bsk-recipe__head {
          display: grid;
          grid-template-columns: 44px 1fr auto;
          align-items: center;
          gap: 12px;
          padding-bottom: 8px;
          margin-bottom: 4px;
          border-bottom: 1px solid color-mix(in srgb, var(--color-ink) 8%, transparent);
        }
        .vitrina-bsk-recipe__poster {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          overflow: hidden;
          background: color-mix(in srgb, var(--color-ink) 8%, transparent);
          display: grid;
          place-items: center;
          font-family: var(--font-display);
          font-weight: 700;
          color: var(--color-ink-light);
        }
        .vitrina-bsk-recipe__poster img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .vitrina-bsk-recipe__title {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .vitrina-bsk-recipe__title strong {
          font-family: var(--font-display);
          font-size: 1.02rem;
          font-weight: 600;
          color: var(--color-ink);
          letter-spacing: -0.005em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .vitrina-bsk-recipe__title span {
          color: var(--color-ink-light);
          font-size: 0.78rem;
        }
        /* Black "See recipe" pill — opens the in-app recipe modal
           (same surface as Discover). Matches the primary checkout CTA
           tonally so the affordance reads as a real action, not a
           tertiary icon link. */
        .vitrina-bsk-recipe__see {
          padding: 7px 12px;
          border: 0;
          border-radius: 999px;
          background: #111;
          color: var(--color-cream);
          font-family: var(--font-display);
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.005em;
          cursor: pointer;
          white-space: nowrap;
          transition: background 140ms ease, transform 140ms ease;
        }
        .vitrina-bsk-recipe__see:hover { background: #000; }
        .vitrina-bsk-recipe__see:active { transform: scale(0.98); }

        .vitrina-bsk-standalone {
          display: grid;
          gap: 0;
          padding: 4px 14px 4px;
          border-radius: 6px;
          background: var(--color-card);
        }

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
        .vitrina-bsk-totals__row--bold strong {
          font-weight: 700;
        }
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

        /* Right cell of an ingredient row in the basket: line price +
           qty stepper, stacked tightly so the stepper doesn't dominate. */
        .vitrina-bsk-right {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .vitrina-bsk-right__price {
          color: var(--color-ink);
          font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
          font-size: 0.84rem;
          font-variant-numeric: tabular-nums;
          min-width: 3.6em;
          text-align: right;
        }
      `}</style>
    </div>
  );
}

interface BasketRightProps {
  line: CartLine;
  onIncrement: () => void;
  onDecrement: () => void;
}

function BasketRight({ line, onIncrement, onDecrement }: BasketRightProps) {
  const lineTotal = line.product.price_eur * line.quantity;
  return (
    <div className="vitrina-bsk-right">
      <span className="vitrina-bsk-right__price">€{lineTotal.toFixed(2)}</span>
      <QtyStepper
        qty={line.quantity}
        onDecrement={onDecrement}
        onIncrement={onIncrement}
      />
    </div>
  );
}

function EmptyBasketSkeleton({ onDiscover }: { onDiscover?: () => void }) {
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  useEffect(() => {
    let alive = true;
    listOrders()
      .then((rows) => {
        if (!alive) return;
        const uncollected = rows.find((o) => !o.collected_at && o.status !== 'cancelled');
        setActiveOrder(uncollected ?? null);
      })
      .catch(() => {/* silently ignore auth/network errors in empty state */});
    return () => { alive = false; };
  }, []);

  return (
    <div className="vitrina-cart-empty" aria-label="Empty basket preview">
      {activeOrder ? (
        <a
          className="vitrina-cart-empty__order-card"
          href={activeOrder.permalink_url || `/orders/${activeOrder.id}`}
        >
          <div className="vitrina-cart-empty__order-card__label">Ready to collect</div>
          <div className="vitrina-cart-empty__order-card__date">
            {activeOrder.created_at
              ? new Date(activeOrder.created_at).toLocaleString(undefined, {
                  weekday: 'short', month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })
              : 'Recent order'}
          </div>
          {activeOrder.collect_code ? (
            <div className="vitrina-cart-empty__order-card__code">
              Code: {activeOrder.collect_code}
            </div>
          ) : null}
          <div className="vitrina-cart-empty__order-card__total">
            {formatMinor(orderTotalMinor(activeOrder), activeOrder.currency)}
          </div>
        </a>
      ) : null}
      <img
        className="vitrina-cart-empty__doodle"
        src="/waiting-assets/doodles/vitrina-can.png"
        alt=""
        loading="lazy"
      />
      <h3>Your basket is empty</h3>
      <p>Add ingredients from Discover or any nearby shop — they'll group by recipe and pickup point here.</p>
      {onDiscover ? (
        <button
          type="button"
          className="vitrina-cart-empty__discover-cta"
          onClick={onDiscover}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
          Browse recipes
        </button>
      ) : null}
      <style>{`
        .vitrina-cart-empty {
          display: grid;
          place-items: center;
          gap: 10px;
          padding: 36px 18px;
          color: var(--color-ink-light);
          text-align: center;
        }
        .vitrina-cart-empty__order-card {
          display: grid;
          gap: 4px;
          width: 100%;
          max-width: 280px;
          padding: 14px 16px;
          border-radius: 10px;
          background: color-mix(in srgb, var(--color-accent, #3b82f6) 10%, var(--color-card));
          border: 1.5px solid color-mix(in srgb, var(--color-accent, #3b82f6) 30%, transparent);
          text-decoration: none;
          color: var(--color-ink);
          text-align: left;
          margin-bottom: 8px;
          transition: background 140ms ease;
        }
        .vitrina-cart-empty__order-card:hover {
          background: color-mix(in srgb, var(--color-accent, #3b82f6) 16%, var(--color-card));
        }
        .vitrina-cart-empty__order-card__label {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-accent, #3b82f6);
        }
        .vitrina-cart-empty__order-card__date {
          font-family: var(--font-display);
          font-size: 0.95rem;
          font-weight: 600;
        }
        .vitrina-cart-empty__order-card__code {
          font-size: 0.84rem;
          color: var(--color-accent, #3b82f6);
          font-weight: 500;
        }
        .vitrina-cart-empty__order-card__total {
          font-variant-numeric: tabular-nums;
          font-size: 0.88rem;
          color: var(--color-ink-light);
        }
        .vitrina-cart-empty__doodle {
          width: 120px;
          height: 120px;
          object-fit: contain;
          opacity: 0.85;
        }
        .vitrina-cart-empty h3 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.1rem;
          color: var(--color-ink);
          font-weight: 600;
        }
        .vitrina-cart-empty p {
          margin: 0;
          line-height: 1.5;
          max-width: 32ch;
          font-size: 0.92rem;
        }
        .vitrina-cart-empty__discover-cta {
          margin-top: 16px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 11px 20px;
          border: 0;
          border-radius: 999px;
          background: var(--color-ink);
          color: var(--color-cream);
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 140ms ease;
        }
        .vitrina-cart-empty__discover-cta:hover { opacity: 0.88; }
      `}</style>
    </div>
  );
}
