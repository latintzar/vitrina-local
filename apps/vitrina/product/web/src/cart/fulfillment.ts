/**
 * Pickup-slot model for the basket.
 *
 * Vitrina's MVP fulfillment is click-and-collect from indie shops who
 * are usually short on staff. Two windows per day:
 *   - Noon window  12:00–14:00
 *   - Evening      17:00–19:00
 *
 * Earliest-slot rule (give the shop time to assemble the basket and
 * still serve walk-ins):
 *   - If it's BEFORE noon when you order → earliest standard window
 *     is TODAY's evening slot.
 *   - If it's NOON or LATER when you order → earliest standard
 *     window is TOMORROW's noon slot. Today's evening is no longer
 *     enough lead time.
 *
 * Default selection is the earliest standard window — NOT "Now".
 * "Now" exists as an explicit choice with an extra fee that goes to
 * the shop (compensation for jumping the queue while serving in-shop
 * customers).
 *
 * Slot persistence lives in localStorage so the choice survives a
 * page refresh and is available to the checkout summary.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { validateCartShopsOpen, type CartShopOpenStatus } from '../api/mcp';

export type SlotKind = 'standard' | 'priority';
export type SlotTag = 'noon' | 'evening';

export interface Slot {
  id: string;
  kind: SlotKind;
  /** Which named window inside the day (only set for standard slots). */
  tag?: SlotTag;
  /** ISO date for the start of the window. */
  startIso: string;
  /** ISO date for the end of the window. */
  endIso: string;
  /** Display label, e.g. "Today, 12:00–14:00" or "Now (priority)". */
  label: string;
  /** Service fee for this slot in EUR. */
  feeEur: number;
}

const STORAGE_KEY = 'vitrina:slot';
/** Standard collection — shown as its own price, not “+ on top of”. */
const STANDARD_FEE_EUR = 0.99;
/** Priority (NOW) — standalone fee that goes to the shop. */
const PRIORITY_FEE_EUR = 2.99;

const SLOT_DEFS: Array<{ tag: SlotTag; startHour: number; endHour: number }> = [
  { tag: 'noon', startHour: 12, endHour: 14 },
  { tag: 'evening', startHour: 17, endHour: 19 },
];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmtTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function fmtDay(date: Date, today: Date): string {
  const startToday = startOfDay(today);
  const target = startOfDay(date);
  const diffDays = Math.round((target.getTime() - startToday.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'short' });
}

export function fmtDayShort(date: Date): string {
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/**
 * Build a single standard Slot for `tag` on the given calendar day.
 * Returns null if the day's slot already starts in the past.
 */
function buildSlotFor(day: Date, tag: SlotTag, now: Date): Slot | null {
  const def = SLOT_DEFS.find((d) => d.tag === tag);
  if (!def) return null;
  const start = startOfDay(day);
  start.setHours(def.startHour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(def.endHour, 0, 0, 0);
  if (start.getTime() < now.getTime()) return null;
  return {
    id: `${start.toISOString()}_${tag}`,
    kind: 'standard',
    tag,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: `${fmtDay(start, now)}, ${fmtTime(start)}–${fmtTime(end)}`,
    feeEur: STANDARD_FEE_EUR,
  };
}

/** All upcoming standard slots for a single calendar day. */
export function slotsForDay(day: Date, now = new Date()): Slot[] {
  const out: Slot[] = [];
  for (const def of SLOT_DEFS) {
    const slot = buildSlotFor(day, def.tag, now);
    if (slot) out.push(slot);
  }
  return out;
}

/**
 * Pickable days: the next N days that still have at least one
 * future-bookable standard slot. Today is included only if it's
 * still before noon (so today's evening window is reachable).
 */
export function pickableDays(daysAhead = 7, now = new Date()): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < daysAhead + 1; i += 1) {
    const day = addDays(now, i);
    if (slotsForDay(day, now).length > 0) days.push(day);
    if (days.length >= daysAhead) break;
  }
  return days;
}

/**
 * Earliest standard slot the user is allowed to pick under the
 * "shops need lead time" rule:
 *   - Before noon → today evening (5–7pm)
 *   - After noon → tomorrow noon (12–2pm)
 */
export function earliestStandardSlot(now = new Date()): Slot {
  if (now.getHours() < 12) {
    const today = buildSlotFor(now, 'evening', now);
    if (today) return today;
  }
  const tomorrowNoon = buildSlotFor(addDays(now, 1), 'noon', now);
  if (tomorrowNoon) return tomorrowNoon;
  // Shouldn't happen, but fall back to tomorrow evening.
  return (
    buildSlotFor(addDays(now, 1), 'evening', now) ??
    buildSlotFor(addDays(now, 2), 'noon', now)!
  );
}

