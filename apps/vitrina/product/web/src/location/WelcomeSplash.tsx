/**
 * WelcomeSplash — full-screen first-time onboarding fade.
 *
 * Shows the Vitrina wordmark + a one-line tagline for ~3.4s on the very
 * first cold load (per device — gated by `localStorage["vitrina:welcomed"]`,
 * not sessionStorage; we don't want returning visitors to re-watch it).
 * After the dwell the splash crossfades and signals the parent that it's
 * done, at which point App.tsx animates in the LocationModal underneath.
 *
 * The dwell is intentionally short — enough to set the tone, not so long
 * it gets in the way. Visual style picks up the brand "warm drift" theme:
 * a static gradient with a slow drifting blob layered over the wordmark.
 */

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'vitrina:welcomed';
const DWELL_MS = 3400;

export function shouldShowWelcomeSplash(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) !== '1';
}

export function markWelcomeSplashSeen(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, '1');
}

export function WelcomeSplash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'leave'>('enter');

  useEffect(() => {
    const enter = window.setTimeout(() => setPhase('leave'), DWELL_MS);
    const leave = window.setTimeout(() => {
      markWelcomeSplashSeen();
      onDone();
    }, DWELL_MS + 520);
    return () => {
      window.clearTimeout(enter);
      window.clearTimeout(leave);
    };
  }, [onDone]);

  return (
    <div
      className={`vitrina-welcome ${phase === 'leave' ? 'is-leaving' : ''}`}
      aria-hidden={phase === 'leave'}
    >
      <div className="vitrina-welcome__blob" aria-hidden />
      <div className="vitrina-welcome__copy">
        <h1>Vitrina</h1>
        <p>Real recipes from real creators. Buyable from neighbourhood shops.</p>
      </div>
      <style>{`
        .vitrina-welcome {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: grid;
          place-items: center;
          background: #f6f4ee;
          color: #2a2420;
          opacity: 0;
          animation: vitrina-welcome-in 480ms ease forwards;
          transition: opacity 460ms ease;
          overflow: hidden;
        }
        .vitrina-welcome.is-leaving {
          opacity: 0;
        }
        .vitrina-welcome__blob { display: none; }
        .vitrina-welcome__copy {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 12px;
          text-align: center;
          padding: 0 24px;
          max-width: 540px;
        }
        .vitrina-welcome__copy h1 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(3rem, 10vw, 5rem);
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .vitrina-welcome__copy p {
          margin: 0;
          color: #6b5240;
          font-size: clamp(0.95rem, 3.4vw, 1.1rem);
          line-height: 1.45;
        }
        @keyframes vitrina-welcome-in {
          from { opacity: 0; transform: scale(1.02); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes vitrina-welcome-drift {
          from { transform: translate(-3%, 1%); }
          to   { transform: translate(2%, -2%); }
        }
      `}</style>
    </div>
  );
}
