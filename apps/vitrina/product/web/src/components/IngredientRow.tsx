/**
 * IngredientRow — single line in either a recipe card OR the basket.
 *
 * Layout (mobile-first, de-cluttered 2026-04-28):
 *
 *   ┌──────┬─────────────────────────────────┬─────────┐
 *   │ thumb│ Name                       [⇄]  │  price  │
 *   │ top  │ Need · Sold as · Buy            │  qty    │
 *   └──────┴─────────────────────────────────┴─────────┘
 *
 * Three things changed vs the previous "needs / sold as / buy" card:
 *
 *  1. Thumb aligns to the TOP of the text column (`align-items: start`
 *     on the row + `align-self: start` on the thumb). Centreing the
 *     thumb against a tall stack read as "misaligned" in basket QA.
 *  2. Quantity collapses from a three-cell mini-grid into one muted
 *     middot-separated sentence. Same data, less furniture.
 *  3. Substitutions move out of the row entirely — a circular Replace
 *     chip sits next to the name; tap opens a centred sheet that uses
 *     the same backdrop + card rhythm as ``SchedulePickerModal`` so
 *     we don't introduce a second modal style.
 *
 * Right cell rules unchanged — price + stepper stay right-aligned.
 */

import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, Replace, Trash2, X } from 'lucide-react';
import type { IngredientQuantityBreakdown } from './ingredientQuantity';

interface IngredientRowProps {
  name: string;
  /** Matcher's substitution note. When set, a Replace chip appears
   *  next to the name and the full note opens in a tap-to-view sheet. */
  substitution?: string | null;
  /** Free-form recipe quantity ("2 tbsp", "300 g"). Empty/falsy hides the cell. */
  quantity?: string | number | null;
  /** Accessible quantity math: recipe need, pack size sold, units to buy. */
  quantityBreakdown?: IngredientQuantityBreakdown | null;
  /** Optional product image URL — small thumbnail rendered on the left. */
  imageUrl?: string | null;
  /** Right-hand cell. For recipes a price string; for basket a stepper+price. */
  right: ReactNode;
}

