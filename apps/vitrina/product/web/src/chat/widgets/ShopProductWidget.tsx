/**
 * Shop-wrapped product row for chat — same card chrome as ShopDetail,
 * inline cart stepper after first add.
 */

import { Surface } from '@scope/ui';
import { ShopGroup } from '../../components/ShopGroup';
import { useUserLocation } from '../../location/useUserLocation';
import { walkingMinutes } from '../../location/walkingTime';
import { useCart } from '../../cart/useCart';
import { ProductRowCard } from '../../shops/ProductRowCard';
import { SHOP_DETAIL_CSS } from '../../shops/shopDetailCss';
import {
  directionsHrefForShop,
  productFromWidgetPayload,
  shopFromWidgetPayload,
  stockLineFromWidgetPayload,
} from './chatWidgetEntities';

export interface ShopProductWidgetPayload extends Record<string, unknown> {
  shop?: Record<string, unknown>;
  product?: Record<string, unknown>;
}

export function ShopProductWidget(props: Record<string, unknown>) {
  const cart = useCart();
  const { location } = useUserLocation();
  const shopRaw = (props.shop ?? {}) as Record<string, unknown>;
  const productRaw = (props.product ?? props) as Record<string, unknown>;
  const shop = shopFromWidgetPayload(shopRaw);
  if (!shop) return null;
  const product = productFromWidgetPayload(productRaw, shop.id);
  if (!product) return null;

  const stockNum =
    typeof productRaw.effective_stock === 'number'
      ? productRaw.effective_stock
      : productRaw.stock;
  const stock = stockLineFromWidgetPayload(shop, product, stockNum);
  const walkMin =
    location != null
      ? walkingMinutes({ lat: location.lat, lng: location.lng }, { lat: shop.lat, lng: shop.lon })
      : null;
  const mapsUrl =
    (typeof shopRaw.maps_url === 'string' && shopRaw.maps_url) ||
    (typeof shopRaw.mapsUrl === 'string' && shopRaw.mapsUrl) ||
    null;
  const directionsHref = directionsHrefForShop(shop, mapsUrl);

  return (
    <Surface className="vitrina-chat-widget vitrina-chat-shop-product">
      <ShopGroup
        name={shop.name}
        address={shop.address ?? shop.city ?? null}
        walkingMinutes={walkMin}
        directionsHref={directionsHref}
      >
        <li className="vitrina-chat-shop-product__li">
          <ProductRowCard item={stock} cart={cart} />
        </li>
      </ShopGroup>
      <style>{`
        .vitrina-chat-shop-product {
          margin: 6px 0;
          padding: 0 0 8px;
          overflow: hidden;
        }
        .vitrina-chat-shop-product__li {
          list-style: none;
          margin: 0;
          padding: 8px 0 0;
        }
        .vitrina-chat-shop-product .vitrina-sd__card {
          max-width: 280px;
        }
      `}</style>
      <style>{SHOP_DETAIL_CSS}</style>
    </Surface>
  );
}
