/**
 * Vitrina basket — thin UCP client over the backend cart endpoints.
 *
 * Anonymous shoppers get a stable cart_key in localStorage. Each shop has
 * its own open UCP cart, so the UI can pay all shops together later while
 * still showing shop/recipe grouping locally.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Product } from '../api/types';
import { getCachedAccessToken, getSupabase, waitForSessionPrime } from '../auth/supabaseClient';
import { getAnonCartKey } from '../chat/threadsApi';

export interface CartLine {
  id: string;
  cart_id: string;
  product: Product;
  quantity: number;
  group_id?: string | null;
  group_metadata?: Record<string, unknown> | null;
}

export interface CartState {
  carts: ServerCart[];
  lines: CartLine[];
}

export interface ServerCart {
  id: string;
  shop_id: string;
  currency?: string;
  status?: string;
  line_items?: ServerLine[];
  totals?: {
    subtotal_minor?: number;
    total_minor?: number;
    item_count?: number;
  };
}

interface ServerLine {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  product_snapshot?: Record<string, unknown>;
  group_id?: string | null;
  group_metadata?: Record<string, unknown> | null;
  total_minor?: number;
}

const STORAGE_KEY = 'vitrina:cart_ids';

function apiBase() {
  return import.meta.env.VITE_VITRINA_API_URL || '/api';
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'X-Vitrina-Cart-Key': getAnonCartKey(),
  };
  if (getSupabase()) {
    // Wait for the FIRST session to land, then read from cache for
    // every call after that. Avoids the gotrue-js lock contention that
    // serialised parallel cart writes into 5-second timeouts.
    await waitForSessionPrime();
    const token = getCachedAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      ...(await authHeaders()),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return (await res.json()) as T;
}

function loadCartIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as string[];
    return Array.isArray(data) ? data.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function getActiveCartIds(): string[] {
  return loadCartIds().filter((id) => !id.startsWith(OPT_CART_PREFIX));
}

function saveCartIds(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {}
}

function productFromSnapshot(line: ServerLine): Product {
  const snap = line.product_snapshot || {};
  const priceMinor = Number(snap.price_minor ?? line.total_minor ?? 0);
  const quantity = Math.max(1, Number(line.quantity || 1));
  return {
    id: String(snap.id ?? line.product_id),
    shop_id: String(snap.shop_id ?? ''),
    name: String(snap.name ?? line.product_id),
    description: typeof snap.description === 'string' ? snap.description : undefined,
    price_eur: Number(snap.price_eur ?? priceMinor / quantity / 100),
    category: typeof snap.category === 'string' ? snap.category : undefined,
    image_url: typeof snap.image_url === 'string' ? snap.image_url : undefined,
    unit: typeof snap.unit === 'string' ? snap.unit : undefined,
    unit_size: typeof snap.unit_size === 'string' ? snap.unit_size : undefined,
  };
}

function flatten(carts: ServerCart[]): CartLine[] {
  return carts.flatMap((cart) =>
    (cart.line_items || []).map((line) => ({
      id: line.id,
      cart_id: cart.id,
      product: { ...productFromSnapshot(line), shop_id: cart.shop_id },
      quantity: Number(line.quantity || 0),
      group_id: line.group_id,
      group_metadata: line.group_metadata,
    })),
  );
}

let _state: CartState = { carts: [], lines: [] };
let _lastItemCount = 0;
let _lastPulseAt = 0;
const _subs = new Set<() => void>();
const _pulseSubs = new Set<() => void>();

// Burst mode: while the recipe → basket flight animation plays we
// don't want the badge to climb 1, 2, 3, … 7 as parallel POSTs land —
// the user has already SEEN the visual outcome. We coalesce all
// `emit()` calls during the burst into a single emit + pulse on
// `endBurst()`, so the basket appears to gain N items at once at the
// end of the animation.
//
// While burst is active we ALSO suppress `refreshCartIds()`. Otherwise
// a sibling `useCart()` mounting mid-burst (e.g. ChatPage taking over
// from RecipeModal) re-fetches the carts at the same moment line
// POSTs are landing and clobbers _state with a stale snapshot —
// that's the "basket went 12 → 5" bug Peter saw.
let _burstDepth = 0;
let _burstDirty = false;
let _optimisticBump = 0;

export function startBurst(): void {
  _burstDepth += 1;
}
export function endBurst(): void {
  _burstDepth = Math.max(0, _burstDepth - 1);
  if (_burstDepth === 0) {
    _optimisticBump = 0;
    if (_burstDirty) {
      _burstDirty = false;
      emitNow();
    }
  }
}

/**
 * Synchronously bumps the displayed badge BEFORE any server round-trip.
 * Used by recipe-add to make the basket counter feel instant. The bump
 * is cleared on `endBurst()` because by then the real `_state.lines`
 * already reflects all newly-added items.
 */
export function bumpOptimistic(n: number): void {
  _optimisticBump = Math.max(0, _optimisticBump + n);
  emitNow();
}

