/**
 * SkyWithClouds — animated baby-blue sky with slow cloud drift.
 *
 * Two layers:
 *   1. `FluidGradient` from @scope/ui, `blueWhite` palette — the
 *      theme's canonical sky gradient. Runs at a low fpsCap to stay
 *      gentle on battery and to match the `quiet` motion bucket.
 *   2. Three SVG cloud puffs drifting slowly left→right, wrapping
 *      around at the edges. CSS-animated; no JS per frame.
 *
 * Sits behind all app chrome (`position: fixed; inset: 0; z: -1`).
 */

import { FluidGradient } from '@scope/ui';

function Cloud({ top, size, delay, duration, opacity }: {
  top: string;
  size: number;
  delay: string;
  duration: string;
  opacity: number;
}) {
  return (
    <svg
      className="vitrina-cloud"
      style={{
        top,
        width: size,
        height: size * 0.6,
        animationDelay: delay,
        animationDuration: duration,
        opacity,
      }}
      viewBox="0 0 200 120"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <g fill="white">
        <ellipse cx="50"  cy="75" rx="38" ry="30" />
        <ellipse cx="95"  cy="55" rx="44" ry="36" />
        <ellipse cx="135" cy="70" rx="40" ry="32" />
        <ellipse cx="165" cy="80" rx="28" ry="22" />
      </g>
    </svg>
  );
}

export function SkyWithClouds({ settled = false }: { settled?: boolean }) {
  return (
    <div aria-hidden className={`vitrina-sky-bg ${settled ? 'is-settled' : ''}`}>
      <div className="vitrina-sky-gradient">
        <FluidGradient variant="v4" preset="blueWhite" fpsCap={12} />
      </div>
      <Cloud top="8%"  size={260} delay="-4s"  duration="95s" opacity={0.85} />
      <Cloud top="28%" size={360} delay="-22s" duration="130s" opacity={0.75} />
      <Cloud top="55%" size={220} delay="-60s" duration="110s" opacity={0.7} />
      <Cloud top="72%" size={300} delay="-12s" duration="160s" opacity={0.8} />

      {/* Styles are co-located so the component is drop-in anywhere. */}
      <style>{`
        .vitrina-sky-bg {
          position: fixed;
          inset: 0;
          z-index: -1;
          overflow: hidden;
          background: linear-gradient(
            180deg,
            var(--color-sky-light, #CEE4FB) 0%,
            #EFF6FE 65%,
            var(--color-cream, #F7F2E4) 100%
          );
          transition: background 900ms ease;
        }
        .vitrina-sky-bg.is-settled {
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--color-cream, #F7F2E4) 88%, white) 0%,
            var(--color-cream, #F7F2E4) 72%,
            var(--color-cream-dark, #EFE5D0) 100%
          );
        }
        .vitrina-sky-gradient {
          position: absolute;
          inset: 0;
          opacity: 0.45;
          mix-blend-mode: screen;
          pointer-events: none;
          transition: opacity 900ms ease;
        }
        .vitrina-sky-bg.is-settled .vitrina-sky-gradient {
          opacity: 0.08;
        }
        .vitrina-cloud {
          position: absolute;
          left: -20%;
          filter: blur(2px) drop-shadow(0 4px 12px rgba(63, 125, 214, 0.12));
          animation-name: vitrina-cloud-drift;
          animation-iteration-count: infinite;
          animation-timing-function: linear;
          pointer-events: none;
          transition: opacity 900ms ease, filter 900ms ease;
        }
        .vitrina-sky-bg.is-settled .vitrina-cloud {
          opacity: 0.18 !important;
          filter: blur(3px) drop-shadow(0 4px 12px rgba(63, 125, 214, 0.05));
        }
        @keyframes vitrina-cloud-drift {
          from { transform: translateX(0) translateY(0); }
          50%  { transform: translateX(65vw) translateY(-1%); }
          to   { transform: translateX(130vw) translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .vitrina-cloud { animation: none; }
          .vitrina-sky-gradient { display: none; }
        }
      `}</style>
    </div>
  );
}
