/**
 * OrderDetail — read-only mirror of the basket.
 *
 * Visually + structurally identical to ``shops/Cart.tsx`` (recipe-video
 * groups → ``ShopGroup`` with ``IngredientRow``s; standalone shops in
 * the same row component) so the user recognises the order as "the
 * same basket I paid for". Differences vs the live cart:
 *
 *   - rows are read-only: no qty stepper, prices come from the frozen
 *     snapshot (``unit_price_minor`` etc), totals come off the order;
 *   - each recipe header gets a black **"See recipe"** button that
 *     opens the in-app recipe modal (same surface as Discover) via
 *     ``openRecipeById``. We deliberately avoid linking out to TikTok /
 *     Instagram — staying inside the app keeps the recipe playable
 *     against our self-hosted MP4 (see ``RecipeEmbed``) and lets the
 *     user remix it back into a fresh basket.
 *
 * If a future order has no recipe groups (pure standalone basket), the
 * page degrades to one ``vitrina-bsk-standalone`` block plus the
 * collect-QR link — no empty recipe scaffolding.
 */

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@scope/ui';
import { listShops } from '../api/mcp';
import type { Shop } from '../api/types';
import { IngredientRow } from '../components/IngredientRow';
import { ShopGroup } from '../components/ShopGroup';
import { openRecipeById } from '../discover/recipeViewer';
import { useUserLocation } from '../location/useUserLocation';
import { walkingMinutes } from '../location/walkingTime';
import { formatMinor, getOrder, type Order, type OrderLine } from './ordersApi';

interface RecipeMeta {
  title: string;
  source_url?: string;
  video_id?: string;
  cover_url?: string;
}

function recipeMeta(line: OrderLine): RecipeMeta | null {
  const m = line.group_metadata;
  if (!m || m.source !== 'recipe-video') return null;
  const title = typeof m.title === 'string' ? m.title : 'Recipe';
  const source_url = typeof m.source_url === 'string' ? m.source_url : undefined;
  const video_id = typeof m.video_id === 'string' ? m.video_id : undefined;
  const cover_url = video_id ? `/api/recipe-videos/${video_id}/cover.jpg` : undefined;
  return { title, source_url, video_id, cover_url };
}

function ingredientName(line: OrderLine): string {
  const m = line.group_metadata;
  if (m && typeof m.ingredient === 'string' && m.ingredient.length > 0) {
    return m.ingredient;
  }
  return (
    line.display_name ||
    line.name ||
    line.product_snapshot?.name ||
    line.product_snapshot?.name_en ||
    line.product_id ||
    ''
  );
}

function shopIdOf(line: OrderLine): string {
  return line.product_snapshot?.shop_id || 'unknown-shop';
}

function shopLatLng(shop: Shop | null): { lat: number; lng: number } | null {
  if (!shop) return null;
  const lng = typeof (shop as Shop & { lng?: number }).lng === 'number'
    ? (shop as Shop & { lng: number }).lng
    : shop.lon;
  if (typeof shop.lat !== 'number' || typeof lng !== 'number') return null;
  return { lat: shop.lat, lng };
}

