export function TopRightChrome({
  threadCount,
  basketCount = 0,
  onOpenChats,
  onOpenBrowse,
  onOpenBasket,
}: {
  threadCount: number;
  basketCount?: number;
  onOpenChats: () => void;
  onOpenBrowse: () => void;
  onOpenBasket: () => void;
}) {
  return (
    <div className="vitrina-top-chrome" aria-label="Vitrina navigation">
      <button type="button" className="vitrina-top-pill" onClick={onOpenChats}>
        <span className="vitrina-pill-label">Chats</span>
        {threadCount > 0 ? <span className="vitrina-pill-count">{threadCount}</span> : null}
      </button>
      <button type="button" className="vitrina-top-pill" onClick={onOpenBrowse}>
        <span className="vitrina-pill-label">Browse</span>
      </button>
      <button
        type="button"
        className={`vitrina-top-pill ${basketCount > 0 ? 'is-accent' : ''}`}
        onClick={onOpenBasket}
      >
        <span className="vitrina-pill-label">Basket</span>
        {basketCount > 0 ? <span className="vitrina-pill-count">{basketCount}</span> : null}
      </button>

      <style>{`
        .vitrina-top-chrome {
          position: fixed;
          top: max(14px, calc(env(safe-area-inset-top) + 10px));
          right: max(14px, calc(env(safe-area-inset-right) + 14px));
          z-index: 40;
          display: flex;
          gap: 6px;
          padding: 6px;
          border-radius: var(--r-pill, 999px);
          border: 1px solid color-mix(in srgb, var(--color-border) 72%, transparent);
          background: color-mix(in srgb, var(--color-card) 78%, transparent);
          backdrop-filter: blur(18px);
          box-shadow: 0 18px 60px -38px rgba(31, 75, 150, 0.55);
        }
        .vitrina-top-pill {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 0 12px;
          border: none;
          border-radius: var(--r-pill, 999px);
          color: var(--color-ink);
          background: transparent;
          font: inherit;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background 160ms ease, color 160ms ease;
        }
        .vitrina-top-pill:hover,
        .vitrina-top-pill:focus-visible {
          background: color-mix(in srgb, var(--color-cream-dark) 72%, white);
          outline: none;
        }
        .vitrina-top-pill.is-accent {
          background: var(--user-bubble-bg, var(--color-sky-light));
          color: var(--user-bubble-text, var(--color-ink));
        }
        .vitrina-pill-count {
          min-width: 18px;
          height: 18px;
          display: inline-grid;
          place-items: center;
          padding: 0 5px;
          border-radius: var(--r-pill, 999px);
          background: var(--color-ink);
          color: var(--color-card);
          font-size: 0.72rem;
          line-height: 1;
        }
        @media (max-width: 360px) {
          .vitrina-pill-label { display: none; }
          .vitrina-top-pill { padding-inline: 10px; }
        }
      `}</style>
    </div>
  );
}
