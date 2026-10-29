import { ShopMap } from '@scope/ui';
import type { Shop } from '../api/types';

const TOKEN =
  import.meta.env.VITE_MAPBOX_TOKEN ||
  '';

export function ShopsMap({
  shops,
  onSelect,
  height = '100%',
}: {
  shops: Shop[];
  onSelect?: (shop: Shop) => void;
  height?: string | number;
}) {
  return (
    <div className="vitrina-map-shell">
      <ShopMap
        accessToken={TOKEN}
        points={shops}
        height={height}
        onSelect={onSelect}
        className="vitrina-map"
        pinClassName="vitrina-map-pin"
      />

      <style>{`
        .vitrina-map-shell {
          height: ${typeof height === 'number' ? `${height}px` : height};
        }
        .vitrina-map {
          height: 100%;
          width: 100%;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid var(--color-border);
          box-shadow: 0 6px 24px -12px rgba(31, 75, 150, 0.18);
        }
        .vitrina-map-pin {
          width: 18px;
          height: 18px;
          border: 2px solid var(--color-card);
          border-radius: 50% 50% 50% 0;
          background: var(--user-bubble-bg, #CEE4FB);
          box-shadow: 0 8px 20px rgba(31, 75, 150, 0.3);
          cursor: pointer;
          transform: rotate(45deg);
        }
      `}</style>
    </div>
  );
}
