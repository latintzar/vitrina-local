/**
 * ShopGroup — typographic header + ingredient list. Used by both
 * RecipeModal and BasketSheet so a recipe's items look identical in
 * both surfaces (Peter's "absolute consistency" rule).
 *
 * No surrounding card — the header is set bold, with a hairline rule
 * below, and the items flow underneath. Optional walking pill (recipe
 * card) or directions icon (basket).
 */

import type { ReactNode } from 'react';
import { ChevronRight, MapPin } from 'lucide-react';

interface ShopGroupProps {
  name: string;
  /** When provided, renders a small "N min" walking pill. */
  walkingMinutes?: number | null;
  /** When provided, renders a tap-target directions button (Maps deep link). */
  directionsHref?: string;
  /** Optional address line shown under the shop name in muted small text. */
  address?: string | null;
  /** When true, renders a chevron at the END of the title row, signalling
      that the whole group is tappable (parent <a> handles navigation). */
  showChevron?: boolean;
  children: ReactNode;
}

/**
 * Walking glyph — solid Solar-style body + swinging legs, matches the
 * svgrepo `walking.svg` icon (id 526428) Peter linked. We inline rather
 * than fetch so the recipe card has zero extra network deps.
 */
const WalkingGlyph = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    <circle cx="13" cy="3.5" r="2.1" />
    <path d="M11.7 7.4c-.6 0-1.2.3-1.5.9L8.1 12l-2.4.6a1 1 0 0 0 .5 1.95l3-.75c.3-.07.55-.27.7-.55l.85-1.6.65 2.05-2.1 2.4a1 1 0 0 0-.25.6l-.6 4.4a1.05 1.05 0 0 0 2.08.3l.6-4 1.85-2.05 1.05 2.55 1.6 2.95a1.05 1.05 0 0 0 1.85-1l-1.55-2.85-1.4-3.95.95.7.85 1.85a1 1 0 0 0 1.85-.85l-1-2.2a2.1 2.1 0 0 0-.7-.85l-2.45-1.7a2.1 2.1 0 0 0-1.2-.4z" />
  </svg>
);

export function ShopGroup({
  name,
  walkingMinutes,
  directionsHref,
  address,
  showChevron = false,
  children,
}: ShopGroupProps) {
  return (
    <section className="vitrina-shopgrp">
      <header className="vitrina-shopgrp__head">
        <div className="vitrina-shopgrp__title">
          <strong>{name}</strong>
          {address ? <span className="vitrina-shopgrp__addr">{address}</span> : null}
        </div>
        <div className="vitrina-shopgrp__aside">
          {typeof walkingMinutes === 'number' ? (
            <span
              className="vitrina-shopgrp__walk"
              aria-label={`${walkingMinutes} minute walk`}
            >
              <WalkingGlyph />
              <span>{walkingMinutes} min</span>
            </span>
          ) : null}
          {directionsHref ? (
            <a
              className="vitrina-shopgrp__dir"
              href={directionsHref}
              target="_blank"
              rel="noreferrer"
              aria-label={`Directions to ${name}`}
            >
              {/* Map-pin reads as "this place on the map", which matches
                  the action better than Lucide's `Navigation` icon
                  (filled paper-plane shape that we kept misreading as
                  a free-floating directions arrow). */}
              <MapPin size={15} strokeWidth={2.2} />
            </a>
          ) : null}
          {showChevron ? (
            <ChevronRight
              className="vitrina-shopgrp__chev"
              size={18}
              strokeWidth={2}
              aria-hidden
            />
          ) : null}
        </div>
      </header>
      <ul className="vitrina-shopgrp__list">{children}</ul>

      <style>{`
        .vitrina-shopgrp {
          display: grid;
          gap: 6px;
          padding: 10px 0 4px;
        }
        .vitrina-shopgrp__head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid color-mix(in srgb, var(--color-ink) 12%, transparent);
        }
        .vitrina-shopgrp__title {
          display: grid;
          gap: 1px;
          min-width: 0;
        }
        .vitrina-shopgrp__title strong {
          font-family: var(--font-display);
          color: var(--color-ink);
          font-size: 0.98rem;
          font-weight: 600;
          letter-spacing: -0.005em;
        }
        .vitrina-shopgrp__addr {
          color: var(--color-ink-light);
          font-size: 0.75rem;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .vitrina-shopgrp__aside {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .vitrina-shopgrp__walk {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-ink) 7%, transparent);
          color: var(--color-ink);
          font-size: 0.74rem;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .vitrina-shopgrp__dir {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-ink) 7%, transparent);
          color: var(--color-ink);
          text-decoration: none;
          transition: background 140ms ease;
        }
        .vitrina-shopgrp__dir:hover {
          background: color-mix(in srgb, var(--color-ink) 12%, transparent);
        }
        .vitrina-shopgrp__chev {
          color: var(--color-ink-light);
          flex-shrink: 0;
        }
        .vitrina-shopgrp__list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
        }
      `}</style>
    </section>
  );
}
