/**
 * InComponentLoadingOverlay — reusable vellum overlay for async work
 * that belongs to one component, not the entire app.
 *
 * Use this when the user should keep spatial context (e.g. "this basket
 * is clearing") instead of being thrown into a full-screen loader. The
 * parent component should have a positioned box (`position: relative` or
 * already absolute/fixed); the overlay fills that box only.
 */

import { DoodleSpinner } from '../discover/DiscoverLoadingScreen';

export function InComponentLoadingOverlay({
  label = 'Working…',
  size = 72,
}: {
  label?: string;
  size?: number;
}) {
  return (
    <div className="vitrina-component-loading" role="status" aria-live="polite">
      <div className="vitrina-component-loading__card">
        <DoodleSpinner size={size} />
        <span>{label}</span>
      </div>

      <style>{`
        .vitrina-component-loading {
          position: absolute;
          inset: 0;
          z-index: 12;
          display: grid;
          place-items: center;
          padding: 24px;
          background:
            linear-gradient(
              180deg,
              color-mix(in srgb, var(--color-card) 72%, transparent),
              color-mix(in srgb, var(--color-cream) 78%, transparent)
            );
          backdrop-filter: blur(16px) saturate(1.08);
          -webkit-backdrop-filter: blur(16px) saturate(1.08);
        }
        .vitrina-component-loading__card {
          display: grid;
          justify-items: center;
          gap: 12px;
          color: var(--color-ink);
          font-family: var(--font-display);
          font-size: 0.92rem;
          font-weight: 600;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
