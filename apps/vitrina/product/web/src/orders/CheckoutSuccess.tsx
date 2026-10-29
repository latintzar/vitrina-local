import { Button, Surface } from '@scope/ui';

export function CheckoutSuccess({ onBack }: { onBack: () => void }) {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');

  return (
    <main className="vitrina-checkout-success">
      <Surface className="vitrina-checkout-success-card">
        <p>Payment received</p>
        <h1>Your pickup order is being prepared.</h1>
        {sessionId ? <code>{sessionId}</code> : null}
        <div className="vitrina-checkout-success-actions">
          <Button onClick={() => { window.location.href = '/orders'; }}>View orders</Button>
          <Button variant="secondary" onClick={onBack}>Back to chat</Button>
        </div>
      </Surface>
      <style>{`
        .vitrina-checkout-success { min-height: 100dvh; display: grid; place-items: center; padding: 20px; }
        .vitrina-checkout-success-card { width: min(480px, 100%); padding: 24px; display: grid; gap: 14px; text-align: center; }
        .vitrina-checkout-success-card p { margin: 0; color: var(--color-ink-light); text-transform: uppercase; letter-spacing: .05em; font-size: .8rem; }
        .vitrina-checkout-success-card h1 { margin: 0; font-family: var(--font-display); color: var(--color-ink); }
        .vitrina-checkout-success-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
      `}</style>
    </main>
  );
}
