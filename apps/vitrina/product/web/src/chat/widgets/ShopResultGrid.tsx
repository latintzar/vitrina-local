/**
 * ShopResultGrid — renders a grid of shop cards below an assistant
 * message. Each card has a primary Dijon "Buy" CTA and a secondary
 * ghost "See shop" button.
 *
 * Consumed by the chat agent when it embeds `<vitrina:shop-results>`
 * widget JSON in its response. v1 exposes this component but the
 * parsing/handoff from the SSE stream is TODO until the agent's
 * system prompt starts emitting real widget payloads.
 */

import { Button, Surface } from '@scope/ui';
import type { Shop } from '../../api/types';

export interface ShopResultGridProps {
  shops: Shop[];
  onBuy?: (shop: Shop) => void;
  onSeeShop?: (shop: Shop) => void;
}

export function ShopResultGrid({ shops, onBuy, onSeeShop }: ShopResultGridProps) {
  if (!shops.length) return null;
  return (
    <div className="vitrina-shop-grid">
      {shops.map((s) => (
        <Surface key={s.id} className="vitrina-shop-card">
          <div className="vitrina-shop-card-body">
            <h3 className="vitrina-shop-card-name">{s.name}</h3>
            <div className="vitrina-shop-card-meta">
              {s.city}
              {s.hours ? ` · ${s.hours}` : ''}
            </div>
          </div>
          <div className="vitrina-shop-card-actions">
            <Button variant="secondary" onClick={() => onSeeShop?.(s)}>
              See shop
            </Button>
            <Button onClick={() => onBuy?.(s)}>Buy</Button>
          </div>
        </Surface>
      ))}

      <style>{`
        .vitrina-shop-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
          margin: 8px 0;
        }
        .vitrina-shop-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 14px;
        }
        .vitrina-shop-card-name {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--color-ink);
          margin: 0 0 2px 0;
        }
        .vitrina-shop-card-meta {
          font-size: 0.85rem;
          color: var(--color-ink-light);
        }
        .vitrina-shop-card-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
      `}</style>
    </div>
  );
}