/** Build the NOW priority slot (canonical priority fee). */
export function priorityNow(now = new Date()): Slot {
  const start = new Date(now);
  const end = new Date(now.getTime() + 60 * 60 * 1000);
  return {
    id: 'now',
    kind: 'priority',
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: 'Now (priority)',
    feeEur: PRIORITY_FEE_EUR,
  };
}

function loadSlot(): Slot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Slot;
    if (parsed && typeof parsed === 'object' && parsed.id && parsed.startIso && parsed.endIso) {
      // Refresh fee if we ever change prices — old localStorage may have
      // stale `feeEur`; slot *kind* is the source of truth.
      if (parsed.kind === 'priority') {
        parsed.feeEur = PRIORITY_FEE_EUR;
      } else {
        parsed.feeEur = STANDARD_FEE_EUR;
      }
      return parsed;
    }
  } catch {}
  return null;
}

function saveSlot(slot: Slot | null) {
  try {
    if (slot) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slot));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Basket slot state.
 *
 * `slot` is always non-null — if the user hasn't explicitly picked
 * one yet (or the persisted choice has expired), we fall back to
 * `earliestStandardSlot()`. That way the basket totals always have a
 * concrete fee to display and the checkout button is never gated on
 * "pick a slot first". `picked` distinguishes user choice from
 * default so callers can tweak copy ("Earliest pickup" vs "Tomorrow
 * 12–2pm") if they want to.
 */
export function useSlot() {
  const [picked, setPicked] = useState<Slot | null>(() => loadSlot());
  const [, setNowTick] = useState(0);

  // Re-evaluate the default every minute so the "earliest" slot
  // rolls forward as time passes (e.g. clock crosses noon → default
  // jumps from "today evening" to "tomorrow noon").
  useEffect(() => {
    const i = window.setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => window.clearInterval(i);
  }, []);

  // Drop the persisted slot when its window has passed.
  useEffect(() => {
    if (!picked) return;
    const end = Date.parse(picked.endIso);
    if (Number.isFinite(end) && end < Date.now()) {
      setPicked(null);
      saveSlot(null);
    }
  }, [picked]);

  const slot = useMemo(() => picked ?? earliestStandardSlot(), [picked]);

  const setSlot = useCallback((next: Slot | null) => {
    saveSlot(next);
    setPicked(next);
  }, []);

  const clear = useCallback(() => {
    saveSlot(null);
    setPicked(null);
  }, []);

  return { slot, picked, setSlot, clear };
}

export const SERVICE_FEE_STANDARD_EUR = STANDARD_FEE_EUR;
export const SERVICE_FEE_PRIORITY_EUR = PRIORITY_FEE_EUR;

/**
 * Hook: fetch closed-shop status for the basket's carts so the
 * SchedulePickerModal can disable the "Now (priority)" option when any
 * shop is currently shut. Standard / scheduled slots are not gated by
 * this — `create_multishop_group` only enforces "open during the booked
 * window" for those, see `backend/mcp/checkout.py`.
 *
 * Returns:
 *   - `closedShops`: list of `{shop_id, next_open_at?}` entries for
 *     carts whose shop is closed right now (empty when all open).
 *   - `loading`: true on initial fetch.
 *   - `refresh`: re-poll (e.g. after the user adds/removes a shop).
 */
export function useCartShopsOpenStatus(cartIds: string[]) {
  const [statuses, setStatuses] = useState<CartShopOpenStatus[] | null>(null);
  const [loading, setLoading] = useState(false);

  const stableKey = useMemo(() => cartIds.slice().sort().join('|'), [cartIds]);

  const fetchOnce = useCallback(async () => {
    if (cartIds.length === 0) {
      setStatuses([]);
      return;
    }
    setLoading(true);
    try {
      const res = await validateCartShopsOpen(cartIds);
      setStatuses(res);
    } catch {
      // If the endpoint fails, fall safely open: don't gate "Now"
      // and let the backend pre-flight be the final guardrail.
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  }, [cartIds]);

  useEffect(() => {
    void fetchOnce();
  }, [stableKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const closedShops = useMemo(
    () => (statuses ?? []).filter((s) => !s.open),
    [statuses],
  );

  return { closedShops, loading, refresh: fetchOnce };
}
