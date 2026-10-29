/**
 * Basket summary chat widget.
 *
 * Live-bound to `useCart()` so a card sent earlier in the chat keeps
 * matching the actual basket as the user adds / removes / pays. The
 * card shows:
 *
 *   - per-recipe rows  (name × portions, item count, shop count)
 *   - per-shop rows    for any items that aren't in a recipe group
 *   - subtotal / service fee / order total
 *   - a black "Check out" CTA below the totals (no amount on the
 *     button — total is repeated above only); right-aligned, 6px radius
 *
 * The widget reads `group_metadata` written by both
 *   - `recipes.add_to_basket`  (origin: 'chat',         name, serves, recipe_id)
 *   - Discover RecipeModal      (source: 'recipe-video', title, video_id)
 * so chat-added and discover-added recipes both surface here without
 * any backend changes.
 */

import {
  SERVICE_FEE_PRIORITY_EUR,
  SERVICE_FEE_STANDARD_EUR,
  useSlot,
} from '../../cart/fulfillment';
import { openBasket } from '../../cart/basketViewer';
import { useCart, type CartLine } from '../../cart/useCart';
import { ChatWidgetShell } from './ChatWidgetShell';

interface RecipeBucket {
  key: string;
  name: string;
  serves?: number;
  itemCount: number;
  shopIds: Set<string>;
}

function recipeKey(line: CartLine): string | null {
  const gid = line.group_id;
  if (!gid) return null;
  const meta = line.group_metadata || {};
  // Either origin (chat add) or source (discover add) marks this line
  // as belonging to a recipe; otherwise treat it as a standalone shop
  // item (lumped at the bottom).
  if (meta.origin === 'chat' || meta.source === 'recipe-video') return gid;
  if (typeof gid === 'string' && gid.startsWith('rcp_')) return gid;
  return null;
}

function recipeName(line: CartLine, fallback: string): string {
  const meta = line.group_metadata || {};
  if (typeof meta.name === 'string' && meta.name.trim()) return meta.name;
  if (typeof meta.title === 'string' && meta.title.trim()) return meta.title;
  return fallback;
}

function recipeServes(line: CartLine): number | undefined {
  const meta = line.group_metadata || {};
  if (typeof meta.serves === 'number' && meta.serves > 0) return meta.serves;
  return undefined;
}

function bucketLines(lines: CartLine[]): {
  recipes: RecipeBucket[];
  loose: { shopIds: Set<string>; itemCount: number };
} {
  const recipes = new Map<string, RecipeBucket>();
  const loose = { shopIds: new Set<string>(), itemCount: 0 };
  for (const line of lines) {
    const key = recipeKey(line);
    const shopId = line.product.shop_id;
    if (key) {
      let bucket = recipes.get(key);
      if (!bucket) {
        bucket = {
          key,
          name: recipeName(line, 'Recipe'),
          serves: recipeServes(line),
          itemCount: 0,
          shopIds: new Set<string>(),
        };
        recipes.set(key, bucket);
      }
      bucket.itemCount += 1;
      if (shopId) bucket.shopIds.add(shopId);
    } else {
      loose.itemCount += 1;
      if (shopId) loose.shopIds.add(shopId);
    }
  }
  return { recipes: [...recipes.values()], loose };
}

