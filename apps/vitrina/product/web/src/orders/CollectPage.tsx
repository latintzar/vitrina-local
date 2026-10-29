import { useEffect, useState } from 'react';
import { Button, Surface } from '@scope/ui';
import { collectOrder, type Order } from './ordersApi';

export function CollectPage({ orderId, collectKey, onBack }: { orderId: string; collectKey?: string | null; onBack: () => void }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    collectOrder(orderId, collectKey)
      .then((row) => alive && setOrder(row))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [collectKey, orderId]);

  return (
    <main className="vitrina-collect-page">
      <Surface className="vitrina-collect-card">
        <p className="vitrina-collect-kicker">Collection</p>
        <h1>{error ? 'Could not collect' : order ? 'Collected' : 'Collecting…'}</h1>
        <div className="vitrina-collect-qr" aria-hidden>
          {order?.collect_code || orderId.slice(0, 6).toUpperCase()}
        </div>
        <p>{error || (order ? 'This order is now marked as collected.' : 'Checking the collection key…')}</p>
        <Button onClick={onBack}>Back to Vitrina</Button>
      </Surface>

      <style>{`
        .vitrina-collect-page { min-height: 100dvh; display: grid; place-items: center; padding: 20px; box-sizing: border-box; }
        .vitrina-collect-card { width: min(420px, 100%); padding: 24px; display: grid; gap: 14px; text-align: center; }
        .vitrina-collect-kicker { margin: 0; color: var(--color-ink-light); text-transform: uppercase; letter-spacing: .06em; font-size: .8rem; }
        .vitrina-collect-card h1 { margin: 0; font-family: var(--font-display); color: var(--color-ink); }
        .vitrina-collect-qr {
          width: 180px; height: 180px; margin: 6px auto; border-radius: 6px;
          display: grid; place-items: center; background: var(--color-ink); color: var(--color-card);
          font-family: var(--font-display); font-size: 1.4rem; letter-spacing: .12em;
        }
      `}</style>
    </main>
  );
}