function emitNow() {
  _subs.forEach((fn) => fn());
  const count = _state.lines.reduce((n, l) => n + l.quantity, 0);
  if (count > _lastItemCount) {
    _lastPulseAt = Date.now();
    _pulseSubs.forEach((fn) => fn());
  }
  _lastItemCount = count;
}

function emit() {
  if (_burstDepth > 0) {
    _burstDirty = true;
    return;
  }
  emitNow();
}

export function getCart(): CartState {
  return _state;
}

async function refreshCartIds(ids = loadCartIds()): Promise<void> {
  // Don't fetch a stale snapshot mid-burst — it'd clobber the lines
  // currently being POSTed. The endBurst() final emit will reflect
  // server truth once all writes have landed.
  if (_burstDepth > 0) return;
  const carts: ServerCart[] = [];
  for (const id of ids) {
    try {
      const cart = await req<ServerCart>(`/carts/${encodeURIComponent(id)}`);
      if (cart.status !== 'discarded') carts.push(cart);
    } catch {
      // Drop stale local ids.
    }
  }
  // A burst could have started while we were awaiting these GETs.
  // Same reason: don't overwrite _state if writes are in flight.
  if (_burstDepth > 0) return;
  const keptIds = carts.map((cart) => cart.id);
  saveCartIds(keptIds);
  _state = { carts, lines: flatten(carts) };
  emit();
}

// Coalesce concurrent cart-create requests per shop. Without this,
// firing N parallel addToCart calls for the same shop creates N empty
// carts (each call sees `find` return undefined before the others
// finish POSTing /carts). The first call owns the create promise; the
// rest await the same one.
const _shopCartCreate = new Map<string, Promise<ServerCart>>();

// Optimistic-line bookkeeping: when the user taps + on a Browse card we
// immediately splice a fake line into _state so the badge counter goes
// up and the card flips from + to a stepper without waiting on the
// server. Once the server response lands we replace this fake line
// with the real one (matched by cart shop_id + product id). The fake
// id is recognisable so subsequent stepper clicks before the server
// responds can patch the SAME optimistic line in-place rather than
// PATCHing a non-existent server line.
const OPT_LINE_PREFIX = '__opt__:';
const OPT_CART_PREFIX = '__opt-cart__:';

function optimisticAdd(
  product: Product,
  quantity: number,
  opts?: { group_id?: string; group_metadata?: Record<string, unknown> },
): void {
  let cart = _state.carts.find((c) => c.shop_id === product.shop_id);
  if (!cart) {
    cart = {
      id: `${OPT_CART_PREFIX}${product.shop_id}`,
      shop_id: product.shop_id,
      currency: 'EUR',
      line_items: [],
    };
    _state = { carts: [..._state.carts, cart], lines: _state.lines };
  }
  const cartId = cart.id;
  const existing = _state.lines.find(
    (l) => l.cart_id === cartId && l.product.id === product.id,
  );
  if (existing) {
    _state = {
      carts: _state.carts,
      lines: _state.lines.map((l) =>
        l === existing ? { ...l, quantity: l.quantity + quantity } : l,
      ),
    };
  } else {
    const line: CartLine = {
      id: `${OPT_LINE_PREFIX}${product.id}`,
      cart_id: cartId,
      product,
      quantity,
      group_id: opts?.group_id ?? null,
      group_metadata: opts?.group_metadata ?? null,
    };
    _state = { carts: _state.carts, lines: [..._state.lines, line] };
  }
  emit();
}

function reconcileServerCart(next: ServerCart, prevCartId: string): void {
  // Drop both the old (real-or-optimistic) cart and any duplicate of
  // the new id. Then append the server-fresh cart and re-flatten lines
  // from the canonical server line_items list — this auto-replaces
  // any `__opt__:` lines we spliced in earlier.
  const carts = _state.carts
    .filter((c) => c.id !== prevCartId && c.id !== next.id)
    .concat(next);
  saveCartIds(carts.filter((c) => !c.id.startsWith(OPT_CART_PREFIX)).map((c) => c.id));
  _state = { carts, lines: flatten(carts) };
  emit();
}

