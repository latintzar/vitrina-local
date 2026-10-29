/**
 * Scoped styles for ShopDetail — extracted so the project build does not
 * mis-parse the giant template literal next to other JSX.
 */
export const SHOP_DETAIL_CSS = `
        .vitrina-sd {
          /* Live INSIDE the standard tab content area, but reserve room
             at the top for the fixed app navbar and at the bottom for
             the fixed bottom-nav. We constrain horizontal overflow at
             the page root so any rogue h-scroll row inside (categories,
             product carousel) cannot drag the whole document sideways
             — that's what was breaking the bottom-nav alignment. */
          padding-top: calc(env(safe-area-inset-top, 0px) + 80px);
          padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
          display: flex;
          flex-direction: column;
          gap: 14px;
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }

        /* Hero strip — full bleed image, then meta in a stacked block.
           No card wash; the image leads. */
        .vitrina-sd__hero {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin: 0 -12px;
        }
        .vitrina-sd__back {
          position: absolute;
          top: 12px;
          left: 22px;
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          padding: 0;
          margin: 0;
          border: 0;
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-card) 95%, transparent);
          color: var(--color-ink);
          cursor: pointer;
          z-index: 2;
          box-shadow: 0 2px 6px color-mix(in srgb, var(--color-ink) 16%, transparent);
        }
        .vitrina-sd__heroimg {
          width: 100%;
          height: 200px;
          background-color: var(--color-cream-dark);
          background-size: cover;
          background-position: center;
          display: grid;
          place-items: center;
          color: var(--color-ink);
          font-family: var(--font-display);
          font-size: 3rem;
          font-weight: 600;
        }
        .vitrina-sd__intro {
          padding: 0 16px;
          display: grid;
          gap: 6px;
        }
        .vitrina-sd__intro h1 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.55rem;
          font-weight: 600;
          color: var(--color-ink);
          letter-spacing: -0.02em;
          line-height: 1.1;
        }
        .vitrina-sd__subline {
          margin: 0;
          color: var(--color-ink-light);
          font-size: 0.88rem;
          line-height: 1.4;
        }
        .vitrina-sd__chips {
          display: flex;
          gap: 8px;
          margin-top: 4px;
          flex-wrap: wrap;
        }
        .vitrina-sd__chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-ink) 6%, transparent);
          color: var(--color-ink);
          font-size: 0.84rem;
          text-decoration: none;
          font-weight: 500;
        }
        .vitrina-sd__chip--accent {
          background: var(--color-ink);
          color: var(--color-card);
        }

        /* Sticky search + categories bar. The top offset matches navbar
           height (env safe-area + ~64px) so it slides under the navbar. */
        .vitrina-sd__bar {
          position: sticky;
          top: calc(env(safe-area-inset-top, 0px) + 60px);
          z-index: 10;
          display: grid;
          gap: 8px;
          padding: 8px 0;
          margin: 0 -12px;
          background: color-mix(in srgb, var(--color-cream) 92%, transparent);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }
        .vitrina-sd__search {
          position: relative;
          display: flex;
          align-items: center;
          margin: 0 12px;
          padding: 0 12px;
          height: 44px;
          background: var(--color-card);
          border: 1px solid color-mix(in srgb, var(--color-ink) 9%, transparent);
          border-radius: 6px;
        }
        .vitrina-sd__search-icon { color: var(--color-ink-light); margin-right: 8px; }
        .vitrina-sd__search input {
          flex: 1;
          height: 100%;
          border: 0;
          background: transparent;
          color: var(--color-ink);
          font: inherit;
          outline: none;
        }
        .vitrina-sd__search input::placeholder { color: var(--color-ink-light); }
        .vitrina-sd__search-clear {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-ink) 6%, transparent);
          color: var(--color-ink);
          cursor: pointer;
        }
        .vitrina-sd__pills {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 4px 12px 8px;
          scrollbar-width: none;
        }
        .vitrina-sd__pills::-webkit-scrollbar { display: none; }
        .vitrina-sd__pills button {
          flex: 0 0 auto;
          padding: 8px 14px;
          border: 0;
          background: transparent;
          color: var(--color-ink-light);
          font: inherit;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          border-radius: 6px;
          transition: color 140ms ease, background 140ms ease;
          position: relative;
        }
        .vitrina-sd__pills button.is-active {
          color: var(--color-ink);
        }
        .vitrina-sd__pills button.is-active::after {
          content: '';
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 0;
          height: 2px;
          background: var(--color-ink);
          border-radius: 2px;
        }

        .vitrina-sd__state {
          padding: 22px;
          text-align: center;
          color: var(--color-ink-light);
          background: var(--color-card);
          border-radius: 6px;
          font-size: 0.92rem;
        }

        .vitrina-sd__sections {
          display: grid;
          gap: 18px;
        }
        .vitrina-sd__section {
          display: grid;
          gap: 8px;
          /* Push first item slightly so the sticky bar doesn't cover the
             category title when the user clicks a pill. */
          scroll-margin-top: 140px;
        }
        .vitrina-sd__section h3 {
          margin: 4px 4px 0;
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--color-ink);
          letter-spacing: -0.01em;
        }
        .vitrina-sd__row {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          padding: 4px 4px 8px;
          scrollbar-width: none;
        }
        .vitrina-sd__row::-webkit-scrollbar { display: none; }
        .vitrina-sd__row--wrap {
          flex-wrap: wrap;
          overflow-x: visible;
        }

        .vitrina-sd__searchresults h3 {
          margin: 4px 4px 4px;
          font-family: var(--font-display);
          font-size: 1.05rem;
          color: var(--color-ink);
        }

        /* === Compact product card (h-scroll member). 3 visible per row
              on a 360-380px viewport: card width = (100% - 2 gaps) / 3. */
        .vitrina-sd__card {
          flex: 0 0 calc((100% - 20px) / 3);
          min-width: 110px;
          max-width: 180px;
          scroll-snap-align: start;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 0;
          border-radius: 6px;
          background: var(--color-card);
          cursor: pointer;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--color-ink) 6%, transparent);
        }
        .vitrina-sd__row--wrap .vitrina-sd__card {
          flex: 0 0 calc((100% - 20px) / 3);
        }
        @media (min-width: 720px) {
          .vitrina-sd__card { flex-basis: 200px; }
          .vitrina-sd__row--wrap .vitrina-sd__card { flex: 0 0 200px; }
        }
        .vitrina-sd__card-img {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          background: var(--color-cream-dark);
          display: grid;
          place-items: center;
          color: var(--color-ink);
          font-family: var(--font-display);
          font-size: 1.4rem;
        }
        .vitrina-sd__card-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .vitrina-sd__card-oos {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          background: color-mix(in srgb, var(--color-card) 70%, transparent);
          color: var(--color-ink);
          font-size: 0.78rem;
          font-weight: 600;
        }
        .vitrina-sd__card-add {
          position: absolute;
          right: 6px;
          bottom: 6px;
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          padding: 0;
          margin: 0;
          border: 0;
          border-radius: 999px;
          background: var(--color-card);
          color: var(--color-ink);
          cursor: pointer;
          box-shadow: 0 4px 14px -4px rgba(0, 0, 0, 0.35),
                      0 0 0 1px color-mix(in srgb, var(--color-ink) 10%, transparent);
          transition: transform 140ms ease;
        }
        .vitrina-sd__card-add:hover { transform: scale(1.06); }
        .vitrina-sd__card-add:disabled {
          color: color-mix(in srgb, var(--color-ink) 30%, transparent);
          cursor: not-allowed;
        }
        .vitrina-sd__card-stepper {
          position: absolute;
          right: 6px;
          bottom: 6px;
          display: inline-flex;
          align-items: center;
          gap: 0;
          padding: 2px;
          border-radius: 999px;
          background: var(--color-ink);
          color: var(--color-card);
          box-shadow: 0 4px 14px -4px rgba(0, 0, 0, 0.35);
        }
        .vitrina-sd__card-stepper button {
          display: grid;
          place-items: center;
          width: 26px;
          height: 26px;
          border: 0;
          padding: 0;
          background: transparent;
          color: var(--color-card);
          cursor: pointer;
          border-radius: 999px;
        }
        .vitrina-sd__card-stepper button:disabled { opacity: 0.5; cursor: not-allowed; }
        .vitrina-sd__card-stepper span {
          min-width: 18px;
          text-align: center;
          font-family: var(--font-sans, 'Source Sans 3', system-ui, sans-serif);
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: var(--color-card);
          font-size: 0.82rem;
        }
        .vitrina-sd__card-body {
          padding: 6px 8px 10px;
          display: grid;
          gap: 2px;
        }
        .vitrina-sd__card-name {
          color: var(--color-ink);
          font-size: 0.82rem;
          line-height: 1.2;
          font-weight: 500;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .vitrina-sd__card-price {
          color: var(--color-ink);
          font-size: 0.84rem;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
        .vitrina-sd__card-unit {
          color: var(--color-ink-light);
          font-size: 0.74rem;
          font-weight: 400;
          margin-left: 4px;
        }

        .vitrina-sd__sheet {
          position: fixed;
          inset: 0;
          z-index: 110;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 14px;
          background: color-mix(in srgb, var(--color-ink-black, #2a2420) 30%, transparent);
          backdrop-filter: blur(8px);
        }
        .vitrina-sd__sheet-card {
          position: relative;
          width: min(440px, 100%);
          padding: 16px;
          display: grid;
          gap: 12px;
          background: var(--color-card);
          border-radius: 6px;
        }
        .vitrina-sd__sheet-card img {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 6px;
          background: var(--color-cream-dark);
        }
        .vitrina-sd__sheet-card h3 {
          margin: 0;
          font-family: var(--font-display);
          color: var(--color-ink);
          font-size: 1.3rem;
          font-weight: 600;
        }
        .vitrina-sd__sheet-card p {
          margin: 0;
          color: var(--color-ink-light);
          line-height: 1.45;
          font-size: 0.92rem;
        }
        .vitrina-sd__sheet-close {
          position: absolute;
          top: 12px;
          right: 12px;
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-ink) 7%, transparent);
          color: var(--color-ink);
          cursor: pointer;
        }
        .vitrina-sd__sheet-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.92rem;
          color: var(--color-ink-light);
        }
        .vitrina-sd__sheet-meta strong {
          color: var(--color-ink);
          font-size: 1.1rem;
        }
`;
