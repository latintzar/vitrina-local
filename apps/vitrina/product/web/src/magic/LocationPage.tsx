/**
 * Channel-agnostic location magic-link page — vitrina.bg/location?s=…
 *
 * Works for any channel (Instagram DMs, ChatGPT, Claude Desktop, etc.).
 * Resolves the ``?s=`` slug against ``GET /agent/v1/magic/location/lookup``,
 * shows the LocationModal, then POSTs to ``/agent/v1/magic/location/confirm``.
 *
 * Replaces the old ``/ig/location`` route (IG-only; now deleted).
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Surface } from '@scope/ui';
import { LocationModal } from '../location/LocationModal';
import type { UserLocation } from '../location/useUserLocation';

function agentBase(): string {
  return import.meta.env.VITE_VITRINA_AGENT_URL || '/agent';
}

function BackToChatHint() {
  return (
    <div className="vitrina-magic-loc-hint" role="note">
      <p>Close this tab to return to your chat when done.</p>
    </div>
  );
}

export default function LocationPage() {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const slug = params.get('s') || '';
  const [threadId, setThreadId] = useState<string | null>(null);
  const [resolveErr, setResolveErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${agentBase()}/v1/magic/location/lookup?s=${encodeURIComponent(slug)}`,
        );
        const j = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          thread_id?: string;
          cart_key?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !j.ok || !j.thread_id) {
          setResolveErr(j.error || `Link not found (${res.status})`);
          return;
        }
        setThreadId(j.thread_id);
      } catch {
        if (!cancelled) setResolveErr('Network error — check your connection.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const onConfirm = useCallback(
    async (loc: UserLocation) => {
      setErr(null);
      try {
        const res = await fetch(`${agentBase()}/v1/magic/location/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            lat: loc.lat,
            lng: loc.lng,
            label: loc.label,
          }),
        });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setErr(j.error || `Request failed (${res.status})`);
          return;
        }
        setDone(true);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Network error');
      }
    },
    [slug],
  );

  if (!slug) {
    return (
      <main className="vitrina-magic-bare vitrina-magic-dark">
        <Surface className="vitrina-magic-card">
          <p className="vitrina-magic-kicker">Invalid link</p>
          <h1>Open the location link from your chat.</h1>
        </Surface>
        <style>{css}</style>
      </main>
    );
  }

  if (!threadId && !resolveErr) {
    return (
      <main className="vitrina-magic-bare vitrina-magic-dark">
        <p className="vitrina-magic-status">Loading…</p>
        <style>{css}</style>
      </main>
    );
  }

  if (resolveErr) {
    return (
      <main className="vitrina-magic-bare vitrina-magic-dark">
        <Surface className="vitrina-magic-card">
          <p className="vitrina-magic-kicker">Link expired</p>
          <h1>{resolveErr}</h1>
          <p className="vitrina-magic-hint">Ask Vitrina for a fresh location link.</p>
        </Surface>
        <style>{css}</style>
      </main>
    );
  }

  if (done) {
    return (
      <main className="vitrina-magic-bare vitrina-magic-dark">
        <Surface className="vitrina-magic-card vitrina-magic-card--done">
          <p className="vitrina-magic-kicker">Saved</p>
          <h1>Location set — head back to chat</h1>
          <p className="vitrina-magic-hint">Close this tab or tap the button to return.</p>
          <div style={{ marginTop: 16 }}>
            <Button type="button" onClick={() => window.close()}>
              Close tab
            </Button>
          </div>
        </Surface>
        <style>{css}</style>
      </main>
    );
  }

  return (
    <div className="vitrina-magic-wrap vitrina-magic-dark">
      <BackToChatHint />
      {err ? (
        <div className="vitrina-magic-err" role="alert">
          {err}
        </div>
      ) : null}
      <LocationModal open onConfirm={onConfirm} onCancel={() => {}} mandatory />
      <style>{css}</style>
    </div>
  );
}

const css = `
  .vitrina-magic-dark {
    --mg-bg: #0c0c0c;
    --mg-fg: #f5f5f4;
    --mg-muted: #a8a29e;
    background: var(--mg-bg);
    color: var(--mg-fg);
    min-height: 100dvh;
  }
  .vitrina-magic-bare {
    display: grid;
    place-items: center;
    padding: 20px;
  }
  .vitrina-magic-status {
    margin: 0;
    padding: 24px;
    text-align: center;
    color: var(--mg-muted);
  }
  .vitrina-magic-card {
    width: min(480px, 100%);
    padding: 24px;
    text-align: center;
    background: #171717 !important;
    border: 1px solid #292524 !important;
    color: var(--mg-fg) !important;
  }
  .vitrina-magic-card--done { margin-top: 80px; }
  .vitrina-magic-kicker {
    margin: 0 0 8px;
    color: var(--mg-muted);
    text-transform: uppercase;
    letter-spacing: .08em;
    font-size: .72rem;
  }
  .vitrina-magic-card h1 {
    margin: 0 0 12px;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--mg-fg);
  }
  .vitrina-magic-hint {
    margin: 0;
    color: var(--mg-muted);
    font-size: 0.95rem;
    line-height: 1.45;
  }
  .vitrina-magic-loc-hint {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10002;
    padding: 12px 16px;
    background: rgba(12,12,12,0.95);
    text-align: center;
    font-size: 0.8rem;
    color: var(--mg-muted);
    pointer-events: none;
  }
  .vitrina-magic-wrap {
    min-height: 100dvh;
    position: relative;
    padding-top: 56px;
  }
  .vitrina-magic-err {
    position: fixed;
    top: 64px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10001;
    background: #7f1d1d;
    color: #fff;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 0.9rem;
    max-width: min(420px, 92vw);
  }
`;
