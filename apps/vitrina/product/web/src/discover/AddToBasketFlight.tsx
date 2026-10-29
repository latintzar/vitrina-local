/**
 * AddToBasketFlight — full-screen "drop into basket" celebration.
 *
 * Plays in three beats over ~580ms (was 940ms — Peter felt it dragged):
 *   1. The recipe poster zooms up centered with a soft cream backdrop
 *      and a giant ghost basket behind it (140ms ease-out).
 *   2. The poster shrinks + falls into the basket — light bounce
 *      (220ms ease-in cubic).
 *   3. The whole composition (basket+poster) flies to the navbar
 *      basket icon and fades out (220ms ease-in-out).
 *
 * Lifted to App level (App.tsx) so the modal can close instantly on
 * tap; the overlay then plays ON TOP of the chat tab, not blocking it.
 * The user sees their message bubble appear behind the overlay while
 * the recipe "lands" in the basket.
 *
 * The basket-target element is found via `[data-basket-target]` so we
 * don't need to prop-drill a ref through Discover → RecipeModal.
 */
import { useEffect, useRef, useState } from 'react';

interface AddToBasketFlightProps {
  posterUrl: string | null;
  recipeTitle: string;
  /** Called when the animation has fully landed in the navbar basket. */
  onDone: () => void;
}

type Phase = 'rise' | 'drop' | 'fly' | 'gone';

export function AddToBasketFlight({ posterUrl, recipeTitle, onDone }: AddToBasketFlightProps) {
  const [phase, setPhase] = useState<Phase>('rise');
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    // Resolve the navbar basket target lazily so we always honour the
    // current layout (e.g. if the user rotates the device).
    const el = document.querySelector('[data-basket-target]') as HTMLElement | null;
    if (el) {
      const rect = el.getBoundingClientRect();
      setTarget({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }
    const t1 = window.setTimeout(() => setPhase('drop'), 140);
    const t2 = window.setTimeout(() => setPhase('fly'), 140 + 220);
    const t3 = window.setTimeout(() => {
      setPhase('gone');
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    }, 140 + 220 + 220);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [onDone]);

  if (phase === 'gone') return null;

  // Compute fly-target translate relative to the screen centre. The
  // basket sits in the top-right; we offset the composition that way
  // when phase === 'fly'.
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const flyDx = target ? target.x - cx : 140;
  const flyDy = target ? target.y - cy : -260;

  const compStyle: React.CSSProperties = (() => {
    switch (phase) {
      case 'rise':
        return { transform: 'translate(0,0) scale(1)', opacity: 1 };
      case 'drop':
        // Poster shrinks and "falls" into the basket icon. Composition
        // stays centered.
        return { transform: 'translate(0,0) scale(1)', opacity: 1 };
      case 'fly':
        return {
          transform: `translate(${flyDx}px, ${flyDy}px) scale(0.18)`,
          opacity: 0,
        };
      default:
        return { opacity: 0 };
    }
  })();

  return (
    <div className="vitrina-flight" role="presentation" aria-hidden>
      <div className="vitrina-flight__backdrop" />
      <div className="vitrina-flight__stage" style={compStyle}>
        <div className="vitrina-flight__basket" aria-hidden>
          <BasketGlyph />
        </div>
        <div
          className={`vitrina-flight__poster ${phase === 'drop' || phase === 'fly' ? 'is-dropped' : ''}`}
        >
          {posterUrl ? (
            <img src={posterUrl} alt="" />
          ) : (
            <span className="vitrina-flight__poster-fallback">{recipeTitle.charAt(0).toUpperCase()}</span>
          )}
        </div>
      </div>

      <style>{FLIGHT_CSS}</style>
    </div>
  );
}

const FLIGHT_CSS = `
.vitrina-flight {
  position: fixed;
  inset: 0;
  z-index: 200;
  pointer-events: none;
}
.vitrina-flight__backdrop {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--color-cream) 86%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: vitrina-flight-fade 220ms ease-out both;
}
.vitrina-flight__stage {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 220px;
  height: 220px;
  margin-left: -110px;
  margin-top: -110px;
  transition:
    transform 220ms cubic-bezier(.55, .05, .25, 1.05),
    opacity 220ms ease-in;
  will-change: transform, opacity;
}
.vitrina-flight__basket {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--color-ink);
  animation: vitrina-flight-basket 460ms ease-out both;
}
.vitrina-flight__basket svg { width: 200px; height: 200px; }
.vitrina-flight__poster {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 140px;
  height: 200px;
  margin-left: -70px;
  margin-top: -130px;
  border-radius: 6px;
  overflow: hidden;
  background: color-mix(in srgb, var(--color-ink) 12%, transparent);
  box-shadow: 0 24px 60px -22px rgba(0, 0, 0, 0.45);
  transition:
    transform 220ms cubic-bezier(.4, 0, .2, 1.2),
    width 220ms cubic-bezier(.4, 0, .2, 1),
    height 220ms cubic-bezier(.4, 0, .2, 1),
    margin-top 220ms cubic-bezier(.4, 0, .2, 1.2);
  animation: vitrina-flight-rise 140ms ease-out both;
}
.vitrina-flight__poster.is-dropped {
  width: 70px;
  height: 70px;
  margin-top: 10px;
  transform: rotate(-6deg);
}
.vitrina-flight__poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.vitrina-flight__poster-fallback {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  font-family: var(--font-display);
  font-size: 3rem;
  color: var(--color-cream);
  background: linear-gradient(135deg, #2a2420, #3d3631);
}
@keyframes vitrina-flight-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes vitrina-flight-rise {
  from { transform: translateY(60px) scale(0.7); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes vitrina-flight-basket {
  0% { transform: scale(0.6); opacity: 0; }
  60% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
`;

function BasketGlyph() {
  // Filled rounded basket — visual echo of lucide ShoppingBasket but
  // beefier so it reads from across the room during the animation.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 11h14l-1.4 7.2A2 2 0 0 1 15.6 20H8.4a2 2 0 0 1-2-1.8L5 11Z" fill="currentColor" fillOpacity="0.08" />
      <path d="M5 11l3-6" />
      <path d="M19 11l-3-6" />
      <path d="M3 11h18" />
      <path d="M9 14v3" />
      <path d="M12 14v3" />
      <path d="M15 14v3" />
    </svg>
  );
}
