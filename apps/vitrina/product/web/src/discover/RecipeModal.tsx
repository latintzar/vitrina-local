/**
 * RecipeModal — full-screen "buyable recipe" view.
 *
 * Layout (2026-04-27 ② revision — Shopify-style portion picker, sticky
 * video, dual CTA):
 *
 *   - Top bar: chevron-back + small recipe title.
 *   - Video sits **fixed** behind the scroller (it doesn't move). The
 *     recipe card scrolls in front of the video and peeks ~110px above
 *     the footer at rest, hinting at scrollable content below.
 *   - Per-shop groups: shop name + walking-time pill (foot icon + N min).
 *     No subtotals, no city/distance blob, no trade label.
 *   - Substitution: a Replace chip next to the ingredient name opens a
 *     centred sheet with the matcher's culinary note (handled by
 *     IngredientRow). No bottom "Skipped/not carried" aside — every
 *     ingredient resolves or substitutes, no orphan skip lists.
 *   - Sticky footer:
 *       row 1: portion stepper + live total
 *       row 2: text-only **Modify recipe** secondary CTA (no fill, no
 *              border) — opens chat with thumbnail + "I want to modify
 *              this recipe" so Peter can ask the agent to swap
 *              ingredients, go vegetarian, drop allergens, etc.
 *       row 3: full-width solid **Add to Basket** primary CTA.
 *
 * Both CTAs hand off to chat via the same `onChatPrompt(prompt,
 * attachment)` callback, with the recipe poster + title attached so
 * the chat shows a sleek preview chip above the user bubble.
 */

import { useMemo, useState } from 'react';
import { addToCart, bumpOptimistic, endBurst, startBurst } from '../cart/useCart';
import type { VitrinaRecipeAttachment } from '../chat/uiMessageExtras';
import { ShopGroup } from '../components/ShopGroup';
import { IngredientRow, QtyStepper } from '../components/IngredientRow';
import { ingredientQuantityBreakdown } from '../components/ingredientQuantity';
import { useUserLocation } from '../location/useUserLocation';
import { RecipeEmbed } from './RecipeEmbed';
import { RecipeLikeButton } from './RecipeLikeButton';
import { fireRecipeLikeMem0, useRecipeLikes } from './recipeLikes';
import { thumbnailUrl, type RecipeVideoDetail } from './recipeVideosApi';

export interface RecipeModalProps {
  detail: RecipeVideoDetail;
  onClose: () => void;
  onOpenBasket: () => void;
  /** Emitted when either CTA (Add to Basket / Modify recipe) is tapped —
   *  parent injects the prompt into chat + switches tab. The optional
   *  attachment shows up as a thumbnail+title preview chip above the
   *  user's message bubble. */
  onChatPrompt?: (prompt: string, attachment?: VitrinaRecipeAttachment) => void;
  /** Emitted when Add to Basket is tapped — parent owns the flight overlay
   *  so the modal can close instantly without gating the chat handoff. */
  onAddedToBasket?: (posterUrl: string | null, recipeTitle: string) => void;
  /** Legacy prop kept for backwards compat with App.tsx until that callsite migrates. */
  onBuildBasket?: (video: { source: RecipeVideoDetail['source']; title: string; url: string }) => void;
}

function formatPrice(value: number | undefined | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `€${value.toFixed(2)}`;
}