export function IngredientRow({
  name,
  substitution,
  quantity,
  quantityBreakdown,
  imageUrl,
  right,
}: IngredientRowProps) {
  const qty = formatQuantity(quantity);
  const displayName = titleCase(name);
  const initials = monogram(displayName);
  const [swapOpen, setSwapOpen] = useState(false);
  const swapDialogId = useId();
  const swapTitleId = useId();

  // While the substitution sheet is open: close on Esc + freeze the
  // page underneath. Without the body-scroll lock, iOS Safari happily
  // scrolls the basket behind the backdrop and the sheet feels glued
  // to the page rather than floating above it.
  useEffect(() => {
    if (!swapOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSwapOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [swapOpen]);

  return (
    <li className="vitrina-irow">
      <div className="vitrina-irow__thumb" aria-hidden>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            onError={(event) => {
              const img = event.currentTarget;
              img.style.display = 'none';
              const parent = img.parentElement;
              if (parent && !parent.querySelector('.vitrina-irow__mono')) {
                const span = document.createElement('span');
                span.className = 'vitrina-irow__mono';
                span.textContent = initials;
                parent.appendChild(span);
              }
            }}
          />
        ) : (
          <span className="vitrina-irow__mono">{initials}</span>
        )}
      </div>
      <div className="vitrina-irow__main">
        <div className="vitrina-irow__nameRow">
          <span className="vitrina-irow__name">{displayName}</span>
          {substitution ? (
            <button
              type="button"
              className="vitrina-irow__swap-chip"
              aria-label="View substitution"
              aria-expanded={swapOpen}
              aria-haspopup="dialog"
              aria-controls={swapOpen ? swapDialogId : undefined}
              onClick={() => setSwapOpen(true)}
            >
              <Replace size={13} strokeWidth={2.2} aria-hidden />
            </button>
          ) : null}
        </div>
        {quantityBreakdown ? (
          <p
            className="vitrina-irow__qtyline"
            aria-label={`Need ${quantityBreakdown.needLabel}, sold as ${quantityBreakdown.soldAsLabel}, buy ${quantityBreakdown.unitsLabel}`}
          >
            <span className="vitrina-irow__qtyline__seg">
              <span className="vitrina-irow__qtyline__k">Need</span>{' '}
              <span className="vitrina-irow__qtyline__v">{quantityBreakdown.needLabel}</span>
            </span>
            <span className="vitrina-irow__qtyline__dot" aria-hidden>
              ·
            </span>
            <span className="vitrina-irow__qtyline__seg">
              <span className="vitrina-irow__qtyline__k">Sold as</span>{' '}
              <span className="vitrina-irow__qtyline__v">{quantityBreakdown.soldAsLabel}</span>
            </span>
            <span className="vitrina-irow__qtyline__dot" aria-hidden>
              ·
            </span>
            <span className="vitrina-irow__qtyline__seg">
              <span className="vitrina-irow__qtyline__k">Buy</span>{' '}
              <span className="vitrina-irow__qtyline__v">{quantityBreakdown.unitsLabel}</span>
            </span>
          </p>
        ) : null}
      </div>
      <span className="vitrina-irow__right">
        <span className="vitrina-irow__right-main">{right}</span>
        {!quantityBreakdown && qty ? <span className="vitrina-irow__right-qty">{qty}</span> : null}
      </span>

      {swapOpen && substitution
        ? createPortal(
            <div
              className="vitrina-irow-swapdlg"
              role="presentation"
              onClick={() => setSwapOpen(false)}
            >
              <div
                id={swapDialogId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={swapTitleId}
                className="vitrina-irow-swapdlg__card"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="vitrina-irow-swapdlg__head">
                  <h2 id={swapTitleId}>Substitution</h2>
                  <button
                    type="button"
                    className="vitrina-irow-swapdlg__close"
                    aria-label="Close"
                    onClick={() => setSwapOpen(false)}
                  >
                    <X size={18} strokeWidth={2.2} />
                  </button>
                </header>
                <p className="vitrina-irow-swapdlg__for">
                  <strong>{displayName}</strong>
                </p>
                <p className="vitrina-irow-swapdlg__body">{substitution}</p>
              </div>
            </div>,
            document.body,
          )
        : null}

      <style>{`
        .vitrina-irow {
          display: grid;
          grid-template-columns: 44px 1fr auto;
          column-gap: 12px;
          align-items: start;
          padding: 10px 0;
          border-top: 1px solid color-mix(in srgb, var(--color-ink) 6%, transparent);
        }
        .vitrina-irow:first-child { border-top: 0; padding-top: 6px; }
        .vitrina-irow__thumb {
          width: 44px;
          height: 44px;
          border-radius: 6px;
          background: color-mix(in srgb, var(--color-ink) 6%, transparent);
          overflow: hidden;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          align-self: start;
        }
        .vitrina-irow__thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .vitrina-irow__mono {
          font-family: var(--font-display);
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--color-ink-light);
          letter-spacing: -0.01em;
        }
        .vitrina-irow__main {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .vitrina-irow__nameRow {
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 8px;
          min-width: 0;
        }
        .vitrina-irow__name {
          flex: 1 1 auto;
          min-width: 0;
          color: var(--color-ink);
          font-size: 0.92rem;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }
        .vitrina-irow__swap-chip {
          flex-shrink: 0;
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          margin: -2px 0 0;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-ink) 7%, transparent);
          color: var(--color-ink);
          cursor: pointer;
          transition: background 140ms ease, transform 140ms ease;
        }
        .vitrina-irow__swap-chip:hover {
          background: color-mix(in srgb, var(--color-ink) 11%, transparent);
        }
        .vitrina-irow__swap-chip:active { transform: scale(0.96); }

        .vitrina-irow__qtyline {
          margin: 2px 0 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 0 6px;
          color: var(--color-ink-light);
          font-size: 0.76rem;
          line-height: 1.4;
        }
        .vitrina-irow__qtyline__seg {
          display: inline;
          white-space: nowrap;
        }
        .vitrina-irow__qtyline__k {
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          font-size: 0.6rem;
          color: var(--color-ink-light);
          opacity: 0.92;
        }
        .vitrina-irow__qtyline__v {
          color: var(--color-ink);
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
        .vitrina-irow__qtyline__dot {
          color: color-mix(in srgb, var(--color-ink) 28%, transparent);
          font-weight: 700;
          user-select: none;
        }

        .vitrina-irow__right {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          justify-self: end;
          align-self: start;
          padding-top: 2px;
          color: var(--color-ink);
          font-variant-numeric: tabular-nums;
          line-height: 1.2;
        }
        .vitrina-irow__right-main {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
        }
        .vitrina-irow__right-qty {
          color: var(--color-ink-light);
          font-size: 0.78rem;
          font-variant-numeric: tabular-nums;
        }

        /* Substitution sheet — same backdrop + card rhythm as
           SchedulePickerModal (.vitrina-sched). */
        .vitrina-irow-swapdlg {
          position: fixed;
          inset: 0;
          z-index: 125;
          display: grid;
          place-items: center;
          padding: 18px;
          background: color-mix(in srgb, #1a1a1a 35%, transparent);
          backdrop-filter: blur(2px);
          animation: vitrina-swapdlg-in 140ms ease-out;
        }
        @keyframes vitrina-swapdlg-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .vitrina-irow-swapdlg__card {
          width: 100%;
          max-width: 340px;
          max-height: calc(100% - 36px);
          overflow-y: auto;
          background: var(--color-card, #fff);
          color: var(--color-ink);
          border-radius: 6px;
          box-shadow: 0 24px 60px -12px color-mix(in srgb, #1a1a1a 35%, transparent);
          padding: 14px 16px 18px;
          display: grid;
          gap: 10px;
          animation: vitrina-swapdlg-card 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @keyframes vitrina-swapdlg-card {
          from { transform: translateY(8px) scale(0.98); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .vitrina-irow-swapdlg__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .vitrina-irow-swapdlg__head h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.02rem;
          font-weight: 600;
          letter-spacing: -0.015em;
          color: var(--color-ink);
        }
        .vitrina-irow-swapdlg__close {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          padding: 0;
          margin: 0;
          border: 0;
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-ink) 5%, transparent);
          color: var(--color-ink);
          cursor: pointer;
        }
        .vitrina-irow-swapdlg__close:hover {
          background: color-mix(in srgb, var(--color-ink) 10%, transparent);
        }
        .vitrina-irow-swapdlg__for {
          margin: 0;
          font-size: 0.84rem;
          color: var(--color-ink-light);
        }
        .vitrina-irow-swapdlg__for strong {
          color: var(--color-ink);
          font-weight: 600;
        }
        .vitrina-irow-swapdlg__body {
          margin: 0;
          font-size: 0.88rem;
          line-height: 1.45;
          color: var(--color-ink);
        }
      `}</style>
    </li>
  );
}

function formatQuantity(qty: unknown): string {
  if (qty === null || qty === undefined) return '';
  if (typeof qty === 'number') {
    return Number.isInteger(qty) ? String(qty) : qty.toFixed(2);
  }
  // Normalise unit casing ("300 G" → "300 g", "2 TBSP" → "2 tbsp") and
  // collapse whitespace so the numeric column reads as a tidy stack.
  return String(qty)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/\b(KG|G|ML|L|TBSP|TSP|OZ|LB|LBS|CL|PCS)\b/g, (m) => m.toLowerCase());
}

