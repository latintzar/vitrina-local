/**
 * ShopCard — Airbnb-style card in the grid on the Shops tab.
 * Click to open the ShopDetail inventory page.
 */

import { Badge, Surface } from '@scope/ui';
import type { Shop } from '../api/types';

export function ShopCard({ shop, onOpen }: { shop: Shop; onOpen?: (s: Shop) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(shop)}
      className="vitrina-shop-card-btn"
    >
      <Surface className="vitrina-shop-card">
        {shop.cover_url ? (
          <div
            className="vitrina-shop-card-cover"
            style={{ backgroundImage: `url(${shop.cover_url})` }}
          />
        ) : (
          <div className="vitrina-shop-card-cover vitrina-shop-card-cover-empty">
            <span>{shop.name[0]}</span>
          </div>
        )}
        <div className="vitrina-shop-card-body">
          <div className="vitrina-shop-card-top">
            <h3>{shop.name}</h3>
            {(() => {
              // Defensive: backend has historically returned `rating` as
              // either a number or a string ("4.5") depending on the source
              // (seed JSON vs Supabase). String coerces fine, but
              // `.toFixed` only exists on numbers — so normalise first.
              const num = typeof shop.rating === 'number'
                ? shop.rating
                : typeof shop.rating === 'string'
                  ? Number.parseFloat(shop.rating)
                  : NaN;
              if (!Number.isFinite(num) || num <= 0) return null;
              return <Badge color="teal">{`\u2605 ${num.toFixed(1)}`}</Badge>;
            })()}
          </div>
          <div className="vitrina-shop-card-meta">
            {shop.city}
            {shop.hours ? ` · ${shop.hours}` : ''}
          </div>
          <div className="vitrina-shop-card-badge">
            <Badge color="amber">Click &amp; collect</Badge>
          </div>
        </div>
      </Surface>

      <style>{`
        .vitrina-shop-card-btn {
          all: unset;
          cursor: pointer;
          display: block;
          border-radius: 6px;
          transition: transform 200ms ease;
        }
        .vitrina-shop-card-btn:hover { transform: translateY(-2px); }
        .vitrina-shop-card {
          padding: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .vitrina-shop-card-cover {
          height: 160px;
          background-size: cover;
          background-position: center;
          background-color: var(--color-sky-light);
        }
        .vitrina-shop-card-cover-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-size: 3.2rem;
          color: var(--color-sky);
          background: var(--color-sky-light);
        }
        .vitrina-shop-card-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
        .vitrina-shop-card-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .vitrina-shop-card-top h3 {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--color-ink);
          margin: 0;
        }
        .vitrina-shop-card-meta { color: var(--color-ink-light); font-size: 0.85rem; }
        .vitrina-shop-card-badge { margin-top: 2px; }
      `}</style>
    </button>
  );
}