function directionsHref(shop: Shop | null): string | undefined {
  if (!shop) return undefined;
  const q = encodeURIComponent(`${shop.name}, ${shop.address || shop.city || ''}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function OrderDetail({ orderId, collectKey, onBack }: { orderId: string; collectKey?: string | null; onBack: () => void }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [shops, setShops] = useState<Shop[]>([]);
  const { location } = useUserLocation();

  const collectUrl = useMemo(() => {
    const key = collectKey || order?.collect_key;
    return key ? `/orders/${orderId}/collect?k=${encodeURIComponent(key)}` : '';
  }, [collectKey, order?.collect_key, orderId]);

  useEffect(() => {
    let alive = true;
    getOrder(orderId, collectKey)
      .then((row) => alive && setOrder(row))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [collectKey, orderId]);

  useEffect(() => {
    let alive = true;
    listShops()
      .then((data) => alive && setShops(data.shops))
      .catch(() => alive && setShops([]));
    return () => {
      alive = false;
    };
  }, []);

  const shopById = useMemo(() => {
    const map = new Map<string, Shop>();
    for (const s of shops) map.set(s.id, s);
    return map;
  }, [shops]);

  const lines: OrderLine[] = order?.line_items ?? [];

  // Bucket lines exactly like Cart.tsx: recipe groups by group_id, rest
  // by shop. Same shape so the rendering code below stays parallel.
  const buckets = useMemo(() => {
    const recipeMap = new Map<string, { meta: RecipeMeta; linesByShop: Map<string, OrderLine[]> }>();
    const standaloneByShop = new Map<string, OrderLine[]>();
    for (const line of lines) {
      const rec = recipeMeta(line);
      if (rec && line.group_id) {
        let bucket = recipeMap.get(line.group_id);
        if (!bucket) {
          bucket = { meta: rec, linesByShop: new Map() };
          recipeMap.set(line.group_id, bucket);
        }
        const sid = shopIdOf(line);
        const existing = bucket.linesByShop.get(sid) ?? [];
        existing.push(line);
        bucket.linesByShop.set(sid, existing);
        continue;
      }
      const sid = shopIdOf(line);
      const existing = standaloneByShop.get(sid) ?? [];
      existing.push(line);
      standaloneByShop.set(sid, existing);
    }
    return { recipeMap, standaloneByShop };
  }, [lines]);

  const shopWalkingMinutes = (shop: Shop | null): number | null => {
    const ll = shopLatLng(shop);
    if (!ll || !location) return null;
    return walkingMinutes(location, ll);
  };

  const totalLabel = order ? formatMinor(order.total_minor ?? order.totals?.total_minor ?? 0, order.currency) : '';

  return (
    <main className="vitrina-order-detail-page">
      <header className="vitrina-order-detail-header">
        <Button variant="secondary" onClick={onBack}>← Back</Button>
        <div>
          <p>Order</p>
          <h1>{orderId}</h1>
        </div>
      </header>

      {error ? (
        <div className="vitrina-order-message">Could not load order: {error}</div>
      ) : !order ? (
        <div className="vitrina-order-message">Loading order…</div>
      ) : (
        <div className="vitrina-bsk">
          <div className="vitrina-bsk-scroll">
            <div className="vitrina-order-status">
              <span>{order.fulfillment_status || order.status || 'pending'}</span>
              <strong>{totalLabel}</strong>
            </div>

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
                {Array.from(bucket.linesByShop.entries()).map(([sid, ls]) => {
                  const shop = shopById.get(sid) ?? null;
                  return (
                    <ShopGroup
                      key={sid}
                      name={shop?.name ?? sid}
                      address={shop?.address ?? shop?.city ?? null}
                      walkingMinutes={shopWalkingMinutes(shop)}
                      directionsHref={directionsHref(shop)}
                    >
                      {ls.map((line, idx) => (
                        <IngredientRow
                          key={`${line.id ?? line.product_id}-${idx}`}
                          name={ingredientName(line)}
                          quantity={line.product_snapshot?.unit ?? null}
                          imageUrl={line.product_snapshot?.image_url ?? null}
                          right={
                            <span className="vitrina-order-line-right">
                              <span className="vitrina-order-line-qty">{line.quantity ?? 1}×</span>
                              <span className="vitrina-order-line-price">
                                {formatMinor(line.total_minor ?? line.subtotal_minor, order.currency)}
                              </span>
                            </span>
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
                {Array.from(buckets.standaloneByShop.entries()).map(([sid, ls]) => {
                  const shop = shopById.get(sid) ?? null;
                  return (
                    <ShopGroup
                      key={sid}
                      name={shop?.name ?? sid}
                      address={shop?.address ?? shop?.city ?? null}
                      walkingMinutes={shopWalkingMinutes(shop)}
                      directionsHref={directionsHref(shop)}
                    >
                      {ls.map((line, idx) => (
                        <IngredientRow
                          key={`${line.id ?? line.product_id}-${idx}`}
                          name={ingredientName(line)}
                          quantity={line.product_snapshot?.unit ?? null}
                          imageUrl={line.product_snapshot?.image_url ?? null}
                          right={
                            <span className="vitrina-order-line-right">
                              <span className="vitrina-order-line-qty">{line.quantity ?? 1}×</span>
                              <span className="vitrina-order-line-price">
                                {formatMinor(line.total_minor ?? line.subtotal_minor, order.currency)}
                              </span>
                            </span>
                          }
                        />
                      ))}
                    </ShopGroup>
                  );
                })}
              </section>
            ) : null}

            {collectUrl ? (
              <a className="vitrina-order-collect-link" href={collectUrl}>
                Open collection QR
              </a>
            ) : null}
          </div>
        </div>
      )}

      <style>{`
        .vitrina-order-detail-page { width: min(760px, 100%); margin: 0 auto; padding: 88px 20px 28px; box-sizing: border-box; display: flex; flex-direction: column; min-height: 100vh; }
        .vitrina-order-detail-header { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
        .vitrina-order-detail-header p { margin: 0; color: var(--color-ink-light); text-transform: uppercase; letter-spacing: .04em; font-size: .8rem; }
        .vitrina-order-detail-header h1 { margin: 0; font-family: var(--font-display); color: var(--color-ink); letter-spacing: -.04em; font-size: clamp(1.4rem, 4vw, 2rem); word-break: break-all; }
        .vitrina-order-message { padding: 18px; border-radius: 6px; background: var(--color-card); }
        .vitrina-order-status { display: flex; justify-content: space-between; gap: 16px; padding: 12px 14px; border-radius: 6px; background: var(--color-card); color: var(--color-ink); }
        .vitrina-order-status span { color: var(--color-ink-light); text-transform: capitalize; }
        .vitrina-order-status strong { font-variant-numeric: tabular-nums; }
        .vitrina-order-collect-link { justify-self: center; margin-top: 4px; padding: 12px 16px; border-radius: 6px; background: color-mix(in srgb, var(--color-ink) 5%, transparent); color: var(--color-ink); font-family: var(--font-display); font-weight: 600; text-decoration: none; text-align: center; }
        .vitrina-order-collect-link:hover { background: color-mix(in srgb, var(--color-ink) 9%, transparent); }
        .vitrina-order-line-right { display: inline-flex; align-items: center; gap: 10px; }
        .vitrina-order-line-qty { color: var(--color-ink-light); font-size: 0.84rem; font-variant-numeric: tabular-nums; }
        .vitrina-order-line-price { color: var(--color-ink); font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 0.84rem; font-variant-numeric: tabular-nums; min-width: 4em; text-align: right; }

        /* Reuse the same recipe-card visuals as Cart.tsx so the order
           page is recognisably the basket the user paid for. The
           selectors below are the exact same names used in Cart.tsx —
           keeping them duplicated (instead of factoring out) is
           intentional: the basket has live qty steppers + a paybar that
           the order doesn't need, and merging the styles risks dragging
           live-cart concerns into this read-only view. */
        .vitrina-bsk { display: flex; flex-direction: column; flex: 1; min-height: 0; }
        .vitrina-bsk-scroll { display: flex; flex-direction: column; gap: 14px; padding: 4px 0 12px; }
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
          width: 44px; height: 44px;
          border-radius: 50%;
          overflow: hidden;
          background: color-mix(in srgb, var(--color-ink) 8%, transparent);
          display: grid; place-items: center;
          font-family: var(--font-display); font-weight: 700;
          color: var(--color-ink-light);
        }
        .vitrina-bsk-recipe__poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .vitrina-bsk-recipe__title { display: grid; gap: 2px; min-width: 0; }
        .vitrina-bsk-recipe__title strong {
          font-family: var(--font-display);
          font-size: 1.02rem;
          font-weight: 600;
          color: var(--color-ink);
          letter-spacing: -0.005em;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .vitrina-bsk-recipe__title span { color: var(--color-ink-light); font-size: 0.78rem; }
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
      `}</style>
    </main>
  );
}