// Recipe ingredients land from the matcher in lower-case ("burger
// bun", "ground beef"). We Title Case them on render so the recipe
// card reads like a menu — proper nouns and brand-y words get
// capitalised, generic prepositions stay lower-case to keep it
// readable ("Olive Oil", "Pasta with Cream").
const SMALL_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on',
  'or', 'the', 'to', 'with',
]);

function titleCase(input: string): string {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return '';
  // Don't fight the user — if anything is already upper-cased, assume
  // it was deliberate (acronyms, brand quirks).
  if (/[A-Z]/.test(trimmed) && trimmed !== trimmed.toLowerCase()) return trimmed;
  return trimmed
    .split(/(\s+|[-/])/) // keep spaces, hyphens, slashes between words
    .map((part, i) => {
      if (!part || /^\s+$/.test(part) || part === '-' || part === '/') return part;
      const lower = part.toLowerCase();
      if (i !== 0 && SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

function monogram(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '·';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface QtyStepperProps {
  qty: number;
  onDecrement: () => void;
  onIncrement: () => void;
  /** Render a trash icon at the far end when qty=1, instead of leaving the
      minus button to do double-duty as "remove". */
  showTrashAtOne?: boolean;
  /** "sm" = 28px (basket rows). "md" = 36px (modal portion picker / hero). */
  size?: 'sm' | 'md';
  /** Optional unit label (e.g. "portions") to render to the right. */
  unitLabel?: string | null;
  min?: number;
  max?: number;
}

export function QtyStepper({
  qty,
  onDecrement,
  onIncrement,
  showTrashAtOne = true,
  size = 'sm',
  unitLabel,
  min = 1,
  max = 99,
}: QtyStepperProps) {
  const isAtMin = qty <= min;
  const showTrash = isAtMin && showTrashAtOne;
  const isAtMax = qty >= max;
  return (
    <div className={`vitrina-stepper vitrina-stepper--${size}`} role="group" aria-label="Quantity">
      <button
        type="button"
        className="vitrina-stepper__btn"
        onClick={onDecrement}
        aria-label={showTrash ? 'Remove' : 'Decrease'}
        disabled={isAtMin && !showTrashAtOne}
      >
        {showTrash ? (
          <Trash2 size={size === 'md' ? 17 : 15} strokeWidth={2} />
        ) : (
          <Minus size={size === 'md' ? 18 : 16} strokeWidth={2.2} />
        )}
      </button>
      <span className="vitrina-stepper__val" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        className="vitrina-stepper__btn"
        onClick={onIncrement}
        aria-label="Increase"
        disabled={isAtMax}
      >
        <Plus size={size === 'md' ? 18 : 16} strokeWidth={2.2} />
      </button>
      {unitLabel ? <em className="vitrina-stepper__unit">{unitLabel}</em> : null}

      <style>{`
        .vitrina-stepper {
          display: inline-flex;
          align-items: center;
          gap: 0;
          background: color-mix(in srgb, var(--color-ink) 5%, transparent);
          border-radius: 999px;
          padding: 2px;
        }
        .vitrina-stepper--sm .vitrina-stepper__btn { width: 28px; height: 28px; }
        .vitrina-stepper--md .vitrina-stepper__btn { width: 36px; height: 36px; }
        .vitrina-stepper__btn {
          display: grid;
          place-items: center;
          border: 0;
          padding: 0;
          background: transparent;
          color: var(--color-ink);
          border-radius: 999px;
          cursor: pointer;
          transition: background 140ms ease, color 140ms ease;
        }
        .vitrina-stepper__btn:hover {
          background: color-mix(in srgb, var(--color-ink) 7%, transparent);
        }
        .vitrina-stepper__btn:disabled {
          color: color-mix(in srgb, var(--color-ink) 28%, transparent);
          cursor: not-allowed;
          background: transparent;
        }
        .vitrina-stepper__val {
          min-width: 1.6em;
          text-align: center;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: var(--color-ink);
        }
        .vitrina-stepper--md .vitrina-stepper__val {
          font-size: 1.05rem;
          min-width: 1.8em;
        }
        .vitrina-stepper__unit {
          margin-left: 8px;
          font-style: normal;
          color: var(--color-ink-light);
          font-size: 0.84rem;
        }
      `}</style>
    </div>
  );
}
