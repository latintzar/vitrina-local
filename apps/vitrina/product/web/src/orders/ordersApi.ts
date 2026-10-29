import { getCachedAccessToken, getSupabase, waitForSessionPrime } from '../auth/supabaseClient';
import { getAnonCartKey } from '../chat/threadsApi';

export interface OrderLine {
  id?: string;
  product_id?: string;
  display_name?: string;
  name?: string;
  quantity?: number;
  unit_price_minor?: number;
  subtotal_minor?: number;
  total_minor?: number;
  /** Frozen at order time — same shape as ``cart_line_items.product_snapshot``.
   *  Carries shop_id, image_url, unit, unit_size so the order page can
   *  render rows that look identical to the basket. */
  product_snapshot?: {
    shop_id?: string;
    image_url?: string;
    unit?: string;
    unit_size?: string;
    name?: string;
    name_en?: string;
    name_bg?: string;
  };
  group_id?: string | null;
  /** When the line came from a recipe-video, this is the same payload
   *  the basket carries so the order page can group + show "See recipe"
   *  the same way Cart.tsx does. */
  group_metadata?: Record<string, unknown> | null;
}

export interface Order {
  id: string;
  status?: string;
  fulfillment_status?: string;
  collect_key?: string;
  collect_code?: string;
  collected_at?: string | null;
  shop_id?: string;
  line_items?: OrderLine[];
  total_minor?: number;
  totals?: {
    total_minor?: number;
    subtotal_minor?: number;
  };
  currency?: string;
  created_at?: string;
  permalink_url?: string;
}

function apiBase() {
  return import.meta.env.VITE_VITRINA_API_URL || '/api';
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'X-Vitrina-Cart-Key': getAnonCartKey(),
  };
  if (getSupabase()) {
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

export async function listOrders(): Promise<Order[]> {
  try {
    const data = await req<{ orders: Order[] }>('/users/me/orders');
    return data.orders;
  } catch (err) {
    const message = String(err);
    if (message.includes('401') || message.includes('auth_required')) {
      return [];
    }
    throw err;
  }
}

export async function getOrder(orderId: string, collectKey?: string | null): Promise<Order> {
  const qs = collectKey ? `?collect_key=${encodeURIComponent(collectKey)}` : '';
  return req<Order>(`/orders/${encodeURIComponent(orderId)}${qs}`);
}

export async function collectOrder(orderId: string, collectKey?: string | null): Promise<Order> {
  const data = await req<{ order: Order }>(`/orders/${encodeURIComponent(orderId)}/collect`, {
    method: 'POST',
    body: JSON.stringify({ collect_key: collectKey }),
  });
  return data.order;
}

export function formatMinor(amount = 0, currency = 'EUR') {
  return `${(amount / 100).toFixed(2)} ${currency}`;
}

export function orderTotalMinor(order: Order): number {
  return Number(order.total_minor ?? order.totals?.total_minor ?? 0);
}
