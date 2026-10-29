/**
 * Single-shop assistant card — walking time + directions, primary
 * "View store" opens Browse → ShopDetail.
 */

import { Button, Surface } from '@scope/ui';
import { useUserLocation } from '../../location/useUserLocation';
import { walkingMinutes } from '../../location/walkingTime';
import { openShopInBrowse } from '../../shops/shopNavigator';
import { directionsHrefForShop, shopFromWidgetPayload } from './chatWidgetEntities';

export interface ShopCardWidgetPayload extends Record<string, unknown> {
  /** Full shop card from MCP, or nested under `shop`. */
  shop?: Record<string, unknown>;
}

export function ShopCardWidget(props: Record<string, unknown>) {
  const raw = (props.shop ?? props) as Record<string, unknown>;
  const shop = shopFromWidgetPayload(raw);
  const { location } = useUserLocation();

  if (!shop) {
    return null;
  }

  const walkMin =
    location != null
      ? walkingMinutes({ lat: location.lat, lng: location.lng }, { lat: shop.lat, lng: shop.lon })
      : null;
  const mapsUrl =
    (typeof raw.maps_url === 'string' && raw.maps_url) ||
    (typeof raw.mapsUrl === 'string' && raw.mapsUrl) ||
    null;
  const directionsHref = directionsHrefForShop(shop, mapsUrl);

  return (
    <Surface className="vitrina-chat-widget vitrina-chat-shop-card">
      <header className="vitrina-chat-shop-card__head">
        <div className="vitrina-chat-shop-card__title">
          <strong>{shop.name}</strong>
          {shop.address || shop.city ? (
            <span className="vitrina-chat-shop-card__addr">{shop.address || shop.city}</span>
          ) : null}
        </div>
        <div className="vitrina-chat-shop-card__aside">
          {typeof walkMin === 'number' ? (
            <span className="vitrina-chat-shop-card__walk" aria-label={`${walkMin} minute walk`}>
              {walkMin} min
            </span>
          ) : null}
          <a
            className="vitrina-chat-shop-card__dir"
            href={directionsHref}
            target="_blank"
            rel="noreferrer"
            aria-label={`Directions to ${shop.name}`}
          >
            ↗
          </a>
        </div>
      </header>
      <Button fullWidth onClick={() => openShopInBrowse(shop)}>
        View store
      </Button>
      <style>{`
        .vitrina-chat-shop-card {
          padding: 12px 14px 14px;
          margin: 6px 0;
          display: grid;
          gap: 12px;
        }
        .vitrina-chat-shop-card__head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }
        .vitrina-chat-shop-card__title {
          min-width: 0;
          display: grid;
          gap: 2px;
        }
        .vitrina-chat-shop-card__title strong {
          font-family: var(--font-display);
          font-size: 1rem;
          color: var(--color-ink);
        }
        .vitrina-chat-shop-card__addr {
          font-size: 0.78rem;
          color: var(--color-ink-light);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .vitrina-chat-shop-card__aside {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .vitrina-chat-shop-card__walk {
          font-size: 0.78rem;
          font-variant-numeric: tabular-nums;
          color: var(--color-ink);
          padding: 3px 9px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-ink) 7%, transparent);
          white-space: nowrap;
        }
        .vitrina-chat-shop-card__dir {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-ink) 7%, transparent);
          color: var(--color-ink);
          text-decoration: none;
          font-size: 0.85rem;
          font-weight: 600;
        }
        .vitrina-chat-shop-card__dir:hover {
          background: color-mix(in srgb, var(--color-ink) 12%, transparent);
        }
      `}</style>
    </Surface>
  );
}
