/**
 * PayButton — opens Stripe Checkout in a new tab.
 *
 * The checkout URL comes from the ACP `create_checkout_session`
 * response (`session.payment_link.url`). On return, the webhook
 * `/api/webhooks/stripe` finalises the order server-side; the
 * frontend polls `/checkout_sessions/{id}` until status flips to
 * `completed`, then shows the collection code.
 */

import { Button } from '@scope/ui';
import { useEffect, useState } from 'react';
import { AuthSheet } from '../../auth/AuthSheet';
import { useAuth } from '../../auth/useAuth';
import { ChatWidgetShell } from './ChatWidgetShell';

export interface PayButtonProps {
  url: string;
  amountLabel?: string;      // e.g. "€12.40"
  disabled?: boolean;
}

export function PayButton({ url, amountLabel, disabled }: PayButtonProps) {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);

  function open() {
    if (disabled) return;
    if (!user) {
      setPendingOpen(true);
      setAuthOpen(true);
      return;
    }
    window.open(url, '_blank', 'noopener');
  }

  useEffect(() => {
    if (!pendingOpen || !user) return;
    setPendingOpen(false);
    setAuthOpen(false);
    window.open(url, '_blank', 'noopener');
  }, [pendingOpen, url, user]);

  return (
    <>
      <ChatWidgetShell
        eyebrow="Checkout"
        title={amountLabel ? `Ready to pay · ${amountLabel}` : 'Ready to pay'}
        subtitle="Secure Stripe Checkout opens in a new tab."
      >
        <div className="vitrina-pay-cta">
          <Button variant="primary" onClick={open} disabled={disabled}>
            Pay{amountLabel ? ` · ${amountLabel}` : ''}
          </Button>
        </div>
        <style>{`
          .vitrina-pay-cta {
            padding-top: 4px;
            display: flex;
            justify-content: flex-end;
          }
        `}</style>
      </ChatWidgetShell>
      <AuthSheet
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          setPendingOpen(false);
        }}
        intro="Sign in to complete your order. Your basket and chat transfer automatically."
        onAuthenticated={() => setPendingOpen(true)}
      />
    </>
  );
}
