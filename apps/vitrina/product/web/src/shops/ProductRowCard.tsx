/**
 * Horizontal product card (+ / stepper) — shared by ShopDetail rows and
 * chat `shop_product_card` so add-to-basket behaviour stays identical.
 */

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { StockLine } from '../api/types';
import type { useCart } from '../cart/useCart';

export interface ProductRowCardProps {
  item: StockLine;
  cart: ReturnType<typeof useCart>;
  /** When set, tapping the card body opens the detail sheet (ShopDetail). */
  onSelect?: (item: StockLine) => void;
}

/** Two-letter monogram (first letters of first two words) — fallback for
 *  products that have no image URL or whose image fails to load. Mirrors
 *  the IngredientRow monogram logic so the visual language stays
 *  consistent across recipe + browse surfaces. */
function productInitials(name: string): string {
  const cleaned = (name || '').trim();
  if (!cleaned) return '·';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function ProductRowCard({ item, cart, onSelect }: ProductRowCardProps) {
  const lineQty = cart.lines.find((l) => l.product.id === item.product.id)?.quantity ?? 0;
  const inStock = item.stock > 0;
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(item.product.image_url) && !imgFailed;
  return (
    <article
      role="listitem"
      className="vitrina-sd__card"
      onClick={onSelect ? () => onSelect(item) : undefined}
    >
      <div className="vitrina-sd__card-img">
        {showImage ? (
          <img
            src={item.product.image_url}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span>{productInitials(item.product.name)}</span>
        )}
        {!inStock ? <span className="vitrina-sd__card-oos">Out of stock</span> : null}
        {lineQty === 0 ? (
          <button
            type="button"
            className="vitrina-sd__card-add"
            aria-label={`Add ${item.product.name} to basket`}
            disabled={!inStock}
            onClick={(event) => {
              event.stopPropagation();
              cart.add(item.product, 1);
            }}
          >
            <Plus size={18} strokeWidth={2.4} />
          </button>
        ) : (
          <div className="vitrina-sd__card-stepper" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              aria-label="Decrease"
              onClick={() => cart.setQuantity(item.product.id, lineQty - 1)}
            >
              <Minus size={14} strokeWidth={2.2} />
            </button>
            <span>{lineQty}</span>
            <button
              type="button"
              aria-label="Increase"
              disabled={lineQty >= item.stock}
              onClick={() => cart.setQuantity(item.product.id, lineQty + 1)}
            >
              <Plus size={14} strokeWidth={2.2} />
            </button>
          </div>
        )}
      </div>
      <div className="vitrina-sd__card-body">
        <div className="vitrina-sd__card-name">{item.product.name}</div>
        <div className="vitrina-sd__card-price">
          €{item.product.price_eur.toFixed(2)}
          {item.product.unit ? <span className="vitrina-sd__card-unit">· {item.product.unit}</span> : null}
        </div>
      </div>
    </article>
  );
}
