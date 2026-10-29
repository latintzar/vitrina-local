/**
 * Extracted CSS for BrowsePage.
 *
 * Lives in its own file because `tsc -b` chokes on long inline
 * template-literal CSS blocks inside JSX (see ShopDetail for the same
 * pattern). Keeping the styles next to the component preserves
 * locality without breaking the type-checker.
 */
export const BROWSE_PAGE_CSS = `
.vitrina-browse-page {
  position: fixed;
  inset: 0;
  z-index: 1;
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
}
.vitrina-browse-map {
  position: absolute;
  inset: calc(env(safe-area-inset-top, 0px) + 64px) 0 76px 0;
}
.vitrina-browse-userpin {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #2a8cf2;
  border: 3px solid #fff;
  box-shadow: 0 0 0 4px rgba(42, 140, 242, 0.18);
}
.vitrina-browse-shoppin {
  /* Mapbox positions the marker via transform on the parent;
     the child must be a normal block so its width/height
     actually apply (using all-unset collapsed it to inline,
     which made pins drift / not appear locked to coords). */
  display: block;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  border: 2px solid #fff;
  background: #2a2420;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 4px 14px -4px rgba(31, 75, 150, 0.45);
  font: inherit;
  color: inherit;
}
.vitrina-browse-shoppin:hover { transform: scale(1.15); }
.vitrina-browse-scroller {
  position: absolute;
  inset: calc(env(safe-area-inset-top, 0px) + 64px) 0 76px 0;
  z-index: 2;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  /* Let taps in the transparent spacer area pass through to the
     Mapbox canvas underneath. Without this, the scroller's own
     hit-test box swallowed every drag/pinch above the shop card,
     making the map non-interactive even though it's clearly
     visible. The card and grabber explicitly opt back in below. */
  pointer-events: none;
}
.vitrina-browse-spacer {
  height: min(58vh, calc(100dvh - 230px));
  pointer-events: none;
}
.vitrina-browse-card {
  pointer-events: auto;
  position: relative;
  left: 0;
  right: 0;
  z-index: 1;
  display: grid;
  gap: 10px;
  min-height: calc(100% - 38px);
  padding: 8px 14px calc(env(safe-area-inset-bottom, 0px) + 22px);
  background: var(--color-card);
  border-radius: 6px 6px 0 0;
  box-shadow: 0 -22px 60px -28px rgba(60, 45, 30, 0.4);
}
.vitrina-browse-grabber {
  display: grid;
  justify-self: center;
  width: 44px;
  height: 4px;
  margin: 4px 0 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-ink) 22%, transparent);
}
.vitrina-browse-card__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 6px 4px 8px;
  font-size: 0.95rem;
}
.vitrina-browse-card__header strong {
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 1.04rem;
}
.vitrina-browse-card__header span {
  color: var(--color-ink-light);
  font-size: 0.82rem;
  text-align: right;
}
.vitrina-browse-list {
  display: grid;
  gap: 10px;
  padding-bottom: 18px;
}
.vitrina-browse-row {
  all: unset;
  cursor: pointer;
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  transition: background 160ms ease;
}
.vitrina-browse-row:hover, .vitrina-browse-row.is-highlight {
  background: color-mix(in srgb, var(--color-ink) 5%, transparent);
}
.vitrina-browse-row__cover {
  width: 56px;
  height: 56px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-cream-dark);
  display: grid;
  place-items: center;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 1.4rem;
}
.vitrina-browse-row__cover img {
  width: 100%; height: 100%; object-fit: cover;
}
.vitrina-browse-row__body { display: grid; gap: 2px; }
.vitrina-browse-row__body strong { color: var(--color-ink); font-size: 0.95rem; }
.vitrina-browse-row__body span { color: var(--color-ink-light); font-size: 0.8rem; }
.vitrina-browse-state { padding: 18px; text-align: center; color: var(--color-ink-light); }
`;
