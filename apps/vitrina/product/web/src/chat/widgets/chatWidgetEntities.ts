import type { Product, Shop, StockLine } from '../../api/types';

/** Normalize MCP / agent shop JSON into the web `Shop` shape. */
export function shopFromWidgetPayload(raw: Record<string, unknown>): Shop | null {
  const id = String(raw.id ?? '');
  if (!id) return null;
  const name =
    (typeof raw.name === 'string' && raw.name.trim() && raw.name) ||
    (typeof raw.name_en === 'string' && raw.name_en.trim() && raw.name_en) ||
    (typeof raw.name_bg === 'string' && raw.name_bg.trim() && raw.name_bg) ||
    'Shop';
  const lat = Number(raw.lat);
  const lon = Number(raw.lng ?? raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const address =
    (typeof raw.address_en === 'string' && raw.address_en) ||
    (typeof raw.address_bg === 'string' && raw.address_bg) ||
    (typeof raw.address === 'string' && raw.address) ||
    undefined;
  const city =
    (typeof raw.city === 'string' && raw.city) ||
    (address ? (address.split(',').pop()?.trim() ?? '') : '') ||
    '';
  const cover_url =
    (typeof raw.hero_image === 'string' && raw.hero_image) ||
    (typeof raw.cover_url === 'string' && raw.cover_url) ||
    undefined;
  const hours =
    (typeof raw.hours_today === 'string' && raw.hours_today) ||
    (typeof raw.hours === 'string' && raw.hours) ||
    undefined;
  return {
    id,
    name,
    city,
    address,
    lat,
    lon,
    cover_url,
    hours,
    rating: typeof raw.rating === 'number' ? raw.rating : undefined,
  };
}

/** Normalize MCP / agent product JSON into the web `Product` shape. */
export function productFromWidgetPayload(raw: Record<string, unknown>, shopId: string): Product | null {
  const id = String(raw.id ?? '');
  if (!id) return null;
  const name =
    (typeof raw.name === 'string' && raw.name.trim() && raw.name) ||
    (typeof raw.name_en === 'string' && raw.name_en.trim() && raw.name_en) ||
    (typeof raw.name_bg === 'string' && raw.name_bg.trim() && raw.name_bg) ||
    'Product';
  const price = Number(raw.price_eur ?? 0);
  const image_url =
    (typeof raw.image_url === 'string' && raw.image_url) ||
    (typeof raw.image === 'string' && raw.image) ||
    undefined;
  return {
    id,
    shop_id: String(raw.shop_id ?? shopId),
    name,
    description:
      (typeof raw.description === 'string' && raw.description) ||
      (typeof raw.description_en === 'string' && raw.description_en) ||
      undefined,
    price_eur: Number.isFinite(price) ? price : 0,
    category: typeof raw.category === 'string' ? raw.category : undefined,
    image_url,
    unit: typeof raw.unit === 'string' ? raw.unit : undefined,
    unit_size: typeof raw.unit_size === 'string' ? raw.unit_size : undefined,
  };
}

export function stockLineFromWidgetPayload(
  shop: Shop,
  product: Product,
  stockRaw: unknown,
): StockLine {
  const stock = typeof stockRaw === 'number' && Number.isFinite(stockRaw) ? Math.max(0, stockRaw) : 99;
  return {
    shop_id: shop.id,
    product: { ...product, shop_id: shop.id },
    stock: stock > 0 ? stock : 0,
  };
}

export function directionsHrefForShop(shop: Shop, mapsUrl?: string | null): string {
  if (typeof mapsUrl === 'string' && mapsUrl.startsWith('http')) return mapsUrl;
  const q = encodeURIComponent(`${shop.name}, ${shop.address || shop.city || ''}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
