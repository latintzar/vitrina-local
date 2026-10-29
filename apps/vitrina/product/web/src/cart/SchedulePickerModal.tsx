/**
 * SchedulePickerModal — compact pickup-time chooser.
 *
 * Sits on top of the basket as a centred popup card (NOT a full-screen
 * route) so picking a slot feels like changing a setting on the
 * existing screen rather than navigating away. UX shape mirrors the
 * "ASAP vs Schedule" pickers in Uber Eats / DoorDash / Deliveroo:
 *
 *   ┌─ Pickup time ─────────────────────┐
 *   │  ⚡ Now · ready in ~30 min  €2.99 │  ← single-tap priority row
 *   │           "extra fee goes to shop"│
 *   │  ──────── or schedule ───────────│
 *   │  [ Today ][ Tue ][ Wed ][ Thu ]…  │  ← horizontal day chips
 *   │  ┌─────────────────────────────┐  │
 *   │  │ 12:00 – 14:00      €0.99 ✓ │  │  ← slot row
 *   │  │ 17:00 – 19:00      €0.99   │  │
 *   │  └─────────────────────────────┘  │
 *   └───────────────────────────────────┘
 *
 * Calling `onChoose(slot)` confirms and closes the modal — no extra
 * "Confirm" step; standard mobile-app pattern where tapping a row
 * IS the commitment. Backdrop click / Esc dismisses without changes.
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, X, Zap } from 'lucide-react';
import {
  fmtDay,
  fmtDayShort,
  pickableDays,
  priorityNow,
  slotsForDay,
  type Slot,
} from './fulfillment';

export interface ClosedShopForPicker {
  shop_id: string;
  shop_name?: string;
  next_open_at?: string | null;
}

export interface SchedulePickerModalProps {
  current: Slot | null;
  onClose: () => void;
  onChoose: (slot: Slot) => void;
  /**
   * If non-empty, the "Now (priority)" option is disabled with an
   * explainer — at least one cart shop is closed right now and a
   * Now-pickup couldn't be honoured. Standard scheduled slots remain
   * available because `checkout.create_multishop_group` only validates
   * "open during the booked window" for those.
   */
  closedShopsNow?: ClosedShopForPicker[];
}

