import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Compass, ShoppingBag } from 'lucide-react';
import { formatMinor, listOrders, orderTotalMinor, type Order } from './ordersApi';

/**
 * OrdersPage — full-screen "Orders" sheet.
 *
 * Mirrors the basket sheet anatomy (down-chevron in the header,
 * centred title with sub-count, scrollable body). Groups orders into
 * two sections:
 *   - "To collect" — active, uncollected orders shown as a prominent
 *     collect card at the top.
 *   - "Past" — already collected or cancelled orders.
 */

function isUncollected(order: Order): boolean {
  return !order.collected_at && order.status !== 'cancelled';
}

export function OrdersPage({
  onBack,
  onDiscover,
}: {
  onBack: () => void;
  onDiscover?: () => void;
}) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    listOrders()
      .then((rows) => alive && setOrders(rows))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const { toCollect, past } = useMemo(() => {
    if (!orders) return { toCollect: [], past: [] };
    return {
      toCollect: orders.filter(isUncollected),
      past: orders.filter((o) => !isUncollected(o)),
    };
  }, [orders]);

  const subtitle =
    orders === null
      ? 'Loading…'
      : orders.length === 0
      ? 'No orders yet'
      : toCollect.length > 0
      ? `${toCollect.length} to collect`
      : orders.length === 1
      ? '1 order'
      : `${orders.length} orders`;

  return (
    <div className="vitrina-orders-sheet" role="dialog" aria-modal="true">
      <section className="vitrina-orders-panel">
        <header className="vitrina-orders-head">
          <button
            type="button"
            className="vitrina-orders-close"
            onClick={onBack}
            aria-label="Close orders"
          >
            <ChevronDown size={22} strokeWidth={2.2} />
          </button>
          <div className="vitrina-orders-title">
            <strong>Orders</strong>
            <span>{subtitle}</span>
          </div>
          <span aria-hidden className="vitrina-orders-spacer" />
        </header>

        <div className="vitrina-orders-body">
          {error ? (
            <div className="vitrina-orders-state">Orders are unavailable right now.</div>
          ) : orders === null ? (
            <div className="vitrina-orders-state">Loading orders…</div>
          ) : orders.length === 0 ? (
            <div className="vitrina-orders-state">
              <ShoppingBag size={32} strokeWidth={1.5} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>No orders yet.</p>
              <p style={{ marginTop: 4 }}>Once you check out, your pickups will appear here.</p>
              {onDiscover ? (
                <button
                  type="button"
                  className="vitrina-orders-discover-cta"
                  onClick={() => { onBack(); onDiscover(); }}
                >
                  <Compass size={16} strokeWidth={1.8} />
                  Browse recipes
                </button>
              ) : null}
            </div>
          ) : (
            <>
              {toCollect.length > 0 && (
                <div className="vitrina-orders-section">
                  <p className="vitrina-orders-section__label">To collect</p>
                  <ul className="vitrina-orders-list">
                    {toCollect.map((order) => (
                      <li key={order.id}>
                        <a
                          className="vitrina-order-row vitrina-order-row--active"
                          href={order.permalink_url || `/orders/${order.id}`}
                        >
                          <div className="vitrina-order-row__main">
                            <strong>
                              {order.created_at
                                ? new Date(order.created_at).toLocaleDateString(undefined, {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : order.id}
                            </strong>
                            <span className="vitrina-order-row__collect-hint">
                              {order.collect_code
                                ? `Code: ${order.collect_code}`
                                : 'Show this to collect your items'}
                            </span>
                          </div>
                          <span className="vitrina-order-row__total">
                            {formatMinor(orderTotalMinor(order), order.currency)}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {past.length > 0 && (
                <div className="vitrina-orders-section">
                  {toCollect.length > 0 && (
                    <p className="vitrina-orders-section__label">Past</p>
                  )}
                  <ul className="vitrina-orders-list">
                    {past.map((order) => (
                      <li key={order.id}>
                        <a
                          className="vitrina-order-row"
                          href={order.permalink_url || `/orders/${order.id}`}
                        >
                          <div className="vitrina-order-row__main">
                            <strong>
                              {order.created_at
                                ? new Date(order.created_at).toLocaleDateString(undefined, {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : order.id}
                            </strong>
                            <span>{order.fulfillment_status || order.status || 'collected'}</span>
                          </div>
                          <span className="vitrina-order-row__total">
                            {formatMinor(orderTotalMinor(order), order.currency)}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <style>{`
        .vitrina-orders-sheet {
          position: fixed;
          inset: 0;
          z-index: 95;
        }
        .vitrina-orders-panel {
          position: absolute;
          inset: 0;
          background: var(--color-cream);
          display: flex;
          flex-direction: column;
        }
        .vitrina-orders-head {
          display: grid;
          grid-template-columns: 40px 1fr 40px;
          align-items: center;
          gap: 12px;
          padding: calc(env(safe-area-inset-top, 0px) + 14px) 14px 12px;
          background: color-mix(in srgb, var(--color-card) 92%, transparent);
          border-bottom: 1px solid color-mix(in srgb, var(--color-ink) 6%, transparent);
        }
        .vitrina-orders-close {
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
        .vitrina-orders-close:hover {
          background: color-mix(in srgb, var(--color-ink) 6%, transparent);
        }
        .vitrina-orders-title {
          display: grid;
          place-items: center;
          gap: 1px;
          line-height: 1.15;
        }
        .vitrina-orders-title strong {
          font-family: var(--font-display);
          color: var(--color-ink);
          font-size: 1.05rem;
          font-weight: 600;
          letter-spacing: -0.015em;
        }
        .vitrina-orders-title span {
          color: var(--color-ink-light);
          font-size: 0.78rem;
        }
        .vitrina-orders-spacer { width: 40px; height: 40px; }

        .vitrina-orders-body {
          flex: 1;
          overflow: auto;
          padding: 14px 14px calc(env(safe-area-inset-bottom, 0px) + 24px);
          display: grid;
          align-content: start;
          gap: 20px;
        }
        .vitrina-orders-state {
          padding: 40px 18px 28px;
          color: var(--color-ink-light);
          background: var(--color-card);
          border-radius: 6px;
          text-align: center;
          line-height: 1.45;
          display: grid;
          place-items: center;
        }
        .vitrina-orders-state p { margin: 0; }
        .vitrina-orders-discover-cta {
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
        .vitrina-orders-discover-cta:hover { opacity: 0.88; }
        .vitrina-orders-section {
          display: grid;
          gap: 8px;
        }
        .vitrina-orders-section__label {
          margin: 0;
          padding: 0 2px;
          font-size: 0.76rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-ink-light);
        }
        .vitrina-orders-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        .vitrina-order-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 14px 16px;
          border: 0;
          border-radius: 6px;
          background: var(--color-card);
          color: var(--color-ink);
          text-decoration: none;
          transition: background 140ms ease;
        }
        .vitrina-order-row:hover {
          background: color-mix(in srgb, var(--color-ink) 3%, var(--color-card));
        }
        .vitrina-order-row--active {
          background: color-mix(in srgb, var(--color-accent, #3b82f6) 8%, var(--color-card));
          border: 1.5px solid color-mix(in srgb, var(--color-accent, #3b82f6) 25%, transparent);
        }
        .vitrina-order-row--active:hover {
          background: color-mix(in srgb, var(--color-accent, #3b82f6) 14%, var(--color-card));
        }
        .vitrina-order-row__main {
          display: grid;
          gap: 3px;
          min-width: 0;
        }
        .vitrina-order-row__main strong {
          font-family: var(--font-display);
          font-size: 0.95rem;
          font-weight: 600;
        }
        .vitrina-order-row__main span {
          color: var(--color-ink-light);
          font-size: 0.82rem;
          text-transform: capitalize;
        }
        .vitrina-order-row__collect-hint {
          color: var(--color-accent, #3b82f6) !important;
          font-weight: 500 !important;
          text-transform: none !important;
          font-size: 0.84rem !important;
        }
        .vitrina-order-row__total {
          font-variant-numeric: tabular-nums;
          font-weight: 600;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