export function RecipeModal({
  detail,
  onClose,
  onOpenBasket,
  onChatPrompt,
  onAddedToBasket,
  onBuildBasket,
}: RecipeModalProps) {
  void onBuildBasket;
  void onOpenBasket;
  const { isLiked, toggle } = useRecipeLikes();
  const liked = isLiked(detail.id);
  const [adding, setAdding] = useState(false);
  const recipe = detail.recipe ?? {};
  const baseServings = useMemo(() => {
    const fromRecipe = recipe.servings?.quantity;
    return typeof fromRecipe === 'number' && fromRecipe > 0 ? fromRecipe : 4;
  }, [recipe.servings?.quantity]);
  const [portions, setPortions] = useState(baseServings);

  const match = detail.match ?? null;
  const rawGroups = detail.stock_groups ?? [];
  const blockers = match?.blockers ?? [];

  // Best-effort walking-time enrichment when the backend match was
  // computed without a user pin (e.g. universal cached match). 5 km/h
  // average + 1.25 detour factor matches the backend formula.
  const { location: userLocation } = useUserLocation();
  const groups = useMemo(() => {
    if (!userLocation) return rawGroups;
    return rawGroups.map((group) => {
      const shop = group.shop;
      if (typeof shop.walking_minutes === 'number') return group;
      if (typeof shop.lat !== 'number' || typeof shop.lng !== 'number') return group;
      const dx = (shop.lng - userLocation.lng) * Math.cos((userLocation.lat * Math.PI) / 180) * 111;
      const dy = (shop.lat - userLocation.lat) * 111;
      const km = Math.sqrt(dx * dx + dy * dy);
      const minutes = Math.max(1, Math.round((km * 1.25) / 5 * 60));
      return { ...group, shop: { ...shop, distance_km: km, walking_minutes: minutes } };
    });
  }, [rawGroups, userLocation]);

  function shopMapsHref(shop: { name: string; lat?: number; lng?: number; address?: string }): string {
    if (typeof shop.lat === 'number' && typeof shop.lng === 'number') {
      return `https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`;
    }
    const q = `${shop.name} ${shop.address ?? ''}`.trim();
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  const ratio = baseServings > 0 ? portions / baseServings : 1;
  const itemBreakdown = (item: (typeof groups)[number]['items'][number]) =>
    ingredientQuantityBreakdown(item, { portionRatio: ratio });
  const liveTotal = groups.reduce(
    (sum, group) =>
      sum + group.items.reduce(
        (groupSum, item) => groupSum + item.product.price_eur * itemBreakdown(item).unitsNeeded,
        0,
      ),
    0,
  );

  const poster = thumbnailUrl(detail);

  const recipeAttachment: VitrinaRecipeAttachment = {
    thumbnailUrl: poster,
    recipeTitle: detail.recipe_title || detail.title,
    recipeId: detail.id,
  };

  // Instant feel from the user's POV — every step here is synchronous:
  //
  //  1. Bump the basket badge so the navbar counter jumps the same
  //     frame as the click (sync emit).
  //  2. Start a burst lock so parallel addToCart writes don't flicker
  //     the badge or get clobbered by a stale refresh.
  //  3. Hand off to chat IMMEDIATELY — useVitrinaChat now sends the
  //     SDK message synchronously (no await on thread create), so the
  //     user bubble appears the instant the chat tab swaps in.
  //  4. Notify App so it can play the flight overlay AS the modal
  //     closes — the user sees the recipe "land" on top of the chat
  //     tab, not blocked behind a still-open modal.
  //  5. Close the modal so the chat tab is visible right away.
  //  6. Fan out the cart writes in the background; endBurst on settle.
  const buyHandler = () => {
    if (adding) return;
    setAdding(true);

    const totalItems = groups.reduce(
      (acc, g) => acc + g.items.reduce((n, item) => n + itemBreakdown(item).unitsNeeded, 0),
      0,
    );
    bumpOptimistic(totalItems);
    startBurst();

    onChatPrompt?.(
      `Added ${detail.recipe_title} for ${portions} ${portions === 1 ? 'portion' : 'portions'}.`,
      recipeAttachment,
    );

    onAddedToBasket?.(poster, detail.recipe_title || detail.title);
    onClose();

    void Promise.all(
      groups.flatMap((group) =>
        group.items.map((item) => {
          const breakdown = itemBreakdown(item);
          return addToCart(item.product, breakdown.unitsNeeded, {
            group_id: detail.id,
            group_metadata: {
              source: 'recipe-video',
              video_id: detail.id,
              title: detail.recipe_title,
              ingredient: item.ingredient,
              source_url: detail.source_url,
              portions,
              base_portions: baseServings,
              quantity_recipe: item.quantity_recipe ?? item.quantity,
              quantity_purchase: item.quantity_purchase,
              quantity_g: item.quantity_g != null ? Number(item.quantity_g) * ratio : null,
              pack_grams: item.pack_grams,
              unit_size: item.product.unit_size,
              unit: item.product.unit,
              units_needed: breakdown.unitsNeeded,
            },
          }).catch(() => {});
        }),
      ),
    ).finally(() => {
      endBurst();
    });
  };

  // Modify-recipe handoff — same instant chat handoff as Add to Basket
  // (thumbnail attached, modal closes immediately) but no basket
  // mutation. The agent picks up the prompt and has a conversation
  // about how to adapt the recipe (vegetarian, no peanuts, swap to
  // chicken, scale up, etc.).
  const modifyHandler = () => {
    onChatPrompt?.(
      `I want to modify ${detail.recipe_title || detail.title} — what would you like to change about it (swap an ingredient, go vegetarian, scale up, drop an allergen)?`,
      recipeAttachment,
    );
    onClose();
  };

  const likeHandler = () => {
    const next = !liked;
    toggle(detail, next);
    fireRecipeLikeMem0(detail, next);
  };

  return (
    <div className="vitrina-recipe-modal" role="dialog" aria-modal="true">
      <header className="vitrina-recipe-topbar">
        <button
          type="button"
          className="vitrina-recipe-back"
          aria-label="Back"
          onClick={onClose}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2 title={detail.recipe_title}>{detail.recipe_title || detail.title}</h2>
        <RecipeLikeButton liked={liked} onPress={() => likeHandler()} className="vitrina-recipe-like" size={20} />
      </header>

      {/*
        Video lives in a fixed layer at the BACK of the modal. The
        scroller covers the full modal area on top of it (z-index 2),
        with a transparent top spacer that lets the video peek through
        when the card is at rest. As the user scrolls up, the opaque
        card slides IN FRONT OF the video — classic hero/sheet pattern.
      */}
      <div className="vitrina-recipe-video" aria-hidden={false}>
        <RecipeEmbed
          source={detail.source}
          sourceUrl={detail.source_url}
          sourceId={detail.source_id}
          creator={detail.creator}
          posterUrl={poster}
          video={detail}
        />
      </div>

      <div className="vitrina-recipe-scroller">
        {/* Transparent spacer that reveals the fixed video layer behind
            the scroller. Tapping inside this region does NOT hit the
            card; it lets the video receive native taps (play/pause on
            the local <video>, or platform play button on the iframe
            fallback). The card starts right below it. */}
        <div className="vitrina-recipe-video-spacer" aria-hidden="true" />

        <section className="vitrina-recipe-card">
          {/* Drag handle — purely visual, not interactive. */}
          <span className="vitrina-recipe-grabber" aria-hidden />

          {blockers.length > 0 ? (
            <aside className="vitrina-blocker-banner" role="alert">
              <strong>Missing {blockers.map((b) => b.ingredient).join(', ')}.</strong>
              <span>
                We don't carry {blockers.length === 1 ? 'this' : 'these'} in your catchment yet — the rest of the dish is buyable.
              </span>
            </aside>
          ) : null}
          {groups.length > 0 ? (
            <section className="vitrina-shop-groups">
              <h3 className="vitrina-shop-groups__title">Ingredients</h3>
              {groups.map((group) => (
                <div
                  key={group.shop.id}
                  className="vitrina-shop-link"
                >
                  <ShopGroup
                    name={group.shop.name}
                    address={group.shop.address ?? null}
                    walkingMinutes={group.shop.walking_minutes ?? null}
                    directionsHref={shopMapsHref(group.shop)}
                  >
                    {group.items.map((item) => (
                      <IngredientRow
                        key={`${group.shop.id}-${item.product.id}`}
                        name={item.ingredient || item.product.name}
                        substitution={item.substitution}
                        quantity={item.quantity}
                        quantityBreakdown={itemBreakdown(item)}
                        imageUrl={item.product.image_url ?? null}
                        right={
                          <span className="vitrina-irow__price">
                            {formatPrice(item.product.price_eur * itemBreakdown(item).unitsNeeded)}
                          </span>
                        }
                      />
                    ))}
                  </ShopGroup>
                </div>
              ))}
            </section>
          ) : (
            <p className="vitrina-recipe-empty">No matched shops yet.</p>
          )}

          {/* Skipped/not-carried aside removed — every ingredient now
              renders as either resolved or substituted (inline swap
              card under the row). Hard blockers still surface as the
              red banner at the top of the card. */}

          {/* Comment / description sits at the BOTTOM, not the top —
              we want shoppers to land on ingredients first and read
              the recipe blurb only if they're curious. (Peter, 2026-04). */}
          {match?.summary ? <p className="vitrina-recipe-summary">{match.summary}</p> : null}

          {detail.source_url ? <p className="vitrina-recipe-attribution">
            Original on{' '}
            <a href={detail.source_url} target="_blank" rel="noreferrer">
              {detail.source}
            </a>{' '}
            by {detail.creator}.
          </p> : null}

        </section>
      </div>

      <footer className="vitrina-recipe-footer" aria-label="Buy controls">
        <div className="vitrina-recipe-footer__row vitrina-recipe-footer__top">
          <div className="vitrina-recipe-portions">
            <QtyStepper
              qty={portions}
              size="md"
              showTrashAtOne={false}
              min={1}
              max={20}
              unitLabel={portions === 1 ? 'portion' : 'portions'}
              onDecrement={() => setPortions((p) => Math.max(1, p - 1))}
              onIncrement={() => setPortions((p) => Math.min(20, p + 1))}
            />
          </div>
          <span className="vitrina-recipe-total" aria-label="Total">
            €{liveTotal.toFixed(2)}
          </span>
        </div>
        {detail.source_url ? <button
          type="button"
          className="vitrina-recipe-modify"
          onClick={() => void modifyHandler()}
          disabled={adding}
        >
          Modify recipe
        </button> : null}
        <button
          type="button"
          className="vitrina-recipe-cta"
          onClick={() => void buyHandler()}
          disabled={adding || groups.length === 0}
        >
          {adding ? 'Adding…' : 'Add to Basket'}
        </button>
      </footer>

      <style>{`
        .vitrina-recipe-modal {
          position: fixed;
          inset: 0;
          z-index: 110;
          background: var(--color-cream);
          overflow: hidden;
        }
        .vitrina-recipe-topbar {
          position: absolute;
          top: 0; left: 0; right: 0;
          z-index: 4;
          display: grid;
          grid-template-columns: 36px 1fr 36px;
          align-items: center;
          gap: 8px;
          padding: calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px;
          background: color-mix(in srgb, var(--color-cream) 92%, transparent);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }
        .vitrina-recipe-topbar__spacer { display: block; }
        .vitrina-recipe-back {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          padding: 0;
          margin: 0;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: var(--color-ink);
          cursor: pointer;
        }
        .vitrina-recipe-back:hover { background: color-mix(in srgb, var(--color-ink) 6%, transparent); }
        .vitrina-recipe-like {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          padding: 0;
          margin: 0;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: var(--color-ink);
          cursor: pointer;
        }
        .vitrina-recipe-like:hover { background: color-mix(in srgb, var(--color-ink) 6%, transparent); }
        .vitrina-recipe-like[aria-pressed="true"] {
          color: color-mix(in srgb, var(--color-ink) 88%, #c41e3a 12%);
        }
        .vitrina-recipe-topbar h2 {
          margin: 0;
          color: var(--color-ink);
          font-family: var(--font-display);
          font-size: 1rem;
          font-weight: 600;
          line-height: 1.15;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: center;
        }

        /* Video layer — fixed at the BACK of the modal. The scroller
           sits on top of it (z-index 2). A transparent spacer at the
           top of the scroller lets this video peek through at rest,
           while the card slides up in FRONT of it as the user scrolls. */
        .vitrina-recipe-video {
          position: absolute;
          top: calc(env(safe-area-inset-top, 0px) + 56px);
          left: 0; right: 0;
          height: 57vh;
          z-index: 1;
          display: grid;
          place-items: center;
          padding: 8px 12px 0;
          pointer-events: auto;
        }
        .vitrina-recipe-video .vitrina-recipe-embed { width: 100%; max-width: 540px; }

        /* Scroller covers the full area below the topbar so the card
           can scroll in front of the video. The transparent spacer at
           the top of the scroller (.vitrina-recipe-video-spacer)
           creates the hero — taps in that region pass straight through
           to the video underneath thanks to pointer-events:none. */
        .vitrina-recipe-scroller {
          position: absolute;
          top: calc(env(safe-area-inset-top, 0px) + 56px);
          left: 0; right: 0; bottom: 0;
          z-index: 2;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          padding-bottom: calc(168px + env(safe-area-inset-bottom, 0px));
          background: transparent;
          /* The scroller covers the whole area below the topbar so the
             card can slide in front of the video. Without this, the
             scroller's own hit-test box swallows every tap above the
             card — including taps in the transparent spacer region —
             and the video below never sees the play/pause press. By
             making the scroller itself transparent to pointer events
             and re-enabling them on the card, the video at z-index:1
             becomes interactive in its peek-through area while the
             card stays fully tappable. The browser still scrolls when
             the card is touched and dragged. */
          pointer-events: none;
        }
        .vitrina-recipe-scroller > .vitrina-recipe-card { pointer-events: auto; }
        /* Reveals the fixed video layer behind the scroller and lets
           taps fall through to the <video>/iframe instead of being
           swallowed by the scroll container. */
        .vitrina-recipe-video-spacer {
          height: calc(57vh - 24px);
          pointer-events: none;
        }

        .vitrina-recipe-embed {
          position: relative;
          width: 100%;
          max-width: 540px;
          margin: 0 auto;
        }
        .vitrina-recipe-embed__poster {
          position: absolute;
          inset: 0;
          z-index: 0;
          border-radius: 6px;
          overflow: hidden;
          background: color-mix(in srgb, var(--color-cream-dark) 80%, transparent);
        }
        .vitrina-recipe-embed__poster img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.92;
        }
        .vitrina-recipe-embed__iframe {
          position: relative;
          z-index: 1;
          width: 100%;
          border: 0;
          border-radius: 6px;
          overflow: hidden;
          background: #000;
          display: block;
        }
        .vitrina-recipe-embed__iframe.is-portrait { aspect-ratio: 9 / 16; max-height: 57vh; }
        .vitrina-recipe-embed__iframe.is-landscape { aspect-ratio: 16 / 9; }
        .vitrina-recipe-embed__link {
          position: relative;
          z-index: 1;
          display: grid;
          place-items: center;
          width: 100%;
          aspect-ratio: 9 / 16;
          padding: 16px;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.04);
          color: var(--color-ink);
          font-family: var(--font-display);
          text-decoration: none;
        }

        .vitrina-recipe-card {
          position: relative;
          margin: 0 12px;
          padding: 12px 16px 22px;
          border-radius: 6px 6px 0 0;
          background: var(--color-card);
          box-shadow: 0 -22px 60px -42px rgba(0, 0, 0, 0.35);
          display: grid;
          gap: 12px;
          /* min-height lets the card scroll beyond the visible container */
          min-height: 85vh;
        }
        .vitrina-recipe-grabber {
          width: 38px;
          height: 4px;
          margin: 0 auto 6px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-ink) 18%, transparent);
        }

        .vitrina-blocker-banner {
          display: grid;
          gap: 4px;
          padding: 10px 12px;
          border-radius: 6px;
          background: #fdecec;
          color: #8a2120;
          font-size: 0.85rem;
          line-height: 1.35;
        }
        .vitrina-blocker-banner strong { font-weight: 600; }
        .vitrina-blocker-banner span { color: #8a2120; opacity: 0.85; }
        .vitrina-recipe-summary {
          margin: 0;
          color: var(--color-ink-light);
          font-size: 0.86rem;
          line-height: 1.45;
        }
        .vitrina-recipe-empty {
          margin: 0;
          padding: 14px;
          color: var(--color-ink-light);
          text-align: center;
          background: color-mix(in srgb, var(--color-cream) 70%, transparent);
          border-radius: 6px;
          font-size: 0.86rem;
        }
        .vitrina-shop-groups { display: grid; gap: 4px; }
        .vitrina-shop-groups__title {
          margin: 4px 0 0;
          font-family: var(--font-display);
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--color-ink);
          letter-spacing: -0.005em;
        }
        /* Each shop block exposes its own directions button via ShopGroup,
           mirroring the basket so recipe and basket affordances match. */
        .vitrina-shop-link {
          display: block;
          color: inherit;
          text-decoration: none;
          border-radius: 6px;
          transition: background 140ms ease;
        }
        .vitrina-shop-link:hover,
        .vitrina-shop-link:focus-visible {
          background: color-mix(in srgb, var(--color-ink) 4%, transparent);
          outline: none;
        }
        .vitrina-recipe-attribution {
          margin: 0;
          color: var(--color-ink-light);
          font-size: 0.78rem;
        }
        .vitrina-recipe-attribution a {
          color: var(--color-ink);
          text-underline-offset: 3px;
        }

        .vitrina-recipe-footer {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 5;
          display: grid;
          gap: 10px;
          padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
          background: var(--color-card);
          border-top: 1px solid color-mix(in srgb, var(--color-ink) 8%, transparent);
          box-shadow: 0 -10px 36px -22px color-mix(in srgb, var(--color-ink) 50%, transparent);
        }
        .vitrina-recipe-footer__row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .vitrina-recipe-footer__top {
          justify-content: space-between;
        }
        /* Bare stepper (no pill background) — portions + unit label
           sit naked on the cream footer. The total sits on the same
           row, hard right-aligned, so the eye reads
           "4 portions ........ €27.35" before dropping to the CTA. */
        .vitrina-recipe-portions .vitrina-stepper {
          background: transparent !important;
          padding: 0 !important;
        }
        .vitrina-recipe-total {
          font-family: var(--font-display);
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--color-ink);
          font-variant-numeric: tabular-nums;
        }

        /* Modify-recipe — text-only secondary CTA. Sits ABOVE the
           solid Add to Basket so the visual hierarchy is clear: the
           bold primary action is at the bottom of the footer (closest
           to thumb), the lower-stakes "talk to the agent" action is
           a tap above it. No fill, no border — letting the cream
           footer breathe. */
        .vitrina-recipe-modify {
          display: block;
          width: 100%;
          padding: 8px 12px;
          border: 0;
          background: transparent;
          color: var(--color-ink);
          font-family: var(--font-display);
          font-size: 0.92rem;
          font-weight: 500;
          letter-spacing: 0.005em;
          cursor: pointer;
          text-align: center;
          opacity: 0.78;
          transition: opacity 140ms ease;
          border-radius: 6px;
        }
        .vitrina-recipe-modify:hover { opacity: 1; }
        .vitrina-recipe-modify:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .vitrina-recipe-cta {
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
          letter-spacing: 0.005em;
          cursor: pointer;
          transition: background 140ms ease, transform 140ms ease;
        }
        .vitrina-recipe-cta:hover { background: #000; }
        .vitrina-recipe-cta:active { transform: scale(0.99); }
        .vitrina-recipe-cta:disabled {
          background: color-mix(in srgb, var(--color-ink) 30%, transparent);
          color: color-mix(in srgb, var(--color-cream) 80%, transparent);
          cursor: not-allowed;
        }
        .vitrina-irow__price {
          font-variant-numeric: tabular-nums;
          color: var(--color-ink);
          font-size: 0.92rem;
        }
      `}</style>
    </div>
  );
}