export async function addToCart(
  product: Product,
  quantity = 1,
  opts?: { group_id?: string; group_metadata?: Record<string, unknown> },
): Promise<void> {
  // 1. Splice optimistic line/quantity so the UI reflects the add
  //    instantly (badge bumps, + flips to stepper, recipe basket pulses).
  optimisticAdd(product, quantity, opts);

  // 2. Make sure we have a real (non-optimistic) cart for this shop.
  let cart = _state.carts.find(
    (c) => c.shop_id === product.shop_id && !c.id.startsWith(OPT_CART_PREFIX),
  );
  if (!cart) {
    let pending = _shopCartCreate.get(product.shop_id);
    if (!pending) {
      pending = req<ServerCart>('/carts', {
        method: 'POST',
        body: JSON.stringify({ shop_id: product.shop_id, currency: 'EUR' }),
      }).then((created) => {
        saveCartIds([...loadCartIds(), created.id]);
        // Swap the optimistic placeholder cart's id over to the real
        // one so any optimistic lines we spliced in remain attached
        // to the correct cart while we POST the line.
        _state = {
          carts: _state.carts
            .filter((c) => c.id !== `${OPT_CART_PREFIX}${product.shop_id}` && c.id !== created.id)
            .concat({ ...created, line_items: created.line_items ?? [] }),
          lines: _state.lines.map((l) =>
            l.cart_id === `${OPT_CART_PREFIX}${product.shop_id}`
              ? { ...l, cart_id: created.id }
              : l,
          ),
        };
        return created;
      }).finally(() => {
        _shopCartCreate.delete(product.shop_id);
      });
      _shopCartCreate.set(product.shop_id, pending);
    }
    cart = await pending;
  }

  // 3. POST the line; reconcile with the canonical cart on response.
  const prevCartId = cart.id;
  const next = await req<ServerCart>(`/carts/${encodeURIComponent(cart.id)}/items`, {
    method: 'POST',
    body: JSON.stringify({
      product_id: product.id,
      quantity,
      group_id: opts?.group_id,
      group_metadata: opts?.group_metadata,
    }),
  });
  reconcileServerCart(next, prevCartId);
}

export async function setQuantity(product_id: string, quantity: number): Promise<void> {
  const line = _state.lines.find((l) => l.product.id === product_id);
  if (!line) return;

  // Optimistic: update local quantity instantly so the stepper number
  // moves on tap. We then PATCH the server (or POST, if the line is
  // still optimistic and has no real id yet) and reconcile on response.
  if (quantity <= 0) {
    _state = {
      carts: _state.carts,
      lines: _state.lines.filter((l) => l !== line),
    };
  } else {
    _state = {
      carts: _state.carts,
      lines: _state.lines.map((l) => (l === line ? { ...l, quantity } : l)),
    };
  }
  emit();

  // If the line is still optimistic (no server id yet), the line POST
  // is in flight. Bail — when that POST resolves it will reconcile to
  // the latest server cart. Following stepper taps that happen after
  // reconciliation will hit the PATCH branch with a real line.id.
  if (line.id.startsWith(OPT_LINE_PREFIX)) return;
  if (line.cart_id.startsWith(OPT_CART_PREFIX)) return;

  const next = await req<ServerCart>(
    `/carts/${encodeURIComponent(line.cart_id)}/items/${encodeURIComponent(line.id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    },
  );
  const carts = quantity <= 0 && (next.line_items || []).length === 0
    ? _state.carts.filter((c) => c.id !== next.id)
    : _state.carts.filter((c) => c.id !== next.id).concat(next);
  saveCartIds(carts.filter((c) => !c.id.startsWith(OPT_CART_PREFIX)).map((c) => c.id));
  _state = { carts, lines: flatten(carts) };
  emit();
}

export async function removeFromCart(product_id: string): Promise<void> {
  await setQuantity(product_id, 0);
}

export async function clearCart(): Promise<void> {
  const ids = loadCartIds();
  try {
    await req('/carts/current', { method: 'DELETE' });
  } catch {
    // Backwards-compatible fallback for local dev servers that have not
    // picked up the owner-wide clear endpoint yet.
    await Promise.allSettled(ids.map((id) => req(`/carts/${encodeURIComponent(id)}`, { method: 'DELETE' })));
  }
  saveCartIds([]);
  _state = { carts: [], lines: [] };
  emit();
}

export function useCart() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    _subs.add(fn);
    void refreshCartIds();
    return () => {
      _subs.delete(fn);
    };
  }, []);

  const state = _state;
  const totalItems = useMemo(
    () => state.lines.reduce((n, l) => n + l.quantity, 0) + _optimisticBump,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, _optimisticBump],
  );
  const totalEur = useMemo(
    () => state.lines.reduce((n, l) => n + l.quantity * l.product.price_eur, 0),
    [state],
  );

  const add = useCallback(
    (p: Product, q = 1, opts?: { group_id?: string; group_metadata?: Record<string, unknown> }) =>
      void addToCart(p, q, opts),
    [],
  );

  return {
    shop_id: state.carts[0]?.shop_id ?? null,
    carts: state.carts,
    cartIds: state.carts.map((cart) => cart.id),
    lines: state.lines,
    totalItems,
    totalEur,
    add,
    setQuantity: (productId: string, quantity: number) => void setQuantity(productId, quantity),
    remove: (productId: string) => void removeFromCart(productId),
    clear: () => clearCart(),
    refresh: () => void refreshCartIds(),
  };
}

export function usePulse(): number {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    _pulseSubs.add(fn);
    return () => {
      _pulseSubs.delete(fn);
    };
  }, []);
  return _lastPulseAt;
}

export async function migrateToSupabase(_userId: string): Promise<void> {
  const ids = loadCartIds();
  if (!ids.length) return;
  await req('/carts/transfer', {
    method: 'POST',
    body: JSON.stringify({ cart_keys: [getAnonCartKey()] }),
  });
  await refreshCartIds(ids);
}
