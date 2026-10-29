/**
 * Thin client for the Vitrina MCP REST mirror.
 *
 * The MCP server lives at `apps/vitrina/product/backend/api/` and
 * exposes REST-shaped stock paths (at `/v1/shops`, `/v1/search`) and the
 * ACP checkout paths (at `/checkout_sessions*`). The chat agent uses the
 * full MCP tool surface via `backend/agent/`.
 */

import type { Shop, StockLine, CheckoutSession, CheckoutSessionItem } from './types';

const ACP_API_VERSION = '2026-04-17';

function baseUrl(): string {
  const env = (import.meta as any).env ?? {};
  return env.VITE_VITRINA_API_URL || '/api';
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'API-Version': ACP_API_VERSION,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

function normalizeShop(raw: any): Shop {
  return {
    id: raw.id,
    name: raw.name || raw.name_en || raw.name_bg || raw.id,
    city: raw.city || 'Sofia',
    address: raw.address || raw.address_en || raw.address_bg,
    lat: Number(raw.lat ?? 42.6977),
    lon: Number(raw.lon ?? raw.lng ?? 23.3219),
    hours: raw.hours || raw.hours_today,
    cover_url: raw.cover_url || raw.hero_image,
    rating: raw.rating,
  };
}

function normalizeStockLine(raw: any, fallbackShopId?: string): StockLine {
  const product = raw.product || raw;
  const shopId = product.shop_id || raw.shop_id || fallbackShopId || '';
  return {
    shop_id: shopId,
    stock: Number(raw.stock ?? product.stock ?? product.effective_stock ?? raw.effective_stock ?? 0),
    product: {
      id: product.id || raw.product_id,
      shop_id: shopId,
      name: product.name || product.name_en || product.name_bg || raw.name_en || raw.name_bg || raw.product_id,
      description: product.description || product.description_en || product.description_bg,
      price_eur: Number(product.price_eur ?? raw.price_eur ?? 0),
      category: product.category || raw.category,
      image_url: product.image_url || product.image || raw.image_url || raw.image,
      unit: product.unit || product.unit_size,
    },
  };
}

// Shops / stock ---------------------------------------------------------

export async function listShops(): Promise<{ shops: Shop[] }> {
  const data = await req<{ shops: any[] }>('/v1/shops');
  return { shops: (data.shops || []).map(normalizeShop) };
}

export async function getShopInventory(shop_id: string): Promise<{ items: StockLine[] }> {
  const data = await req<{ products?: any[]; items?: any[] }>(`/v1/shops/${encodeURIComponent(shop_id)}/products`);
  return { items: (data.items || data.products || []).map((item) => normalizeStockLine(item, shop_id)) };
}

export async function searchAcrossShops(query: string): Promise<{ items: StockLine[] }> {
  const data = await req<{ items?: any[]; matches?: any[] }>(`/v1/search?query=${encodeURIComponent(query)}`);
  return { items: (data.items || data.matches || []).map((item) => normalizeStockLine(item)) };
}

// ACP checkout ----------------------------------------------------------

/** Same-origin URL the user should land on if they cancel/back from
 *  Stripe — production, custom domain, or preview deploy. The backend
 *  validates against an allowlist before using it. */
function returnOrigin(): string | undefined {
  if (typeof window === 'undefined' || !window.location) return undefined;
  return window.location.origin;
}

export async function createCheckoutSession(
  shop_id: string,
  items: CheckoutSessionItem[],
  buyer?: { email?: string; name?: string },
): Promise<CheckoutSession & { client_secret?: string }> {
  return req<CheckoutSession & { client_secret?: string }>('/checkout_sessions', {
    method: 'POST',
    body: JSON.stringify({
      meta: { api_version: ACP_API_VERSION },
      payload: { shop_id, items, buyer, return_origin: returnOrigin() },
    }),
  });
}

export async function createCheckoutFromCarts(
  cart_ids: string[],
  buyer?: { email?: string; name?: string },
  slot?: { kind: 'priority' | 'standard'; start: string; end: string; label?: string } | null,
): Promise<CheckoutSession & { group_id?: string; sessions?: CheckoutSession[]; stripe_checkout_url?: string; client_secret?: string }> {
  return req<CheckoutSession & { group_id?: string; sessions?: CheckoutSession[]; stripe_checkout_url?: string; client_secret?: string }>('/checkout_sessions', {
    method: 'POST',
    body: JSON.stringify({
      meta: { api_version: ACP_API_VERSION },
      cart_ids,
      buyer,
      // Backend gates the closed-shop pre-flight on slot.kind:
      // priority => "open now"; standard => "open during window".
      // See backend/mcp/checkout.py::create_multishop_group.
      slot: slot ?? undefined,
      // So Stripe's cancel_url returns the user to the same host they
      // started on (e.g. vitrina.app, vitrina.bg, or a Vercel preview).
      return_origin: returnOrigin(),
    }),
  });
}

export async function getCheckoutSession(id: string): Promise<CheckoutSession> {
  return req<CheckoutSession>(`/checkout_sessions/${encodeURIComponent(id)}`);
}

export async function updateCheckoutSession(
  id: string,
  payload: Partial<Pick<CheckoutSession, 'items' | 'buyer'>>,
): Promise<CheckoutSession> {
  return req<CheckoutSession>(`/checkout_sessions/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify({ meta: { api_version: ACP_API_VERSION }, payload }),
  });
}

export async function completeCheckoutSession(id: string): Promise<CheckoutSession> {
  return req<CheckoutSession>(`/checkout_sessions/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    body: JSON.stringify({ meta: { api_version: ACP_API_VERSION } }),
  });
}

export async function cancelCheckoutSession(id: string): Promise<CheckoutSession> {
  return req<CheckoutSession>(`/checkout_sessions/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ meta: { api_version: ACP_API_VERSION } }),
  });
}

// Shop-hours validation -------------------------------------------------

export interface CartShopOpenStatus {
  cart_id: string;
  shop_id: string | null;
  open: boolean;
  next_open_at?: string | null;
}

/** Batch-check whether each cart's shop is open right now. Backed by
 * `/v1/replan/validate-shops-open` which calls
 * `shop_hours.validate_cart_shops_open` server-side. */
export async function validateCartShopsOpen(
  cart_ids: string[],
): Promise<CartShopOpenStatus[]> {
  if (!cart_ids.length) return [];
  return req<CartShopOpenStatus[]>('/v1/replan/validate-shops-open', {
    method: 'POST',
    body: JSON.stringify({ cart_ids }),
  });
}
