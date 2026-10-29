/**
 * ShopsPage — Airbnb-style layout: split between a map and a grid of
 * shop cards. Click a shop to open ShopDetail. Right-rail Cart is
 * always visible; once filled, a floating Checkout button appears at
 * the bottom of the cart.
 *
 * Responsive: map + grid stack vertically on mobile; cart becomes a
 * floating pill with a sheet.
 */

import { useEffect, useState } from 'react';
import { listShops } from '../api/mcp';
import type { Shop } from '../api/types';
import { useCart } from '../cart/useCart';
import { ShopsMap } from './ShopsMap';
import { ShopCard } from './ShopCard';
import { ShopDetail } from './ShopDetail';
import { Cart } from './Cart';
import { CheckoutModal } from './CheckoutModal';

type View = 'list' | 'detail';

export function ShopsPage() {
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Shop | null>(null);
  const [view, setView] = useState<View>('list');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartVisibleMobile, setCartVisibleMobile] = useState(false);
  const cart = useCart();

  useEffect(() => {
    let cancelled = false;
    listShops()
      .then((r) => !cancelled && setShops(r.shops))
      .catch((e) => !cancelled && setErr(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="vitrina-shops-page">
      <main className="vitrina-shops-main">
        {view === 'detail' && selected ? (
          <ShopDetail shop={selected} onBack={() => setView('list')} />
        ) : (
          <>
            <div className="vitrina-shops-map-wrap">
              <ShopsMap
                shops={shops ?? []}
                height={280}
                onSelect={(s) => {
                  setSelected(s);
                  setView('detail');
                }}
              />
            </div>

            {err ? (
              <div className="vitrina-shops-error">Couldn't load shops: {err}</div>
            ) : !shops ? (
              <div className="vitrina-shops-loading">Loading shops…</div>
            ) : shops.length === 0 ? (
              <div className="vitrina-shops-empty">No shops yet.</div>
            ) : (
              <div className="vitrina-shops-grid">
                {shops.map((s) => (
                  <ShopCard
                    key={s.id}
                    shop={s}
                    onOpen={(shop) => {
                      setSelected(shop);
                      setView('detail');
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <aside className={`vitrina-shops-cart ${cartVisibleMobile ? 'is-visible-mobile' : ''}`}>
        <Cart shops={shops ?? []} onCheckout={() => setCheckoutOpen(true)} />
      </aside>

      {cart.totalItems > 0 && (
        <button
          type="button"
          className="vitrina-shops-cart-pill"
          onClick={() => setCartVisibleMobile((v) => !v)}
        >
          {cart.totalItems} item{cart.totalItems === 1 ? '' : 's'} · {cart.totalEur.toFixed(2)} €
        </button>
      )}

      {checkoutOpen && (
        <CheckoutModal shops={shops ?? []} onClose={() => setCheckoutOpen(false)} />
      )}

      <style>{`
        .vitrina-shops-page {
          flex: 1;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 20px;
          padding: 20px;
          min-height: 100dvh;
          box-sizing: border-box;
        }
        .vitrina-shops-main { display: flex; flex-direction: column; gap: 16px; }
        .vitrina-shops-map-wrap { border-radius: 6px; overflow: hidden; }
        .vitrina-shops-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
        }
        .vitrina-shops-cart { position: sticky; top: 20px; align-self: start; max-height: calc(100dvh - 40px); }
        .vitrina-shops-error, .vitrina-shops-loading, .vitrina-shops-empty {
          padding: 20px; text-align: center; color: var(--color-ink-light);
        }
        .vitrina-shops-cart-pill {
          display: none;
          position: fixed;
          bottom: 20px; left: 50%; transform: translateX(-50%);
          background: var(--color-dijon);
          color: var(--color-ink-black);
          border: none;
          padding: 12px 22px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 0.95rem;
          z-index: 80;
          box-shadow: 0 10px 30px -6px rgba(138, 97, 22, 0.45);
          cursor: pointer;
        }
        @media (max-width: 920px) {
          .vitrina-shops-page { grid-template-columns: 1fr; }
          .vitrina-shops-cart {
            position: fixed;
            bottom: 76px; left: 20px; right: 20px;
            max-height: 60vh;
            overflow-y: auto;
            z-index: 70;
            display: none;
          }
          .vitrina-shops-cart.is-visible-mobile { display: block; }
          .vitrina-shops-cart-pill { display: block; }
        }
      `}</style>
    </div>
  );
}