export function BasketSummaryWidget() {
  const cart = useCart();
  const { slot } = useSlot();
  const serviceFee =
    slot?.kind === 'priority' ? SERVICE_FEE_PRIORITY_EUR : SERVICE_FEE_STANDARD_EUR;
  const subtotal = cart.totalEur;
  const total = subtotal + serviceFee;
  const allShops = new Set(
    cart.lines.map((l) => l.product.shop_id).filter(Boolean) as string[],
  );
  const empty = cart.totalItems === 0;
  const { recipes, loose } = bucketLines(cart.lines);

  const headlineSummary = empty
    ? 'Your basket is empty'
    : `${cart.totalItems} ${cart.totalItems === 1 ? 'item' : 'items'} · ${allShops.size} ${allShops.size === 1 ? 'shop' : 'shops'}`;

  return (
    <ChatWidgetShell eyebrow="Basket" title={headlineSummary}>
      {empty ? null : (
        <div className="vitrina-basket-summary">
          {recipes.length > 0 ? (
            <ul className="vitrina-basket-summary__recipes">
              {recipes.map((r) => {
                const portions = r.serves ? ` · ${r.serves} portions` : '';
                const ing = `${r.itemCount} ${r.itemCount === 1 ? 'ingredient' : 'ingredients'}`;
                const shops = `${r.shopIds.size} ${r.shopIds.size === 1 ? 'shop' : 'shops'}`;
                return (
                  <li key={r.key}>
                    <span className="vitrina-basket-summary__recipe-name">
                      {r.name}
                      {portions}
                    </span>
                    <span className="vitrina-basket-summary__recipe-meta">
                      {ing} · {shops}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {loose.itemCount > 0 ? (
            <p className="vitrina-basket-summary__loose">
              {loose.itemCount} {loose.itemCount === 1 ? 'extra item' : 'extra items'}
              {loose.shopIds.size
                ? ` · ${loose.shopIds.size} ${loose.shopIds.size === 1 ? 'shop' : 'shops'}`
                : ''}
            </p>
          ) : null}
          <dl className="vitrina-basket-summary__rows">
            <div>
              <dt>Subtotal</dt>
              <dd>€{subtotal.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Service fee</dt>
              <dd>€{serviceFee.toFixed(2)}</dd>
            </div>
            <div className="vitrina-basket-summary__total">
              <dt>Total</dt>
              <dd>€{total.toFixed(2)}</dd>
            </div>
          </dl>
          <div className="vitrina-basket-summary__cta">
            <button type="button" className="vitrina-basket-summary__checkout" onClick={openBasket}>
              Check out
            </button>
          </div>
        </div>
      )}
      <style>{`
        .vitrina-basket-summary {
          display: grid;
          gap: 12px;
        }
        .vitrina-basket-summary__recipes {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 8px;
        }
        .vitrina-basket-summary__recipes li {
          display: grid;
          gap: 2px;
          padding: 8px 10px;
          border-radius: 10px;
          background: color-mix(in srgb, var(--color-ink) 4%, transparent);
        }
        .vitrina-basket-summary__recipe-name {
          font-weight: 600;
          color: var(--color-ink);
          font-size: 0.92rem;
        }
        .vitrina-basket-summary__recipe-meta {
          font-size: 0.78rem;
          color: var(--color-ink-light);
        }
        .vitrina-basket-summary__loose {
          margin: 0;
          font-size: 0.82rem;
          color: var(--color-ink-light);
        }
        .vitrina-basket-summary__rows {
          margin: 0;
          display: grid;
          gap: 6px;
          font-size: 0.86rem;
        }
        .vitrina-basket-summary__rows > div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }
        .vitrina-basket-summary__rows dt {
          margin: 0;
          color: var(--color-ink-light);
          font-weight: 400;
        }
        .vitrina-basket-summary__rows dd {
          margin: 0;
          font-weight: 500;
          color: var(--color-ink);
        }
        .vitrina-basket-summary__total {
          padding-top: 6px;
          border-top: 1px solid color-mix(in srgb, var(--color-ink) 12%, transparent);
        }
        .vitrina-basket-summary__total dt,
        .vitrina-basket-summary__total dd {
          font-weight: 600;
          color: var(--color-ink);
          font-size: 0.95rem;
        }
        .vitrina-basket-summary__cta {
          padding-top: 4px;
          display: flex;
          justify-content: flex-end;
        }
        .vitrina-basket-summary__checkout {
          margin: 0;
          border: 0;
          cursor: pointer;
          font-family: var(--font-display);
          font-size: 0.95rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: var(--color-cream);
          background: #000;
          border-radius: 6px;
          padding: 12px 20px;
          min-height: 44px;
          transition: background 140ms ease, transform 140ms ease;
        }
        .vitrina-basket-summary__checkout:hover {
          background: #111;
        }
        .vitrina-basket-summary__checkout:active {
          transform: scale(0.99);
        }
      `}</style>
    </ChatWidgetShell>
  );
}
