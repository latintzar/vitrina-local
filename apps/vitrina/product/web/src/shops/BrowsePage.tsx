/**
 * BrowsePage — fixed Mapbox map + recipe-card-style shop list.
 *
 * Spec (rebuild brief, "Browse tab"):
 *   • Render a full-height map. Show a dot for every
 *     Sofia shop in `seed/shops.json` + `seed/recipe_shops.json`.
 *   • The list mirrors RecipeModal's pattern: the map stays fixed
 *     behind a normal page scroller, then a rounded card scrolls in
 *     front of it. No draggable snap state, no internal scroll gate.
 *     Tapping a shop on the map highlights it in the card and opens
 *     the existing ShopDetail from the row.
 *   • Empty the Mapbox container before instantiating to kill the
 *     "container should be empty" warning.
 *
 * Shop list sources are merged so the map shows EVERY shop the matcher
 * can pull from, including the recipe-only shops (cheesemonger,
 * fishmonger…) that historically only existed inside `recipe_shops`.
 */

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { listShops } from '../api/mcp';
import type { Shop } from '../api/types';
import { ShopDetail } from './ShopDetail';
import { BROWSE_PAGE_CSS } from './browsePageCss';
import type { UserLocation } from '../location/useUserLocation';

const TOKEN =
  import.meta.env.VITE_MAPBOX_TOKEN ||
  '';

export function BrowsePage({
  location,
  focusShop,
  onFocusShopConsumed,
}: {
  location?: UserLocation | null;
  /** When set (e.g. from chat shop card), open this shop's storefront once shops load. */
  focusShop?: Shop | null;
  onFocusShopConsumed?: () => void;
}) {
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Shop | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});

  useEffect(() => {
    let cancelled = false;
    listShops()
      .then((r) => !cancelled && setShops(r.shops))
      .catch((e) => !cancelled && setErr(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    // Empty the container first — kills the Mapbox
    // "container should be empty" console warning when StrictMode /
    // HMR re-mounts the page.
    mapEl.current.innerHTML = '';
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: mapEl.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [23.3219, 42.6977],
      zoom: 12.4,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right');
    mapRef.current = map;
    return () => {
      Object.values(markersRef.current).forEach((m) => m.remove());
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Drop user pin whenever location arrives. We do NOT recenter tightly
  // here; shop bounds below own the camera so the city shop network is
  // visible instead of zooming into one street.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location) return;
    const el = document.createElement('div');
    el.className = 'vitrina-browse-userpin';
    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([location.lng, location.lat])
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [location]);

  // Drop shop pins + fit the map to every shop in the city. This is the
  // "show me all restaurants/shops" view; the list card scrolls over it
  // without forcing another zoom.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !shops) return;
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};
    const bounds = new mapboxgl.LngLatBounds();
    shops.forEach((shop) => {
      if (!Number.isFinite(shop.lon) || !Number.isFinite(shop.lat)) return;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'vitrina-browse-shoppin';
      el.setAttribute('aria-label', shop.name);
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        setHighlightId(shop.id);
        setTimeout(() => {
          const node = document.querySelector(`[data-shop-row="${shop.id}"]`) as HTMLElement | null;
          node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 60);
      });
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([shop.lon, shop.lat])
        .addTo(map);
      markersRef.current[shop.id] = marker;
      bounds.extend([shop.lon, shop.lat]);
    });
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: { top: 72, right: 44, bottom: 260, left: 44 },
        maxZoom: 12.6,
        duration: 650,
      });
    }
  }, [shops]);

  useEffect(() => {
    if (!focusShop?.id || !shops?.length) return;
    const found = shops.find((s) => s.id === focusShop.id) ?? focusShop;
    setSelected(found);
    setHighlightId(found.id);
    setTimeout(() => {
      const node = document.querySelector(`[data-shop-row="${found.id}"]`) as HTMLElement | null;
      node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 80);
    onFocusShopConsumed?.();
  }, [focusShop, shops, onFocusShopConsumed]);

  if (selected) {
    return <ShopDetail shop={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="vitrina-browse-page">
      <div ref={mapEl} className="vitrina-browse-map" />
      <div ref={scrollerRef} className="vitrina-browse-scroller" aria-label="Shops near you">
        <div className="vitrina-browse-spacer" aria-hidden />
        <section className="vitrina-browse-card">
          <span className="vitrina-browse-grabber" aria-hidden />
          <header className="vitrina-browse-card__header">
            <strong>{shops ? `${shops.length} shops nearby` : 'Loading shops…'}</strong>
            <span>{location ? 'Sofia city shops on the map' : 'Sofia city shops'}</span>
          </header>
          <div className="vitrina-browse-list">
            {err ? <div className="vitrina-browse-state">Couldn't load shops: {err}</div> : null}
            {shops?.map((shop) => (
              <button
                key={shop.id}
                type="button"
                data-shop-row={shop.id}
                className={`vitrina-browse-row ${highlightId === shop.id ? 'is-highlight' : ''}`}
                onClick={() => setSelected(shop)}
              >
                <div className="vitrina-browse-row__cover">
                  {shop.cover_url ? <img src={shop.cover_url} alt="" loading="lazy" /> : <span>{shop.name[0]}</span>}
                </div>
                <div className="vitrina-browse-row__body">
                  <strong>{shop.name}</strong>
                  <span>
                    {shop.city}
                    {shop.hours ? ` · ${shop.hours}` : ''}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <style>{BROWSE_PAGE_CSS}</style>
    </div>
  );
}
