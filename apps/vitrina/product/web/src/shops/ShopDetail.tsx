/**
 * ShopDetail — Deliveroo-grocery-style storefront for one neighbourhood
 * shop. Modeled directly on
 * https://deliveroo.co.uk/menu/.../mcdonalds-0109-hackney/ (uploaded
 * mcdonalds-0109-hackney-0.md):
 *
 *  ┌──────────────────────────────────────────────┐
 *  │  ◀ back                                       │
 *  │  ┌────────────────── HERO IMG ─────────────┐ │   (full-bleed)
 *  │  └─────────────────────────────────────────┘ │
 *  │                                               │
 *  │  Shop name                                    │
 *  │  ★ rating ·  N min walk · "address line"      │
 *  │  [Directions]   [Pickup: Today 12-14]         │
 *  ├──── sticky from here under the topnav ──────┤
 *  │  🔍  search products                          │
 *  │  · pillA · pillB · pillC · …  (h-scroll)      │
 *  ├───────────────────────────────────────────────┤
 *  │  Burgers                                       │
 *  │  ┌──┐┌──┐┌──┐  →  (h-scroll, 3 cards visible) │
 *  │  │  ││  ││  │                                  │
 *  │  └──┘└──┘└──┘                                  │
 *  │  Sides                                         │
 *  │  ┌──┐┌──┐┌──┐  →                              │
 *  └───────────────────────────────────────────────┘
 *
 * Behaviour:
 *   • Page scrolls within the standard tab content area (NOT a fixed
 *     overlay), so the global topnav + bottom-nav stay correct. The
 *     search/categories bar is `position: sticky; top: <navbar>` so it
 *     pins under the navbar once the hero scrolls past.
 *   • Active category highlights automatically as the user scrolls
 *     (IntersectionObserver). Tapping a pill smooth-scrolls the page
 *     to that category. The pill strip auto-scrolls horizontally to
 *     keep the active pill in view (Deliveroo's behaviour exactly).
 *   • Each category renders as a horizontal-scroll snap row showing
 *     ~3 compact cards on mobile. Tap card body to see description;
 *     tap the floating + (or stepper) to add/remove without leaving
 *     the row.
 *   • Search, when typed, switches the layout to a single flat list
 *     of matches — no carousels, no categories — same compact card
 *     style.
 *
 * Padding: the root .vitrina-sd has top padding to clear the global
 * navbar (~64px + safe-area) and bottom padding to clear the
 * bottom-nav (~76px) so we don't sit under either bar.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Navigation, ChevronLeft, X, Clock4 } from 'lucide-react';
import { Button } from '@scope/ui';
import { useCart } from '../cart/useCart';
import { useSlot } from '../cart/fulfillment';
import { getShopInventory } from '../api/mcp';
import type { Shop, StockLine } from '../api/types';
import { ProductRowCard } from './ProductRowCard';
import { SHOP_DETAIL_CSS } from './shopDetailCss';

interface ShopDetailProps {
  shop: Shop;
  onBack?: () => void;
}

function directionsHref(shop: Shop): string {
  const q = encodeURIComponent(`${shop.name}, ${shop.address || shop.city || ''}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function prettyCategory(cat: string): string {
  // Most catalog categories arrive lowercase or kebab-cased ("dairy",
  // "fresh-produce"). Title-case + de-kebab so the section headers
  // look like Deliveroo's ("Burgers", "Fries & Sides", "Sauces").
  const cleaned = cat.replace(/[-_]+/g, ' ').trim();
  if (!cleaned) return cat;
  return cleaned
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

const CATEGORY_OTHER = 'Other';

export function ShopDetail({ shop, onBack }: ShopDetailProps) {
  const [items, setItems] = useState<StockLine[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<StockLine | null>(null);
  const cart = useCart();
  const { slot } = useSlot();
  const searchInput = useRef<HTMLInputElement | null>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const pillsRef = useRef<HTMLDivElement | null>(null);
  const pillRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const userScrollLock = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    getShopInventory(shop.id)
      .then((r) => !cancelled && setItems(r.items))
      .catch((e) => !cancelled && setErr(String(e)));
    return () => {
      cancelled = true;
    };
  }, [shop.id]);

  // Group items by (pretty) category, preserving first-seen ordering.
  const groups = useMemo(() => {
    const out = new Map<string, StockLine[]>();
    if (!items) return out;
    for (const it of items) {
      const raw = it.product.category;
      const key = raw && raw.trim() ? prettyCategory(raw) : CATEGORY_OTHER;
      const list = out.get(key) ?? [];
      list.push(it);
      out.set(key, list);
    }
    return out;
  }, [items]);

  const categoryOrder = useMemo(() => Array.from(groups.keys()), [groups]);

  // Initialise activeCategory once we know the first category.
  useEffect(() => {
    if (!activeCategory && categoryOrder.length > 0) {
      setActiveCategory(categoryOrder[0]);
    }
  }, [categoryOrder, activeCategory]);

  // Filtered (search) view — flat, no categories.
  const searchHits = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((i) =>
      [i.product.name, i.product.description ?? '', i.product.unit ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [items, query]);
  const searchActive = query.trim().length > 0;

  // Auto-highlight active category as the user scrolls. We pick the
  // FIRST category whose section is intersecting the top half of the
  // viewport (Deliveroo's pattern).
  useEffect(() => {
    if (categoryOrder.length === 0 || searchActive) return;
    const handler = () => {
      // Allow ~250 ms for click-to-scroll to settle before we let
      // the scroll position drive activeCategory again.
      if (Date.now() < userScrollLock.current) return;
      const navOffset = 130; // navbar + sticky bar
      let best: { name: string; top: number } | null = null;
      for (const [name, el] of sectionRefs.current.entries()) {
        const top = el.getBoundingClientRect().top - navOffset;
        if (top <= 0 && (best === null || top > best.top)) {
          best = { name, top };
        }
      }
      const next = best?.name ?? categoryOrder[0];
      setActiveCategory((cur) => (cur === next ? cur : next));
    };
    window.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => window.removeEventListener('scroll', handler);
  }, [categoryOrder, searchActive]);

  // Auto-scroll the pill strip to keep the active pill in view.
  useEffect(() => {
    if (!activeCategory) return;
    const pill = pillRefs.current.get(activeCategory);
    const strip = pillsRef.current;
    if (!pill || !strip) return;
    const rect = pill.getBoundingClientRect();
    const sRect = strip.getBoundingClientRect();
    if (rect.left < sRect.left + 8 || rect.right > sRect.right - 8) {
      pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeCategory]);

  function jumpToCategory(name: string) {
    const el = sectionRefs.current.get(name);
    if (!el) return;
    userScrollLock.current = Date.now() + 350;
    setActiveCategory(name);
    const top = el.getBoundingClientRect().top + window.scrollY - 130;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  return (
    <div className="vitrina-sd">
      <header className="vitrina-sd__hero">
        <button type="button" className="vitrina-sd__back" onClick={onBack} aria-label="Back">
          <ChevronLeft size={22} strokeWidth={2.2} />
        </button>
        <div
          className="vitrina-sd__heroimg"
          style={shop.cover_url ? { backgroundImage: `url(${shop.cover_url})` } : undefined}
        >
          {!shop.cover_url ? <span>{shop.name[0]}</span> : null}
        </div>
        <div className="vitrina-sd__intro">
          <h1>{shop.name}</h1>
          <p className="vitrina-sd__subline">
            {shop.address || shop.city || 'Local pickup'}
            {shop.hours ? <span> · {shop.hours}</span> : null}
          </p>
          <div className="vitrina-sd__chips">
            <a
              href={directionsHref(shop)}
              target="_blank"
              rel="noreferrer"
              className="vitrina-sd__chip vitrina-sd__chip--accent"
            >
              <Navigation size={14} strokeWidth={2.2} />
              Directions
            </a>
            <span className="vitrina-sd__chip">
              <Clock4 size={14} strokeWidth={2.2} />
              {slot?.label ?? 'Pickup: choose slot'}
            </span>
          </div>
        </div>
      </header>

      <div className="vitrina-sd__bar">
        <div className="vitrina-sd__search">
          <Search size={16} strokeWidth={2} className="vitrina-sd__search-icon" />
          <input
            ref={searchInput}
            type="search"
            placeholder={`Search ${shop.name}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              className="vitrina-sd__search-clear"
              onClick={() => {
                setQuery('');
                searchInput.current?.focus();
              }}
              aria-label="Clear search"
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          ) : null}
        </div>
        {!searchActive && categoryOrder.length > 0 ? (
          <div className="vitrina-sd__pills" ref={pillsRef} role="tablist" aria-label="Categories">
            {categoryOrder.map((name) => (
              <button
                key={name}
                ref={(el) => {
                  if (el) pillRefs.current.set(name, el);
                  else pillRefs.current.delete(name);
                }}
                type="button"
                role="tab"
                aria-selected={activeCategory === name}
                className={activeCategory === name ? 'is-active' : ''}
                onClick={() => jumpToCategory(name)}
              >
                {name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {err ? (
        <div className="vitrina-sd__state">Couldn't load inventory: {err}</div>
      ) : !items ? (
        <div className="vitrina-sd__state">Loading shelves…</div>
      ) : searchActive ? (
        searchHits.length === 0 ? (
          <div className="vitrina-sd__state">{`No matches for "${query}".`}</div>
        ) : (
          <section className="vitrina-sd__searchresults">
            <h3>Results · {searchHits.length}</h3>
            <div className="vitrina-sd__row vitrina-sd__row--wrap">
              {searchHits.map((it) => (
                <ProductRowCard key={it.product.id} item={it} cart={cart} onSelect={setSelectedItem} />
              ))}
            </div>
          </section>
        )
      ) : groups.size === 0 ? (
        <div className="vitrina-sd__state">No items in stock yet.</div>
      ) : (
        <div className="vitrina-sd__sections">
          {categoryOrder.map((name) => {
            const list = groups.get(name) ?? [];
            return (
              <section
                key={name}
                ref={(el) => {
                  if (el) sectionRefs.current.set(name, el);
                  else sectionRefs.current.delete(name);
                }}
                className="vitrina-sd__section"
                aria-label={name}
              >
                <h3>{name}</h3>
                <div className="vitrina-sd__row" role="list">
                  {list.map((it) => (
                    <ProductRowCard key={it.product.id} item={it} cart={cart} onSelect={setSelectedItem} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {selectedItem ? (
        <div
          className="vitrina-sd__sheet"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="vitrina-sd__sheet-card"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="vitrina-sd__sheet-close"
              onClick={() => setSelectedItem(null)}
              aria-label="Close"
            >
              <X size={18} strokeWidth={2.2} />
            </button>
            {selectedItem.product.image_url ? (
              <img src={selectedItem.product.image_url} alt="" />
            ) : null}
            <h3>{selectedItem.product.name}</h3>
            <p>{selectedItem.product.description || 'Available for click and collect.'}</p>
            <div className="vitrina-sd__sheet-meta">
              <span>{selectedItem.stock > 0 ? `${selectedItem.stock} in stock` : 'Out of stock'}</span>
              <strong>€{selectedItem.product.price_eur.toFixed(2)}</strong>
            </div>
            <Button
              fullWidth
              disabled={selectedItem.stock <= 0}
              onClick={() => {
                cart.add(selectedItem.product, 1);
                setSelectedItem(null);
              }}
            >
              Add to basket
            </Button>
          </div>
        </div>
      ) : null}

      <style>{SHOP_DETAIL_CSS}</style>
    </div>
  );
}
