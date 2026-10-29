/**
 * Landing — empty-state chat surface.
 *
 * Layout: headline near the top, four starter prompt chips above the
 * composer, and the composer pinned to the bottom (above the tab bar)
 * so the empty state mirrors the active chat state. Tapping a chip
 * fills the composer (it does NOT auto-send) so the user can edit it
 * before sending.
 */

import { useState } from 'react';
import { Composer } from './Composer';

// Each prompt represents a different intent layer — meal mood, occasion,
// constraint, and local discovery — so the grid shows range at a glance.
const STARTER_PROMPTS = [
  'What do you feel like eating tonight?',
  'Cook something impressive this weekend',
  'Quick weeknight dinner — I have 30 mins',
  "What's fresh and local near me right now?",
];

export function Landing({
  disabled,
  onSend,
  onSendVoice,
}: {
  disabled?: boolean;
  onSend: (text: string, photoFiles?: File[]) => void;
  onSendVoice?: (blob: Blob, duration: number, waveform: number[], photoFiles?: File[]) => void;
}) {
  const [seed, setSeed] = useState<string | null>(null);

  return (
    <section className="vitrina-landing" aria-label="Vitrina chat landing">
      <div className="vitrina-landing-top">
        <p className="vitrina-landing-kicker">Local shops, live stock, one conversation.</p>
        <h1>What do you feel like today?</h1>
        <p className="vitrina-landing-copy">
          Ask for dinner ideas, a repair plan, or the exact thing you need from nearby shops.
        </p>
      </div>

      <div className="vitrina-landing-bottom">
        <ul className="vitrina-landing-suggestions" aria-label="Starter prompts">
          {STARTER_PROMPTS.map((prompt) => (
            <li key={prompt}>
              <button
                type="button"
                className="vitrina-landing-suggestion"
                onClick={() => setSeed(prompt)}
              >
                {prompt}
              </button>
            </li>
          ))}
        </ul>
        <div className="vitrina-landing-composer">
          <Composer
            onSend={onSend}
            onSendVoice={onSendVoice}
            disabled={disabled}
            seedText={seed}
            onSeedConsumed={() => setSeed(null)}
          />
        </div>
      </div>

      <style>{`
        .vitrina-landing {
          position: relative;
          flex: 1;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: calc(env(safe-area-inset-top, 0px) + 92px) 20px
                   calc(env(safe-area-inset-bottom, 0px) + 96px);
          box-sizing: border-box;
        }
        /* When the soft keyboard is up the bottom-nav slides off, so
           the 96px bottom-pad reservation is dead space — tuck the
           composer right above the keyboard instead. */
        .vitrina-keyboard-open .vitrina-landing {
          padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
        }
        .vitrina-landing-top {
          width: min(100%, 720px);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .vitrina-landing-kicker {
          margin: 0;
          color: var(--color-ink-light);
          font-size: 0.78rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .vitrina-landing h1 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(2.1rem, 7vw, 4.4rem);
          line-height: 0.98;
          letter-spacing: -0.05em;
          color: var(--color-ink);
        }
        .vitrina-landing-copy {
          max-width: 520px;
          margin: 0;
          color: var(--color-ink-light);
          font-size: clamp(0.95rem, 1.8vw, 1.1rem);
          line-height: 1.5;
        }
        .vitrina-landing-bottom {
          width: min(100%, 720px);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .vitrina-landing-suggestions {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .vitrina-landing-suggestion {
          appearance: none;
          border: 1px solid color-mix(in srgb, var(--color-ink) 10%, transparent);
          background: color-mix(in srgb, var(--color-card) 92%, transparent);
          color: var(--color-ink);
          padding: 9px 13px;
          border-radius: 999px;
          font-size: 0.86rem;
          line-height: 1.2;
          cursor: pointer;
          transition: background 140ms ease, transform 140ms ease;
        }
        .vitrina-landing-suggestion:hover {
          background: var(--color-card);
        }
        .vitrina-landing-suggestion:active {
          transform: scale(0.98);
        }
      `}</style>
    </section>
  );
}