function fmtNextOpen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (sameDay) return `${time}`;
  if (isTomorrow) return `tomorrow ${time}`;
  return d.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function SchedulePickerModal({
  current,
  onClose,
  onChoose,
  closedShopsNow = [],
}: SchedulePickerModalProps) {
  const nowDisabled = closedShopsNow.length > 0;
  const nowReason = (() => {
    if (!nowDisabled) return null;
    const first = closedShopsNow[0];
    const who = first.shop_name ?? 'a shop in your basket';
    const next = fmtNextOpen(first.next_open_at);
    if (closedShopsNow.length === 1) {
      return next
        ? `${who} is closed — opens ${next}. Schedule a pickup window instead.`
        : `${who} is closed right now. Schedule a pickup window instead.`;
    }
    return `${closedShopsNow.length} shops in your basket are closed right now. Schedule a pickup window instead.`;
  })();
  const now = useMemo(() => new Date(), []);
  const days = useMemo(() => pickableDays(7, now), [now]);
  const priority = useMemo(() => priorityNow(now), [now]);

  // Default the selected day to whichever day the current slot lands on
  // (so re-opening the modal lands on the user's existing choice), or
  // the first pickable day otherwise.
  const initialDayIdx = useMemo(() => {
    if (current?.startIso) {
      const startDay = new Date(current.startIso).toDateString();
      const idx = days.findIndex((d) => d.toDateString() === startDay);
      if (idx >= 0) return idx;
    }
    return 0;
  }, [current, days]);
  const [dayIdx, setDayIdx] = useState(initialDayIdx);
  const day = days[dayIdx] ?? days[0];

  const slots = useMemo(() => (day ? slotsForDay(day, now) : []), [day, now]);

  // Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="vitrina-sched"
      role="dialog"
      aria-modal="true"
      aria-label="Choose pickup time"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="vitrina-sched__card" onClick={(e) => e.stopPropagation()}>
        <header className="vitrina-sched__head">
          <h2>Pickup time</h2>
          <button
            type="button"
            className="vitrina-sched__close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </header>

        <button
          type="button"
          className={`vitrina-sched__now ${current?.kind === 'priority' ? 'is-selected' : ''} ${nowDisabled ? 'is-disabled' : ''}`}
          onClick={() => {
            if (nowDisabled) return;
            onChoose(priority);
          }}
          disabled={nowDisabled}
          aria-disabled={nowDisabled}
        >
          <span className="vitrina-sched__now-icon" aria-hidden>
            <Zap size={16} strokeWidth={2.4} />
          </span>
          <span className="vitrina-sched__now-text">
            <strong>Now · ready in ~30 min</strong>
            <span>
              {nowDisabled
                ? nowReason
                : 'Extra fee goes to the shop staff'}
            </span>
          </span>
          <span className="vitrina-sched__now-fee">
            €{priority.feeEur.toFixed(2)}
            {current?.kind === 'priority' && !nowDisabled ? <Check size={16} strokeWidth={2.6} /> : null}
          </span>
        </button>

        <div className="vitrina-sched__or" aria-hidden>
          <span>or schedule</span>
        </div>

        <div className="vitrina-sched__days" role="tablist" aria-label="Pick a day">
          {days.map((d, i) => (
            <button
              key={d.toISOString()}
              type="button"
              role="tab"
              aria-selected={i === dayIdx}
              className={`vitrina-sched__day ${i === dayIdx ? 'is-active' : ''}`}
              onClick={() => setDayIdx(i)}
            >
              <strong>{fmtDay(d, now)}</strong>
              <span>{fmtDayShort(d)}</span>
            </button>
          ))}
        </div>

        <ul className="vitrina-sched__slots">
          {slots.length === 0 ? (
            <li className="vitrina-sched__empty">No more pickup slots today — try tomorrow.</li>
          ) : (
            slots.map((s) => {
              const selected = current?.id === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`vitrina-sched__slot ${selected ? 'is-selected' : ''}`}
                    onClick={() => onChoose(s)}
                  >
                    <span className="vitrina-sched__slot-time">
                      <strong>{s.label.split(',')[1]?.trim() || s.label}</strong>
                      <span>
                        {s.tag === 'noon' ? 'Lunchtime pickup' : 'Evening pickup'}
                      </span>
                    </span>
                    <span className="vitrina-sched__slot-fee">
                      €{s.feeEur.toFixed(2)}
                      {selected ? <Check size={16} strokeWidth={2.6} /> : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <style>{`
        .vitrina-sched {
          position: fixed;
          inset: 0;
          z-index: 130;
          display: grid;
          place-items: center;
          padding: 18px;
          background: color-mix(in srgb, #1a1a1a 35%, transparent);
          backdrop-filter: blur(2px);
          animation: vitrina-sched-in 140ms ease-out;
        }
        @keyframes vitrina-sched-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .vitrina-sched__card {
          width: 100%;
          max-width: 380px;
          max-height: calc(100% - 36px);
          overflow-y: auto;
          background: var(--color-card, #fff);
          color: var(--color-ink);
          border-radius: 6px;
          box-shadow: 0 24px 60px -12px color-mix(in srgb, #1a1a1a 35%, transparent);
          padding: 14px 16px 18px;
          display: grid;
          gap: 12px;
          animation: vitrina-sched-card 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @keyframes vitrina-sched-card {
          from { transform: translateY(8px) scale(0.98); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .vitrina-sched__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .vitrina-sched__head h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.05rem;
          font-weight: 600;
          letter-spacing: -0.015em;
          color: var(--color-ink);
        }
        .vitrina-sched__close {
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
        .vitrina-sched__close:hover {
          background: color-mix(in srgb, var(--color-ink) 10%, transparent);
        }
        .vitrina-sched__now {
          display: grid;
          grid-template-columns: 32px 1fr auto;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 14px;
          border: 1px solid color-mix(in srgb, var(--color-dijon-dark, #b07a00) 30%, transparent);
          border-radius: 6px;
          background: color-mix(in srgb, var(--color-dijon-dark, #b07a00) 6%, var(--color-card));
          color: var(--color-ink);
          cursor: pointer;
          font: inherit;
          text-align: left;
          transition: background 120ms ease, border-color 120ms ease;
        }
        .vitrina-sched__now:hover {
          background: color-mix(in srgb, var(--color-dijon-dark, #b07a00) 10%, var(--color-card));
        }
        .vitrina-sched__now.is-selected {
          border-color: var(--color-dijon-dark, #b07a00);
          box-shadow: 0 0 0 1px var(--color-dijon-dark, #b07a00) inset;
        }
        .vitrina-sched__now.is-disabled {
          opacity: 0.55;
          cursor: not-allowed;
          background: color-mix(in srgb, var(--color-ink) 4%, var(--color-card));
          border-color: color-mix(in srgb, var(--color-ink) 12%, transparent);
        }
        .vitrina-sched__now.is-disabled:hover {
          background: color-mix(in srgb, var(--color-ink) 4%, var(--color-card));
        }
        .vitrina-sched__now.is-disabled .vitrina-sched__now-icon {
          background: color-mix(in srgb, var(--color-ink) 30%, transparent);
        }
        .vitrina-sched__now.is-disabled .vitrina-sched__now-text span {
          color: var(--color-ink);
        }
        .vitrina-sched__now-icon {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background: var(--color-dijon-dark, #b07a00);
          color: #fff;
        }
        .vitrina-sched__now-text {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .vitrina-sched__now-text strong {
          font-family: var(--font-display);
          font-size: 0.95rem;
          font-weight: 600;
        }
        .vitrina-sched__now-text span {
          font-size: 0.78rem;
          color: var(--color-ink-light);
        }
        .vitrina-sched__now-fee {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-variant-numeric: tabular-nums;
          font-size: 0.92rem;
          font-weight: 600;
        }
        .vitrina-sched__or {
          position: relative;
          margin: 4px 0 -2px;
          text-align: center;
        }
        .vitrina-sched__or::before,
        .vitrina-sched__or::after {
          content: '';
          position: absolute;
          top: 50%;
          width: calc(50% - 56px);
          height: 1px;
          background: color-mix(in srgb, var(--color-ink) 10%, transparent);
        }
        .vitrina-sched__or::before { left: 0; }
        .vitrina-sched__or::after { right: 0; }
        .vitrina-sched__or span {
          display: inline-block;
          padding: 0 8px;
          font-size: 0.74rem;
          font-weight: 500;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-ink-light);
        }
        .vitrina-sched__days {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 2px 0;
          margin: 0 -4px;
          padding-left: 4px;
          padding-right: 4px;
          scroll-snap-type: x proximity;
        }
        .vitrina-sched__days::-webkit-scrollbar { display: none; }
        .vitrina-sched__day {
          display: grid;
          gap: 1px;
          place-items: center;
          flex: 0 0 64px;
          padding: 8px 10px;
          border: 1px solid color-mix(in srgb, var(--color-ink) 10%, transparent);
          border-radius: 6px;
          background: var(--color-card);
          color: var(--color-ink);
          cursor: pointer;
          font: inherit;
          scroll-snap-align: start;
          transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
        }
        .vitrina-sched__day strong {
          font-family: var(--font-display);
          font-size: 0.84rem;
          font-weight: 600;
        }
        .vitrina-sched__day span {
          font-size: 0.72rem;
          color: var(--color-ink-light);
        }
        .vitrina-sched__day:hover {
          background: color-mix(in srgb, var(--color-ink) 4%, transparent);
        }
        .vitrina-sched__day.is-active {
          background: var(--color-ink);
          border-color: var(--color-ink);
          color: #fff;
        }
        .vitrina-sched__day.is-active span {
          color: color-mix(in srgb, #fff 75%, transparent);
        }
        .vitrina-sched__slots {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        .vitrina-sched__slot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          padding: 12px 14px;
          border: 1px solid color-mix(in srgb, var(--color-ink) 10%, transparent);
          border-radius: 6px;
          background: var(--color-card);
          color: var(--color-ink);
          cursor: pointer;
          font: inherit;
          text-align: left;
          transition: background 120ms ease, border-color 120ms ease;
        }
        .vitrina-sched__slot:hover {
          background: color-mix(in srgb, var(--color-ink) 3%, transparent);
        }
        .vitrina-sched__slot.is-selected {
          border-color: var(--color-ink);
          box-shadow: 0 0 0 1px var(--color-ink) inset;
        }
        .vitrina-sched__slot-time {
          display: grid;
          gap: 1px;
          min-width: 0;
        }
        .vitrina-sched__slot-time strong {
          font-family: var(--font-display);
          font-size: 0.95rem;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
        .vitrina-sched__slot-time span {
          font-size: 0.78rem;
          color: var(--color-ink-light);
        }
        .vitrina-sched__slot-fee {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-variant-numeric: tabular-nums;
          font-size: 0.9rem;
          font-weight: 600;
        }
        .vitrina-sched__empty {
          padding: 18px 8px;
          text-align: center;
          color: var(--color-ink-light);
          font-size: 0.88rem;
        }
      `}</style>
    </div>
  );
}
