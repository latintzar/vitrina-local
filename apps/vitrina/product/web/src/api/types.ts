/**
 * Shared shapes for the Vitrina backend wire format.
 *
 * Mirrors the Python types in `apps/vitrina/product/backend/mcp/`
 * (see `data.py`, `snapshots.py`, `checkout.py`). Kept flat and hand-
 * written rather than codegen'd — the MCP surface is small enough
 * that drift is easy to catch by eye.
 */

export interface Shop {
  id: string;
  name: string;
  city: string;
  address?: string;
  lat: number;
  lon: number;
  hours?: string;
  cover_url?: string;
  rating?: number;
}

export interface Product {
  id: string;                 // SKU
  shop_id: string;
  name: string;
  description?: string;
  price_eur: number;          // source of truth; checkout converts to EUR minor
  category?: string;
  image_url?: string;
  unit?: string;              // "kg", "piece", "500g", etc.
  unit_size?: string;         // "500g", "4 pcs", "1L" — shopper-facing pack size
}

export interface StockLine {
  shop_id: string;
  product: Product;
  stock: number;              // live (seed + leo_delta)
}

export interface CheckoutSessionItem {
  id: string;                 // SKU
  quantity: number;
  unit_amount?: number;       // minor units (cents)
  display_name?: string;
}

export interface FulfillmentOption {
  type: 'pickup';
  shop_id: string;
  shop_address?: string;
  collection_code: string;
  status?: 'pending' | 'issued';
  ready_in_minutes?: number;
}

export interface CheckoutSession {
  id: string;                 // HMAC-signed stateless token
  status: 'in_progress' | 'completed' | 'canceled';
  shop_id: string;
  items: CheckoutSessionItem[];
  buyer?: { email?: string; name?: string };
  fulfillment_options: FulfillmentOption[];
  total?: { amount_minor: number; currency: string };
  payment_link?: { url?: string; client_secret?: string; stripe_session_id?: string; mode?: string; error?: string };
  messages?: { type: string; text: string }[];
  email_delivery?: { status: 'sent' | 'skipped' | 'failed'; to?: string; reason?: string };
}
