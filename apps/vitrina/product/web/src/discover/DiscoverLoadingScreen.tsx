/**
 * DiscoverLoadingScreen — full-screen warm-drift loading state shown
 * while the matched first batch of recipes is in flight.
 *
 * Rotating black-pencil doodles (lucide line icons stand in for the
 * brand's pencil illustrations until we have the full hand-drawn set
 * baked) crossfade every ~1.4s alongside rotating status copy:
 *   "Finding shops near you…"
 *   "Asking the cheesemonger…"
 *   "Hand-rolling 20 buyable recipes…"
 *
 * Layout note (2026-04-27): doodles render directly on the page
 * background — no card, no outline, no glass frame. Big and centred,
 * with the status copy underneath. Matches the brand's "pencil on
 * cream" aesthetic.
 *
 * Spec: blocks Discover until the first matched batch arrives. The
 * parent (DiscoverPage) hands us its loading flag and we self-unmount
 * via React when it flips false.
 */

import { useEffect, useState } from 'react';

// The waitlist Early Access modal scatters these eight hand-drawn
// pencil doodles at /waiting-assets/doodles/*.png — same set, same
// pencil treatment. We rotate through them one at a time, centred,
// with a soft crossfade. No background, no outline, no glass frame.
//
// Exported so smaller in-page loaders (e.g. infinite-scroll loader at
// the bottom of Discover) can reuse the same set and feel cohesive.
export const LOADING_DOODLES = [
  `${import.meta.env.BASE_URL}waiting-assets/doodles/vitrina-tomato.png`,
  `${import.meta.env.BASE_URL}waiting-assets/doodles/vitrina-blender.png`,
  `${import.meta.env.BASE_URL}waiting-assets/doodles/vitrina-can.png`,
  `${import.meta.env.BASE_URL}waiting-assets/doodles/vitrina-peeler.png`,
  `${import.meta.env.BASE_URL}waiting-assets/doodles/vitrina-taco.png`,
  `${import.meta.env.BASE_URL}waiting-assets/doodles/vitrina-spaghetti.png`,
  `${import.meta.env.BASE_URL}waiting-assets/doodles/vitrina-knife.png`,
  `${import.meta.env.BASE_URL}waiting-assets/doodles/vitrina-steak.png`,
];

const DOODLES = LOADING_DOODLES;

const STATUS_COPY = [
  'Finding shops near you…',
  'Asking the cheesemonger…',
  'Hand-rolling 20 buyable recipes…',
  'Sniffing for the freshest produce…',
  'Walking the aisles for you…',
];

export function DiscoverLoadingScreen() {
  const [doodleIdx, setDoodleIdx] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);

  useEffect(() => {
    const t1 = window.setInterval(
      () => setDoodleIdx((i) => (i + 1) % DOODLES.length),
      1400,
    );
    const t2 = window.setInterval(
      () => setStatusIdx((i) => (i + 1) % STATUS_COPY.length),
      2200,
    );
    return () => {
      window.clearInterval(t1);
      window.clearInterval(t2);
    };
  }, []);

  // We pre-render ALL doodles stacked in the same absolute slot and
  // crossfade between them by toggling `is-active`. This guarantees
  // the previous doodle is REMOVED visually (opacity 0) the moment
  // the next one fades in — not piled on top of it. Using a `key`
  // remount strategy was unreliable here (a flicker of the previous
  // PNG persisted on some devices), so we own the crossfade in CSS.
  return (
    <div className="vitrina-loading-screen" role="status" aria-live="polite">
      <div className="vitrina-loading-screen__stage" aria-hidden>
        {DOODLES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            className={
              'vitrina-loading-screen__doodle' +
              (i === doodleIdx ? ' is-active' : '')
            }
          />
        ))}
      </div>
      <p className="vitrina-loading-screen__copy" key={statusIdx}>
        {STATUS_COPY[statusIdx]}
      </p>
      <style>{`
        .vitrina-loading-screen {
          position: fixed;
          inset: 0;
          z-index: 90;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 28px;
          padding: 24px;
          background: #f6f4ee;
          color: #2a2420;
          text-align: center;
        }
        .vitrina-loading-screen__stage {
          position: relative;
          width: min(60vw, 60vh, 320px);
          height: min(60vw, 60vh, 320px);
        }
        .vitrina-loading-screen__doodle {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: transparent;
          opacity: 0;
          transform: scale(0.94);
          transition: opacity 380ms ease, transform 520ms ease;
          pointer-events: none;
        }
        .vitrina-loading-screen__doodle.is-active {
          opacity: 1;
          transform: scale(1);
        }
        .vitrina-loading-screen__copy {
          margin: 0;
          font-style: italic;
          font-size: clamp(0.98rem, 3.2vw, 1.18rem);
          color: #6b5240;
          animation: vitrina-loading-copy 520ms ease;
        }
        @keyframes vitrina-loading-copy {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/**
 * DoodleSpinner — small inline rotating-doodle loader.
 *
 * Used at the bottom of infinite-scroll lists (Discover) where we
 * want the same pencil-doodle vocabulary as the full-screen loader
 * but at thumbnail-row size, sitting under the currently-visible
 * cards while the next batch streams in.
 */
export function DoodleSpinner({ size = 56 }: { size?: number }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setIdx((i) => (i + 1) % DOODLES.length), 900);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div
      className="vitrina-doodle-spinner"
      aria-hidden
      style={{ width: size, height: size }}
    >
      {DOODLES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className={
            'vitrina-doodle-spinner__img' + (i === idx ? ' is-active' : '')
          }
        />
      ))}
      <style>{`
        .vitrina-doodle-spinner {
          position: relative;
          display: inline-block;
          background: transparent;
        }
        .vitrina-doodle-spinner__img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          opacity: 0;
          transform: scale(0.86);
          transition: opacity 320ms ease, transform 380ms ease;
          pointer-events: none;
        }
        .vitrina-doodle-spinner__img.is-active {
          opacity: 1;
          transform: scale(1);
        }
      `}</style>
    </div>
  );
}
